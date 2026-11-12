#!/usr/bin/env node
/**
 * `cc` — the single entry point Claude Code (and humans) use to run the pipeline.
 * Usage: pnpm cc <command> [options]      (see docs/cli.md or `pnpm cc --help`)
 */
import 'dotenv/config';
import { Command, Option } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { recordChannelDecision, channelDecisionsMarkdown } from '../core/channel-log';
import { bufferApiKey, loadConfig, resolveLocation } from '../core/config';
import { Episode } from '../core/episode';
import { appendJsonl, nowIso, PipelineError, readJson, sha256File, writeJson } from '../core/io';
import { paths } from '../core/paths';
import { addLocalDays, localMidnight } from '../core/time';
import {
  Actor,
  AssetsFile,
  Fact,
  MetricSnapshot,
  Platform,
  Plan,
  ResearchFile,
  Timeline,
  type Stage,
} from '../core/schemas';
import { downloadNasa, lookupNasa, searchNasa } from '../assets/nasa';
import { BufferClient } from '../publish/buffer';
import { GitBranchHost } from '../publish/media-host';
import { buildCreatePostInput } from '../publish/payload';
import { FPS } from '../render/prepare';
import { extractReviewFrames, runAutomatedQa } from '../render/qa';
import { remotionRenderer } from '../render/remotion-renderer';
import { writeReports } from '../report/report';
import { validateRecords } from '../report/validate';
import * as stages from '../pipeline/stages';

const program = new Command();
program.name('cc').description('ContentCreator pipeline — operated from Claude Code').showHelpAfterError();

const actorOpt = () =>
  new Option('--actor <actor>', 'who performs this step').choices(Actor.options).default('pipeline');
const say = (...lines: string[]) => console.log(lines.join('\n'));

const NEXT: Record<Stage, string> = {
  created: 'research: cc research sky <id>  (or add sourced facts: cc fact add)',
  researched: 'write plan.json (skill: plan-episode), then: cc plan <id>',
  planned: 'cc factcheck <id>, then review and: cc factcheck <id> --review pass --notes "…" --actor claude',
  factchecked: 'cc voice <id>',
  voiced: 'cc render <id>',
  rendered: 'cc qa <id>, inspect frames, then: cc qa <id> --review pass --notes "…" --actor claude',
  'qa-passed': 'ask the human to watch build/video.mp4, then: cc approve <id> --by "<name>" --actor human',
  approved: 'cc publish <id> [--dry-run]',
  published: 'record metrics later: cc metrics add <id> …',
};

function refreshReport(id: string): void {
  writeReports([id]);
}

// ------------------------------------------------------------------ status

program
  .command('status')
  .argument('[episode]')
  .description('list episodes, or show one episode with its next step')
  .action((id?: string) => {
    if (!id) {
      const ids = Episode.list(paths.episodes);
      if (!ids.length)
        return say('No episodes yet. Create one: cc episode new --series sky-this-week --week YYYY-MM-DD');
      for (const e of ids) say(`${Episode.load(e).stage.padEnd(12)} ${e}`);
      return;
    }
    const ep = Episode.load(id);
    say(
      `${ep.id}`,
      `  series: ${ep.manifest.series}`,
      `  stage:  ${ep.stage}`,
      `  next:   ${NEXT[ep.stage].replaceAll('<id>', ep.id)}`,
    );
  });

// ------------------------------------------------------------------ episode

