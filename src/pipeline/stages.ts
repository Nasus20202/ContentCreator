/**
 * Pipeline stages. Each function: checks preconditions (stage + input hashes), does the work,
 * writes its record, advances the manifest and logs. The CLI is a thin wrapper over these.
 *
 *   created → researched → planned → factchecked → voiced → rendered → qa-passed → approved → published
 */
import fs from 'node:fs';
import path from 'node:path';
import { releaseTag } from '../publish/media-host';
import { Episode, stageIndex } from '../core/episode';
import { hashData, nowIso, PipelineError, readJson, sha256File, writeJson } from '../core/io';
import { paths } from '../core/paths';
import {
  AssetsFile,
  FactsFile,
  Plan,
  PublishRecord,
  QaRecord,
  RenderRecord,
  type ResearchFile,
  Timeline,
  type Actor,
  type AssetRecord,
  type ChannelConfig,
  type Fact,
  type Location,
  type Platform,
} from '../core/schemas';
import { detectSkyEvents } from '../planning/astro/events';
import { ENGINE } from '../planning/astro/sky';
import { factcheckPlan } from '../planning/factcheck/factcheck';
import { validatePlan, type PlanIssue } from '../planning/validate-plan';
import { narrationHash, type TtsEngine, synthesizePlan } from '../voice/synthesize';

// ------------------------------------------------------------------ helpers

export const planHash = (plan: Plan): string => hashData(plan);

export function loadPlan(ep: Episode): Plan {
  return readJson(ep.paths.plan, Plan);
}
export function loadFacts(ep: Episode): Fact[] {
  return fs.existsSync(ep.paths.facts) ? readJson(ep.paths.facts, FactsFile).facts : [];
}
export function loadAssets(ep: Episode): AssetRecord[] {
  return fs.existsSync(ep.paths.assets) ? readJson(ep.paths.assets, AssetsFile).assets : [];
}

/** Guard: the plan on disk must be exactly the one an earlier stage signed off. */
function requireUnchangedPlan(ep: Episode, plan: Plan): void {
  const signed = ep.manifest.hashes.plan;
  if (signed && signed !== planHash(plan)) {
    throw new PipelineError(
      'plan.json changed after it was validated',
      `Re-run: cc plan ${ep.id} && cc factcheck ${ep.id}`,
    );
  }
}

// ------------------------------------------------------------------ create

export function createEpisode(opts: {
  series: string;
  id: string;
  location?: Location;
  start?: Date;
  end?: Date;
  actor: Actor;
}): Episode {
  if (!fs.existsSync(path.join(paths.series, `${opts.series}.md`))) {
    throw new PipelineError(`Unknown series "${opts.series}"`, `Series are defined in series/*.md`);
  }
  return Episode.create(
    {
      id: opts.id,
      series: opts.series,
      location: opts.location,
      window: opts.start && opts.end ? { start: opts.start.toISOString(), end: opts.end.toISOString() } : undefined,
    },
    opts.actor,
  );
}

// ------------------------------------------------------------------ research

export function researchSky(ep: Episode, actor: Actor): ResearchFile {
  const { location, window } = ep.manifest;
  if (!location || !window) throw new PipelineError('Sky research needs a location and a time window on the episode');
  const { events, facts } = detectSkyEvents(location, new Date(window.start), new Date(window.end));
  const research: ResearchFile = { kind: 'sky-week', location, window, generatedAt: nowIso(), engine: ENGINE, events };
  writeJson(ep.paths.research, research);
  // computed facts are regenerated; manually sourced (url) facts are preserved
  const manual = loadFacts(ep).filter((f) => f.source.type === 'url' && !facts.some((g) => g.id === f.id));
  writeJson(ep.paths.facts, { facts: [...facts, ...manual] });
  if (ep.stage === 'created') ep.advance('researched', actor, { research: hashData(research.events) });
  ep.log(actor, 'researched', 'research.sky', {
    events: events.length,
    facts: facts.length,
    top: events.slice(0, 5).map((e) => e.id),
  });
  return research;
}

export function addSourcedFact(ep: Episode, fact: Fact, actor: Actor): void {
  if (fact.source.type !== 'url') throw new PipelineError('Manually added facts must cite a URL');
  const facts = loadFacts(ep);
  if (facts.some((f) => f.id === fact.id)) throw new PipelineError(`Fact "${fact.id}" already exists`);
  writeJson(ep.paths.facts, FactsFile.parse({ facts: [...facts, fact] }));
  if (ep.stage === 'created') ep.advance('researched', actor);
  ep.log(actor, 'researched', 'fact.add', { id: fact.id, url: fact.source.url });
}

