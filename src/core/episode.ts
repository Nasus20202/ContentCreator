/**
 * Episode store: the manifest state machine plus the append-only trace (log + decisions).
 * Every pipeline command goes through `Episode` so nothing happens without a record.
 */
import fs from 'node:fs';
import { episodePaths, type EpisodePaths } from './paths';
import { appendJsonl, gitSha, nowIso, PipelineError, readJson, readJsonl, writeJson } from './io';
import { Decision, LogEntry, Manifest, STAGES, type Actor, type Stage } from './schemas';

export const stageIndex = (s: Stage): number => STAGES.indexOf(s);

export class Episode {
  readonly paths: EpisodePaths;

  private constructor(
    readonly id: string,
    private manifestData: Manifest,
  ) {
    this.paths = episodePaths(id);
  }

  static create(init: Omit<Manifest, 'stage' | 'createdAt' | 'hashes' | 'approvals'>, actor: Actor): Episode {
    const p = episodePaths(init.id);
    if (fs.existsSync(p.manifest)) throw new PipelineError(`Episode ${init.id} already exists`);
    const ep = new Episode(init.id, Manifest.parse({ ...init, stage: 'created', createdAt: nowIso() }));
    ep.save();
    ep.log(actor, 'created', 'episode.create', {
      series: init.series,
      location: init.location?.id,
      window: init.window,
    });
    return ep;
  }

  static load(id: string): Episode {
    const p = episodePaths(id);
    if (!fs.existsSync(p.manifest))
      throw new PipelineError(`Unknown episode "${id}"`, 'List episodes with: pnpm cc status');
    return new Episode(id, readJson(p.manifest, Manifest));
  }

  static list(root: string): string[] {
    if (!fs.existsSync(root)) return [];
    return fs
      .readdirSync(root)
      .filter((d) => fs.existsSync(episodePaths(d).manifest))
      .sort();
  }

  get manifest(): Readonly<Manifest> {
    return this.manifestData;
  }

  get stage(): Stage {
    return this.manifestData.stage;
  }

  /** Throws unless the episode has reached at least `stage`. */
  requireStage(stage: Stage): void {
    if (stageIndex(this.stage) < stageIndex(stage)) {
      throw new PipelineError(`Episode ${this.id} is at stage "${this.stage}", needs "${stage}" first`);
    }
  }

  /**
   * Move to `stage`. Moving backwards is allowed (e.g. editing the plan resets to "planned"),
   * and is logged explicitly so the history shows the regression.
   */
  advance(stage: Stage, actor: Actor, hashes: Record<string, string> = {}): void {
    const from = this.stage;
    this.manifestData = { ...this.manifestData, stage, hashes: { ...this.manifestData.hashes, ...hashes } };
    if (stageIndex(stage) < stageIndex('approved')) this.manifestData.approvals = [];
    this.save();
    this.log(actor, stage, stageIndex(stage) >= stageIndex(from) ? 'stage.advance' : 'stage.regress', {
      from,
      to: stage,
      hashes,
    });
  }

  addApproval(approval: Manifest['approvals'][number]): void {
    this.manifestData = { ...this.manifestData, approvals: [...this.manifestData.approvals, approval] };
    this.save();
  }

  log(actor: Actor, stage: string, action: string, details: Record<string, unknown> = {}): void {
    appendJsonl(this.paths.log, LogEntry.parse({ ts: nowIso(), actor, stage, action, details, gitSha: gitSha() }));
  }

  decide(d: Omit<Decision, 'ts'>): Decision {
    const decision = Decision.parse({ ...d, ts: nowIso() });
    appendJsonl(this.paths.decisions, decision);
    this.log(d.actor, d.stage, 'decision.record', { decision: d.decision });
    return decision;
  }

  logs(): LogEntry[] {
    return readJsonl(this.paths.log, LogEntry);
  }

  decisions(): Decision[] {
    return readJsonl(this.paths.decisions, Decision);
  }

  private save(): void {
    writeJson(this.paths.manifest, this.manifestData);
  }
}