const episode = program.command('episode').description('create episodes');
episode
  .command('new')
  .requiredOption('--series <series>', 'series id (series/<id>.md)')
  .option('--week <date>', 'first day (YYYY-MM-DD) of a 7-day window, for time-boxed series')
  .option('--location <id>', 'location preset id from channel.config.json')
  .option('--id <id>', 'explicit episode id')
  .addOption(actorOpt())
  .action((o: { series: string; week?: string; location?: string; id?: string; actor: Actor }) => {
    const config = loadConfig();
    const location = o.week || o.location ? resolveLocation(config, o.location) : undefined;
    // the window is a local calendar week: local midnight to local midnight
    const start = o.week && location ? localMidnight(o.week, location.timeZone) : undefined;
    const end = o.week && location ? localMidnight(addLocalDays(o.week, 7), location.timeZone) : undefined;
    const id =
      o.id ?? [o.series, o.week ?? new Date().toISOString().slice(0, 10), location?.id].filter(Boolean).join('-');
    const ep = stages.createEpisode({ series: o.series, id, location, start, end, actor: o.actor });
    refreshReport(ep.id);
    say(`created ${ep.id}`, `next: ${NEXT.created.replaceAll('<id>', ep.id)}`);
  });

// ------------------------------------------------------------------ research

program
  .command('research')
  .description('deterministic research generators')
  .command('sky')
  .argument('<episode>')
  .addOption(actorOpt())
  .description('detect sky events in the episode window → research.json + facts.json')
  .action((id: string, o: { actor: Actor }) => {
    const ep = Episode.load(id);
    const r = stages.researchSky(ep, o.actor);
    refreshReport(id);
    say(`${r.events.length} events (top first):`);
    for (const e of r.events)
      say(
        `  ${String(e.score).padStart(3)}  ${e.title.padEnd(48)} ${e.viewing ? `${e.viewing.bestLocal} ${e.viewing.direction} ${Math.round(e.viewing.altitude)}°` : ''}`,
      );
  });

// ------------------------------------------------------------------ facts

const fact = program.command('fact').description('manage facts (claims must cite a fact)');
fact
  .command('add')
  .argument('<episode>')
  .requiredOption('--id <id>')
  .requiredOption('--statement <text>')
  .requiredOption('--url <url>')
  .requiredOption('--title <title>', 'source page title')
  .option('--publisher <name>')
  .option('--values <list>', 'comma-separated numbers the narration may quote', '')
  .addOption(actorOpt().default('claude'))
  .action(
    (
      id: string,
      o: {
        id: string;
        statement: string;
        url: string;
        title: string;
        publisher?: string;
        values: string;
        actor: Actor;
      },
    ) => {
      const ep = Episode.load(id);
      const f = Fact.parse({
        id: o.id,
        statement: o.statement,
        values: o.values ? o.values.split(',').map(Number) : [],
        source: { type: 'url', url: o.url, title: o.title, publisher: o.publisher, accessed: nowIso().slice(0, 10) },
      });
      stages.addSourcedFact(ep, f, o.actor);
      refreshReport(id);
      say(`added fact ${f.id}`);
    },
  );
fact
  .command('list')
  .argument('<episode>')
  .option('--grep <text>')
  .action((id: string, o: { grep?: string }) => {
    const facts = stages
      .loadFacts(Episode.load(id))
      .filter((f) => !o.grep || `${f.id} ${f.statement}`.toLowerCase().includes(o.grep.toLowerCase()));
    for (const f of facts) say(`${f.id}\n    ${f.statement}${f.values.length ? `  [${f.values.join(', ')}]` : ''}`);
  });

// ------------------------------------------------------------------ assets

const asset = program.command('asset').description('real imagery with recorded provenance');
asset
  .command('search')
  .argument('<query...>')
  .option('--limit <n>', 'max results', '10')
  .description('search the NASA Image and Video Library')
  .action(async (q: string[], o: { limit: string }) => {
    for (const h of await searchNasa(q.join(' '), Number(o.limit))) {
      say(
        `${h.copyrightFlag ? '⚠ ' : ''}${h.nasaId}  ${h.date ?? ''}  ${h.title}`,
        `    credit: ${h.credit}${h.copyrightFlag ? '  (third-party copyright — do not use)' : ''}`,
        `    preview: ${h.preview ?? '—'}`,
      );
    }
  });