// ------------------------------------------------------------------ plan

export function checkPlan(ep: Episode, actor: Actor): { plan: Plan; issues: PlanIssue[] } {
  ep.requireStage('researched');
  const plan = loadPlan(ep);
  if (plan.episodeId !== ep.id) throw new PipelineError(`plan.episodeId is "${plan.episodeId}", expected "${ep.id}"`);
  const issues = validatePlan(plan, loadFacts(ep), loadAssets(ep));
  const errors = issues.filter((i) => i.level === 'error');
  ep.log(actor, 'planned', 'plan.check', { ok: errors.length === 0, issues });
  if (errors.length === 0) {
    const h = planHash(plan);
    if (ep.manifest.hashes.plan !== h || ep.stage === 'researched') ep.advance('planned', actor, { plan: h });
  }
  return { plan, issues };
}

// ------------------------------------------------------------------ factcheck

export function runFactcheck(ep: Episode, actor: Actor): ReturnType<typeof factcheckPlan> {
  ep.requireStage('planned');
  const plan = loadPlan(ep);
  requireUnchangedPlan(ep, plan);
  const result = factcheckPlan(plan, loadFacts(ep));
  // a semantic review stays valid while the plan is unchanged (re-running the automated check must not erase it)
  const prev = fs.existsSync(ep.paths.factcheck)
    ? (JSON.parse(fs.readFileSync(ep.paths.factcheck, 'utf8')) as { planHash?: string; review?: unknown })
    : undefined;
  const review = prev?.planHash === planHash(plan) ? (prev.review ?? null) : null;
  writeJson(ep.paths.factcheck, { checkedAt: nowIso(), planHash: planHash(plan), automated: result, review });
  ep.log(actor, 'factcheck', 'factcheck.automated', {
    ok: result.ok,
    claims: result.claims.length,
    problems: result.problems,
  });
  return result;
}

export function reviewFactcheck(ep: Episode, verdict: 'pass' | 'fail', notes: string, actor: Actor): void {
  if (actor === 'pipeline') throw new PipelineError('A fact-check review must be made by claude or a human');
  const plan = loadPlan(ep);
  requireUnchangedPlan(ep, plan);
  if (!fs.existsSync(ep.paths.factcheck))
    throw new PipelineError(`Run the automated check first: cc factcheck ${ep.id}`);
  const fc = JSON.parse(fs.readFileSync(ep.paths.factcheck, 'utf8')) as {
    planHash: string;
    automated: { ok: boolean };
  };
  if (fc.planHash !== planHash(plan)) throw new PipelineError('factcheck.json is stale; re-run cc factcheck');
  if (verdict === 'pass' && !fc.automated.ok) {
    throw new PipelineError('Automated fact-check has unresolved problems; fix the plan or facts first');
  }
  writeJson(ep.paths.factcheck, { ...fc, review: { actor, at: nowIso(), verdict, notes } });
  ep.log(actor, 'factcheck', 'factcheck.review', { verdict, notes });
  if (verdict === 'pass' && stageIndex(ep.stage) < stageIndex('factchecked')) {
    ep.advance('factchecked', actor, { factcheckedPlan: planHash(plan) });
  }
}

// ------------------------------------------------------------------ voice

export async function runVoice(
  ep: Episode,
  engine: () => Promise<TtsEngine>,
  actor: Actor,
  onScene?: (id: string, sec: number) => void,
): Promise<Timeline> {
  ep.requireStage('factchecked');
  const plan = loadPlan(ep);
  requireUnchangedPlan(ep, plan);
  if (fs.existsSync(ep.paths.timeline)) {
    const existing = readJson(ep.paths.timeline, Timeline);
    const filesOk = existing.scenes.every((sc) => fs.existsSync(path.join(ep.paths.build, sc.audioFile)));
    if (existing.narrationHash === narrationHash(plan) && filesOk) {
      ep.advance('voiced', actor, { narration: existing.narrationHash });
      ep.log(actor, 'voiced', 'voice.reuse', { reason: 'narration unchanged', narrationHash: existing.narrationHash });
      return existing;
    }
  }
  const timeline = await synthesizePlan(plan, ep.paths.voiceDir, await engine(), onScene);
  writeJson(ep.paths.timeline, timeline);
  const total = timeline.scenes.reduce((n, s) => n + s.duration, 0);
  ep.advance('voiced', actor, { narration: timeline.narrationHash });
  ep.log(actor, 'voiced', 'voice.synthesize', {
    engine: timeline.engine,
    voice: timeline.voice,
    seconds: Math.round(total * 10) / 10,
  });
  return timeline;
}