asset
  .command('add')
  .argument('<episode>')
  .requiredOption('--nasa-id <id>')
  .requiredOption('--id <assetId>', 'id the plan will reference')
  .addOption(actorOpt().default('claude'))
  .action(async (id: string, o: { nasaId: string; id: string; actor: Actor }) => {
    const ep = Episode.load(id);
    const rec = await downloadNasa(await lookupNasa(o.nasaId), o.id, ep.paths.assetDir);
    const assets = stages.loadAssets(ep).filter((a) => a.id !== rec.id);
    writeJson(ep.paths.assets, AssetsFile.parse({ assets: [...assets, rec] }));
    ep.log(o.actor, ep.stage, 'asset.add', { id: rec.id, url: rec.source.url, license: rec.source.license });
    refreshReport(id);
    say(`added ${rec.id} → build/${rec.file}`, `credit: ${rec.source.credit}`);
  });
asset
  .command('restore')
  .argument('<episode>')
  .description('re-download recorded assets into build/ (fresh clone) and verify their hashes')
  .action(async (id: string) => {
    const ep = Episode.load(id);
    for (const a of stages.loadAssets(ep)) {
      const file = path.join(ep.paths.build, a.file);
      if (!fs.existsSync(file)) {
        const res = await fetch(a.source.url);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      }
      const ok = sha256File(file) === a.sha256;
      say(`${ok ? 'ok ' : 'MISMATCH'} ${a.id}`);
      if (!ok) process.exitCode = 1;
    }
  });

// ------------------------------------------------------------------ plan / factcheck

program
  .command('plan')
  .argument('<episode>')
  .addOption(actorOpt().default('claude'))
  .description('validate plan.json (schema + cross-references) and register it')
  .action((id: string, o: { actor: Actor }) => {
    const ep = Episode.load(id);
    const { issues } = stages.checkPlan(ep, o.actor);
    refreshReport(id);
    for (const i of issues) say(`${i.level === 'error' ? '✗' : '!'} ${i.where}: ${i.message}`);
    const errors = issues.filter((i) => i.level === 'error').length;
    if (errors) {
      process.exitCode = 1;
      return say(`${errors} error(s) — plan not accepted`);
    }
    say(`plan accepted (stage: ${ep.stage})`);
  });

program
  .command('factcheck')
  .argument('<episode>')
  .addOption(new Option('--review <verdict>', 'record a semantic review').choices(['pass', 'fail']))
  .option('--notes <text>', 'review notes (required with --review)')
  .addOption(actorOpt())
  .description('check every number against the facts; with --review, record the semantic review')
  .action((id: string, o: { review?: 'pass' | 'fail'; notes?: string; actor: Actor }) => {
    const ep = Episode.load(id);
    if (o.review) {
      if (!o.notes) throw new PipelineError('--notes is required with --review');
      stages.reviewFactcheck(ep, o.review, o.notes, o.actor);
      refreshReport(id);
      return say(`review recorded: ${o.review} (stage: ${ep.stage})`);
    }
    const r = stages.runFactcheck(ep, o.actor);
    refreshReport(id);
    for (const c of r.claims)
      say(`${c.matchedFact ? '✓' : '✗'} ${c.sceneId}.${c.where}: "${c.raw}" → ${c.matchedFact ?? 'NO FACT'}`);
    for (const p of r.problems) say(`✗ ${p}`);
    if (!r.ok) process.exitCode = 1;
    say(
      r.ok
        ? 'automated fact-check passed — now do the semantic review (skill: fact-check)'
        : 'automated fact-check FAILED',
    );
  });

// ------------------------------------------------------------------ produce

program
  .command('voice')
  .argument('<episode>')
  .addOption(actorOpt())
  .description('synthesise narration locally with Kokoro → build/voice/*.wav + timeline.json')
  .action(async (id: string, o: { actor: Actor }) => {
    const ep = Episode.load(id);
    const { loadKokoro } = await import('../voice/synthesize');
    const engine = () => {
      say('loading Kokoro (first run downloads ~90 MB)…');
      return loadKokoro();
    };
    const t = await stages.runVoice(ep, engine, o.actor, (s, sec) => say(`  ${s}: ${sec.toFixed(2)} s`));
    refreshReport(id);
    say(`total ${t.scenes.reduce((n, s) => n + s.duration, 0).toFixed(1)} s`);
  });