export function loadFreshTimeline(ep: Episode, plan: Plan): Timeline {
  const timeline = readJson(ep.paths.timeline, Timeline);
  if (timeline.narrationHash !== narrationHash(plan)) {
    throw new PipelineError('Narration changed since the voice was generated', `Re-run: cc voice ${ep.id}`);
  }
  if (!fs.existsSync(ep.paths.voiceDir))
    throw new PipelineError('Voice files missing from build/', `Re-run: cc voice ${ep.id}`);
  return timeline;
}

// ------------------------------------------------------------------ render

export interface Renderer {
  render(
    ep: Episode,
    plan: Plan,
    timeline: Timeline,
  ): Promise<{
    renderSeconds: number;
    durationSec: number;
    width: number;
    height: number;
    fps: number;
    remotionVersion: string;
  }>;
}

export async function runRender(ep: Episode, renderer: Renderer, actor: Actor): Promise<RenderRecord> {
  ep.requireStage('voiced');
  const plan = loadPlan(ep);
  requireUnchangedPlan(ep, plan);
  const timeline = loadFreshTimeline(ep, plan);
  const r = await renderer.render(ep, plan, timeline);
  const record: RenderRecord = {
    renderedAt: nowIso(),
    planHash: planHash(plan),
    timelineHash: hashData(timeline),
    videoFile: path.relative(ep.paths.dir, ep.paths.video),
    videoSha256: sha256File(ep.paths.video),
    ...r,
  };
  writeJson(ep.paths.render, record);
  ep.advance('rendered', actor, { video: record.videoSha256 });
  ep.log(actor, 'rendered', 'render.video', {
    sha256: record.videoSha256,
    seconds: r.durationSec,
    renderSeconds: r.renderSeconds,
  });
  return record;
}

function requireFreshRender(ep: Episode): RenderRecord {
  const render = readJson(ep.paths.render, RenderRecord);
  if (!fs.existsSync(ep.paths.video))
    throw new PipelineError('Rendered video missing from build/', `Re-run: cc render ${ep.id}`);
  if (sha256File(ep.paths.video) !== render.videoSha256)
    throw new PipelineError('build/video.mp4 does not match render.json', `Re-run: cc render ${ep.id}`);
  if (render.planHash !== planHash(loadPlan(ep)))
    throw new PipelineError('Plan changed after rendering', `Re-run from: cc plan ${ep.id}`);
  return render;
}

// ------------------------------------------------------------------ QA

export async function runQa(
  ep: Episode,
  qa: {
    automated: (video: string) => Promise<QaRecord['automated']>;
    frames: (video: string) => Promise<QaRecord['frames']>;
  },
  actor: Actor,
): Promise<QaRecord> {
  ep.requireStage('rendered');
  const render = requireFreshRender(ep);
  const record: QaRecord = {
    checkedAt: nowIso(),
    videoSha256: render.videoSha256,
    automated: await qa.automated(ep.paths.video),
    frames: await qa.frames(ep.paths.video),
  };
  writeJson(ep.paths.qa, record);
  ep.log(actor, 'qa', 'qa.automated', {
    failed: record.automated.filter((c) => !c.ok).map((c) => c.name),
    frames: record.frames.length,
  });
  return record;
}

export function reviewQa(ep: Episode, verdict: 'pass' | 'fail', notes: string, actor: Actor): void {
  if (actor === 'pipeline') throw new PipelineError('A visual QA review must be made by claude or a human');
  // a failing verdict may be recorded after the plan moved on (it explains why); a pass needs a fresh render
  const render = verdict === 'pass' ? requireFreshRender(ep) : readJson(ep.paths.render, RenderRecord);
  const qa = readJson(ep.paths.qa, QaRecord);
  if (qa.videoSha256 !== render.videoSha256) throw new PipelineError('qa.json is for a different render; re-run cc qa');
  const failed = qa.automated.filter((c) => !c.ok);
  if (verdict === 'pass' && failed.length) {
    throw new PipelineError(`Automated QA failed: ${failed.map((c) => c.name).join(', ')}`);
  }
  writeJson(ep.paths.qa, { ...qa, visualReview: { actor, at: nowIso(), verdict, notes } });
  ep.log(actor, 'qa', 'qa.review', { verdict, notes });
  if (verdict === 'pass' && stageIndex(ep.stage) < stageIndex('qa-passed')) {
    ep.advance('qa-passed', actor);
  }
}