program
  .command('render')
  .argument('<episode>')
  .addOption(actorOpt())
  .description('render build/video.mp4 with Remotion (CPU) and normalise loudness')
  .action(async (id: string, o: { actor: Actor }) => {
    const ep = Episode.load(id);
    const r = await stages.runRender(
      ep,
      remotionRenderer((m) => say(m)),
      o.actor,
    );
    refreshReport(id);
    say(
      `rendered ${r.durationSec.toFixed(1)} s in ${Math.round(r.renderSeconds)} s → ${path.relative(paths.root, ep.paths.video)}`,
    );
  });

program
  .command('qa')
  .argument('<episode>')
  .addOption(new Option('--review <verdict>', 'record the visual review').choices(['pass', 'fail']))
  .option('--notes <text>')
  .addOption(actorOpt())
  .description('automated technical QA + review frames; with --review, record the visual review')
  .action(async (id: string, o: { review?: 'pass' | 'fail'; notes?: string; actor: Actor }) => {
    const ep = Episode.load(id);
    if (o.review) {
      if (!o.notes) throw new PipelineError('--notes is required with --review');
      stages.reviewQa(ep, o.review, o.notes, o.actor);
      refreshReport(id);
      return say(`review recorded: ${o.review} (stage: ${ep.stage})`);
    }
    const timeline = readJson(ep.paths.timeline, Timeline);
    const qa = await stages.runQa(
      ep,
      {
        automated: (v) => runAutomatedQa(v, timeline, FPS),
        frames: (v) => extractReviewFrames(v, timeline, FPS, ep.paths.qaDir),
      },
      o.actor,
    );
    refreshReport(id);
    for (const c of qa.automated) say(`${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}`);
    say(
      `${qa.frames.length} review frames in ${path.relative(paths.root, ep.paths.qaDir)}/ — inspect them (skill: qa-review)`,
    );
    if (qa.automated.some((c) => !c.ok)) process.exitCode = 1;
  });

program
  .command('approve')
  .argument('<episode>')
  .requiredOption('--by <name>', 'who approved')
  .option('--note <text>')
  .addOption(actorOpt().default('human'))
  .description('human sign-off on the exact rendered video (sha256-pinned)')
  .action((id: string, o: { by: string; note?: string; actor: Actor }) => {
    const ep = Episode.load(id);
    stages.approve(ep, o.by, o.actor, loadConfig(), o.note);
    refreshReport(id);
    say(`approved by ${o.by}`);
  });

// ------------------------------------------------------------------ publish

const pub = program
  .command('publish')
  .description('publish via Buffer (videos served from the public `videos` branch)');

function bufferClient(): BufferClient | undefined {
  const key = bufferApiKey();
  return key ? new BufferClient(key) : undefined;
}

pub
  .command('channels')
  .description('list Buffer channels (to fill channel.config.json → publishing.targets)')
  .action(async () => {
    const client = bufferClient();
    if (!client)
      throw new PipelineError('BUFFER_API_KEY not set', 'Create one at https://publish.buffer.com/settings/api');
    for (const org of await client.organizations()) {
      say(`organization ${org.name} (${org.id})`);
      for (const c of await client.channels(org.id)) {
        say(`  ${c.service.padEnd(10)} ${c.id}  ${c.name}${c.isDisconnected ? ' (disconnected)' : ''}`);
      }
    }
  });