// ------------------------------------------------------------------ approval

export function approve(ep: Episode, by: string, actor: Actor, config: ChannelConfig, note?: string): void {
  ep.requireStage('qa-passed');
  if (actor !== 'human' && !config.autoApprove) {
    throw new PipelineError(
      'Only a human can approve while channel.config.json has autoApprove=false',
      'Ask the user to review build/video.mp4 and approve.',
    );
  }
  const render = requireFreshRender(ep);
  ep.addApproval({ by, actor, at: nowIso(), videoSha256: render.videoSha256, note });
  ep.advance('approved', actor);
}

// ------------------------------------------------------------------ publish

export interface Publisher {
  provider: 'buffer';
  endpoint: string;
  /** Makes the video reachable by the provider (Buffer fetches media by public URL). */
  hostMedia(file: string, tag: string): Promise<{ url: string }>;
  /** Submits one platform post; returns the provider's post id. */
  post(input: Record<string, unknown>): Promise<{ id: string }>;
}

export interface PublishTarget {
  platform: Platform;
  channelId: string;
}

export async function publish(
  ep: Episode,
  opts: {
    targets: PublishTarget[];
    mode: 'now' | 'schedule' | 'draft';
    date?: string;
    dryRun: boolean;
    publisher?: Publisher;
    buildPayload: (plan: Plan, target: PublishTarget, media: { url: string }) => Record<string, unknown>;
  },
  actor: Actor,
): Promise<PublishRecord['attempts'][number]> {
  ep.requireStage('approved');
  const render = requireFreshRender(ep);
  if (!ep.manifest.approvals.some((a) => a.videoSha256 === render.videoSha256)) {
    throw new PipelineError('The current video has not been approved');
  }
  if (!opts.targets.length)
    throw new PipelineError('No publish targets configured', 'Fill channel.config.json → publishing.targets');
  if (opts.mode === 'schedule' && !opts.date) throw new PipelineError('--mode schedule needs --at <ISO time>');
  if (!opts.dryRun && !opts.publisher)
    throw new PipelineError('Buffer is not configured', 'Set BUFFER_API_KEY in .env');

  const plan = loadPlan(ep);
  const attempt: PublishRecord['attempts'][number] = {
    at: nowIso(),
    actor,
    mode: opts.mode,
    scheduledFor: opts.date && new Date(opts.date).toISOString(),
    dryRun: opts.dryRun,
    provider: 'buffer',
    endpoint: opts.publisher?.endpoint ?? '(dry-run)',
    videoSha256: render.videoSha256,
    targets: [],
  };

  const media = opts.dryRun
    ? { url: 'DRY-RUN' }
    : await opts.publisher!.hostMedia(ep.paths.video, releaseTag(ep.id, render.videoSha256));
  attempt.media = media;
  // one call per platform so a failure on one does not block the others
  for (const t of opts.targets) {
    const payload = opts.buildPayload(plan, t, media);
    if (opts.dryRun) {
      attempt.targets.push({ ...t, status: 'dry-run', payload });
      continue;
    }
    try {
      const res = await opts.publisher!.post(payload);
      attempt.targets.push({ ...t, status: 'submitted', postId: res.id, payload });
    } catch (e) {
      attempt.targets.push({ ...t, status: 'failed', error: e instanceof Error ? e.message : String(e), payload });
    }
  }

  const record = fs.existsSync(ep.paths.publish) ? readJson(ep.paths.publish, PublishRecord) : { attempts: [] };
  record.attempts.push(attempt);
  writeJson(ep.paths.publish, record);
  ep.log(actor, 'publish', opts.dryRun ? 'publish.dry-run' : 'publish.submit', {
    mode: opts.mode,
    media: media.url,
    targets: attempt.targets.map((t) => `${t.platform}:${t.status}`),
  });
  if (!opts.dryRun && attempt.targets.some((t) => t.status === 'submitted')) ep.advance('published', actor);
  return attempt;
}