pub
  .command('reschedule')
  .description('move the scheduled Buffer posts of the latest submission to a new time')
  .argument('<episode>')
  .requiredOption('--at <iso>', 'new time (ISO 8601)')
  .addOption(actorOpt())
  .action(async (id: string, o: { at: string; actor: Actor }) => {
    const client = bufferClient();
    if (!client)
      throw new PipelineError('BUFFER_API_KEY not set', 'Create one at https://publish.buffer.com/settings/api');
    const ep = Episode.load(id);
    const attempt = await stages.reschedule(
      ep,
      { date: o.at, endpoint: client.endpoint, edit: (input) => client.editPost(input) },
      o.actor,
    );
    refreshReport(id);
    for (const t of attempt.targets)
      say(`${t.platform.padEnd(10)} ${t.status} → ${attempt.scheduledFor}${t.error ? ` — ${t.error}` : ''}`);
    if (attempt.targets.some((t) => t.status === 'failed')) process.exitCode = 1;
  });
pub
  .command('episode', { isDefault: true })
  .argument('<episode>')
  .addOption(new Option('--mode <mode>').choices(['now', 'schedule', 'draft']))
  .option('--at <iso>', 'schedule time (ISO 8601, with --mode schedule)')
  .option('--platforms <list>', 'subset, e.g. youtube,tiktok')
  .option('--dry-run', 'build and record payloads without uploading or calling Buffer')
  .addOption(actorOpt())
  .action(
    async (
      id: string,
      o: { mode?: 'now' | 'schedule' | 'draft'; at?: string; platforms?: string; dryRun?: boolean; actor: Actor },
    ) => {
      const ep = Episode.load(id);
      const config = loadConfig();
      const wanted = o.platforms?.split(',').map((p) => Platform.parse(p.trim()));
      const targets = config.publishing.targets.filter((t) => t.enabled && (!wanted || wanted.includes(t.platform)));
      const client = bufferClient();
      const host = new GitBranchHost(config.publishing.mediaHost.repo, config.publishing.mediaHost.branch);
      const mode = o.mode ?? config.publishing.defaultMode;
      const dryRun = o.dryRun ?? !client;
      if (dryRun && !o.dryRun) say('BUFFER_API_KEY not set → dry run');
      const attempt = await stages.publish(
        ep,
        {
          targets,
          mode,
          date: o.at,
          dryRun,
          publisher: client && {
            provider: 'buffer',
            endpoint: client.endpoint,
            hostMedia: (file, name) => host.host(file, name),
            post: (input) => client.createPost(input),
          },
          buildPayload: (plan, t, media) =>
            buildCreatePostInput(plan, t, media, { mode, date: o.at, aiDisclosure: config.publishing.aiDisclosure }),
        },
        o.actor,
      );
      refreshReport(id);
      if (attempt.media && !dryRun) say(`media      ${attempt.media.url}`);
      for (const t of attempt.targets)
        say(`${t.platform.padEnd(10)} ${t.status}${t.postId ? ` ${t.postId}` : ''}${t.error ? ` — ${t.error}` : ''}`);
      if (attempt.targets.some((t) => t.status === 'failed')) process.exitCode = 1;
    },
  );

// ------------------------------------------------------------------ trace

program
  .command('decision')
  .argument('[episode]', 'episode id (omit with --channel)')
  .option('--channel', 'channel-level decision (strategy, series, policy)')
  .requiredOption('--stage <stage>', 'e.g. strategy, research, plan, script, visuals, publish')
  .requiredOption('--decision <text>')
  .requiredOption('--rationale <text>')
  .option('--alternatives <list>', 'pipe-separated alternatives considered', '')
  .option('--inputs <list>', 'pipe-separated files/urls/event ids that informed it', '')
  .addOption(actorOpt().default('claude'))
  .description('record a decision with its rationale (append-only)')
  .action(
    (
      id: string | undefined,
      o: {
        channel?: boolean;
        stage: string;
        decision: string;
        rationale: string;
        alternatives: string;
        inputs: string;
        actor: Actor;
      },
    ) => {
      const split = (s: string) =>
        s
          .split('|')
          .map((x) => x.trim())
          .filter(Boolean);
      const d = {
        actor: o.actor,
        stage: o.stage,
        decision: o.decision,
        rationale: o.rationale,
        alternatives: split(o.alternatives),
        inputs: split(o.inputs),
      };
      if (o.channel) {
        recordChannelDecision(d);
        fs.writeFileSync(path.join(paths.docs, 'decisions', 'README.md'), channelDecisionsMarkdown());
        return say('channel decision recorded');
      }
      if (!id) throw new PipelineError('episode id required (or --channel)');
      const ep = Episode.load(id);
      ep.decide(d);
      refreshReport(id);
      say('decision recorded');
    },
  );

program
  .command('metrics')
  .command('add')
  .argument('<episode>')
  .addOption(new Option('--platform <p>').choices(Platform.options).makeOptionMandatory())
  .requiredOption('--views <n>')
  .option('--likes <n>')
  .option('--comments <n>')
  .option('--shares <n>')
  .option('--avg-view-pct <n>')
  .option('--followers <n>')
  .option('--url <url>')
  .option('--source <text>', 'where the numbers came from', 'manual (platform analytics)')
  .addOption(actorOpt().default('human'))
  .description('record a performance snapshot (feeds the strategy review)')
  .action((id: string, o: Record<string, string | undefined> & { actor: Actor }) => {
    const ep = Episode.load(id);
    const num = (v?: string) => (v === undefined ? undefined : Number(v));
    const m = MetricSnapshot.parse({
      at: nowIso(),
      platform: o.platform,
      url: o.url,
      views: num(o.views),
      likes: num(o.likes),
      comments: num(o.comments),
      shares: num(o.shares),
      avgViewPct: num(o.avgViewPct),
      followersGained: num(o.followers),
      source: o.source,
    });
    appendJsonl(ep.paths.metrics, m);
    ep.log(o.actor, ep.stage, 'metrics.add', { platform: m.platform, views: m.views });
    refreshReport(id);
    say('metrics recorded');
  });

program
  .command('report')
  .argument('[episode]')
  .description('regenerate episode README(s), docs/ledger.md and docs/decisions/README.md')
  .action((id?: string) => {
    const written = writeReports(id ? [id] : undefined);
    fs.mkdirSync(path.join(paths.docs, 'decisions'), { recursive: true });
    fs.writeFileSync(path.join(paths.docs, 'decisions', 'README.md'), channelDecisionsMarkdown());
    say(...written, 'docs/decisions/README.md');
  });

program
  .command('validate')
  .description('check all committed records parse, agree with each other, and reports are up to date (CI)')
  .action(() => {
    const problems = validateRecords();
    for (const p of problems) say(`✗ ${p}`);
    if (problems.length) process.exitCode = 1;
    else say('✓ all episode records valid');
  });

program
  .command('show')
  .argument('<episode>')
  .addOption(new Option('--what <what>').choices(['events', 'plan', 'timeline']).default('events'))
  .description('print research events / plan summary / timeline for quick inspection')
  .action((id: string, o: { what: string }) => {
    const ep = Episode.load(id);
    if (o.what === 'events') {
      for (const e of readJson(ep.paths.research, ResearchFile).events)
        say(`${String(e.score).padStart(3)} ${e.id}\n     facts: ${e.factIds.join(', ')}`);
    } else if (o.what === 'plan') {
      for (const s of readJson(ep.paths.plan, Plan).scenes) say(`[${s.template}] ${s.id}: ${s.narration.join(' ')}`);
    } else {
      for (const s of readJson(ep.paths.timeline, Timeline).scenes)
        say(`${s.sceneId}: ${s.duration.toFixed(2)} s, ${s.sentences.length} sentences`);
    }
  });

program.parseAsync().catch((e: unknown) => {
  if (e instanceof PipelineError) {
    console.error(`✗ ${e.message}${e.hint ? `\n  hint: ${e.hint}` : ''}`);
  } else {
    console.error(e);
  }
  process.exit(1);
});
