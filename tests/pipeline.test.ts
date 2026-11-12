/**
 * End-to-end stage gating with fake engines (no TTS model, Chrome, or network):
 * proves the state machine, hash checks, actor rules and records behave.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Episode } from '../src/core/episode';
import { readJson, writeJson } from '../src/core/io';
import { localMidnight } from '../src/core/time';
import { PublishRecord, type Plan } from '../src/core/schemas';
import * as stages from '../src/pipeline/stages';
import { buildCreatePostInput } from '../src/publish/payload';
import { episodeReport, ledger } from '../src/report/report';
import { validateRecords } from '../src/report/validate';
import { config, EU, tempWorkspace } from './fixtures';

const fakeTts = () =>
  Promise.resolve({
    generate: (text: string) =>
      Promise.resolve({ audio: new Float32Array(Math.max(1, text.length) * 100).fill(0.2), sampleRate: 24000 }),
  });

const fakeRenderer: stages.Renderer = {
  render(ep) {
    fs.mkdirSync(ep.paths.build, { recursive: true });
    fs.writeFileSync(ep.paths.video, `video-${Date.now()}-${Math.random()}`);
    return Promise.resolve({
      renderSeconds: 1,
      durationSec: 20,
      width: 1080,
      height: 1920,
      fps: 30,
      remotionVersion: 'test',
    });
  },
};

const fakeQa = {
  automated: () => Promise.resolve([{ name: 'x', ok: true, detail: 'ok' }]),
  frames: () => Promise.resolve([]),
};

function makePlan(ep: Episode): Plan {
  const facts = stages.loadFacts(ep);
  const sep = facts.find((f) => f.id.startsWith('conj-mars-jupiter') && f.id.endsWith('-sep'))!;
  return {
    episodeId: ep.id,
    series: 'sky-this-week',
    title: 't',
    badge: 'b',
    location: EU,
    voice: { id: 'af_heart', speed: 1 },
    music: { enabled: false, volume: 0.3 },
    scenes: [
      {
        id: 'a',
        template: 'skyView',
        narration: ['On Monday the sixteenth, Mars and Jupiter are just over one degree apart.'],
        factIds: [sep.id],
        chips: [],
        captions: true,
        params: {
          time: '2026-11-16T03:00:00.000Z',
          bodies: ['Mars', 'Jupiter'],
          camera: [{ at: 0, target: { midpoint: ['Mars', 'Jupiter'] }, fov: 30, dAz: 0, dAlt: 0 }],
          labels: [],
          starLabels: [],
          twilight: 0.3,
          constellationLines: 0.08,
        },
      },
      {
        id: 'o',
        template: 'outro',
        narration: ['Follow for more.'],
        factIds: [],
        chips: [],
        captions: true,
        params: { kicker: 'k', cta: 'c' },
      },
    ],
    post: { title: 'Mars and Jupiter', description: 'Close pair.', hashtags: ['#space'] },
  };
}

describe('pipeline stages', () => {
  let ws: ReturnType<typeof tempWorkspace>;
  let ep: Episode;

  beforeEach(() => {
    ws = tempWorkspace();
    ep = stages.createEpisode({
      series: 'sky-this-week',
      id: 'sky-test',
      location: EU,
      start: localMidnight('2026-11-16', EU.timeZone),
      end: localMidnight('2026-11-23', EU.timeZone),
      actor: 'claude',
    });
  });
  afterEach(() => ws.cleanup());

  async function toQaPassed() {
    stages.researchSky(ep, 'pipeline');
    writeJson(ep.paths.plan, makePlan(ep));
    expect(stages.checkPlan(ep, 'claude').issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(stages.runFactcheck(ep, 'pipeline').ok).toBe(true);
    stages.reviewFactcheck(ep, 'pass', 'verified', 'claude');
    await stages.runVoice(ep, fakeTts, 'pipeline');
    await stages.runRender(ep, fakeRenderer, 'pipeline');
    await stages.runQa(ep, fakeQa, 'pipeline');
    stages.reviewQa(ep, 'pass', 'looked at frames', 'claude');
  }

  it('walks the happy path to a dry-run publish with a full record', async () => {
    await toQaPassed();
    expect(ep.stage).toBe('qa-passed');
    stages.approve(ep, 'Tester', 'human', config);
    const attempt = await stages.publish(
      ep,
      {
        targets: [{ platform: 'youtube', channelId: 'yt' }],
        mode: 'draft',
        dryRun: true,
        buildPayload: (p, t, m) => buildCreatePostInput(p, t, m, { mode: 'draft', aiDisclosure: true }),
      },
      'claude',
    );
    expect(attempt.targets[0].status).toBe('dry-run');
    expect(ep.stage).toBe('approved'); // dry runs don't publish
    expect(readJson(ep.paths.publish, PublishRecord).attempts).toHaveLength(1);

    const actions = ep.logs().map((l) => l.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'episode.create',
        'research.sky',
        'plan.check',
        'factcheck.review',
        'voice.synthesize',
        'render.video',
        'qa.review',
        'publish.dry-run',
      ]),
    );
    expect(episodeReport(ep)).toContain('## Publishing');
    expect(ledger()).toContain('sky-test');
  });

  it('refuses to voice a plan edited after fact-check', async () => {
    stages.researchSky(ep, 'pipeline');
    writeJson(ep.paths.plan, makePlan(ep));
    stages.checkPlan(ep, 'claude');
    stages.runFactcheck(ep, 'pipeline');
    stages.reviewFactcheck(ep, 'pass', 'ok', 'claude');
    const p = makePlan(ep);
    p.title = 'edited';
    writeJson(ep.paths.plan, p);
    await expect(stages.runVoice(ep, fakeTts, 'pipeline')).rejects.toThrow(/plan.json changed/);
  });

  it('reuses the voice when only visuals change, and logs the regression', async () => {
    await toQaPassed();
    const p = makePlan(ep);
    if (p.scenes[0].template === 'skyView') p.scenes[0].params.twilight = 0.5;
    writeJson(ep.paths.plan, p);
    stages.checkPlan(ep, 'claude');
    expect(ep.stage).toBe('planned');
    expect(ep.logs().some((l) => l.action === 'stage.regress')).toBe(true);
    stages.runFactcheck(ep, 'pipeline');
    stages.reviewFactcheck(ep, 'pass', 'visual only', 'claude');
    await stages.runVoice(ep, () => Promise.reject(new Error('should not synthesise')), 'pipeline');
    expect(ep.logs().at(-1)?.action).toBe('voice.reuse');
  });

  it('enforces actors: no pipeline reviews, no Claude approvals', async () => {
    await toQaPassed();
    expect(() => stages.reviewQa(ep, 'pass', 'x', 'pipeline')).toThrow(/claude or a human/);
    expect(() => stages.approve(ep, 'Claude', 'claude', config)).toThrow(/Only a human/);
    expect(() => stages.approve(ep, 'Bot', 'claude', { ...config, autoApprove: true })).not.toThrow();
  });

  it('blocks publishing a video that differs from the approved one', async () => {
    await toQaPassed();
    stages.approve(ep, 'Tester', 'human', config);
    fs.writeFileSync(ep.paths.video, 'tampered');
    await expect(
      stages.publish(
        ep,
        {
          targets: [{ platform: 'tiktok', channelId: 't' }],
          mode: 'now',
          dryRun: true,
          buildPayload: () => ({}),
        },
        'claude',
      ),
    ).rejects.toThrow(/does not match render.json/);
  });

  it('records partial publish failures per platform', async () => {
    await toQaPassed();
    stages.approve(ep, 'Tester', 'human', config);
    const hosted: string[] = [];
    const publisher: stages.Publisher = {
      provider: 'buffer',
      endpoint: 'https://buffer.test',
      hostMedia: (_file, name) => {
        hosted.push(name);
        return Promise.resolve({ url: `https://media.test/${name}` });
      },
      post: (input) =>
        input.channelId === 'bad' ? Promise.reject(new Error('Queue limit reached')) : Promise.resolve({ id: 'P1' }),
    };
    const a = await stages.publish(
      ep,
      {
        targets: [
          { platform: 'youtube', channelId: 'good' },
          { platform: 'tiktok', channelId: 'bad' },
        ],
        mode: 'now',
        dryRun: false,
        publisher,
        buildPayload: (p, t, m) => buildCreatePostInput(p, t, m, { mode: 'now', aiDisclosure: true }),
      },
      'claude',
    );
    expect(a.targets.map((t) => [t.platform, t.status, t.postId ?? t.error])).toEqual([
      ['youtube', 'submitted', 'P1'],
      ['tiktok', 'failed', 'Queue limit reached'],
    ]);
    // hosted once per approved video, named by episode id + sha prefix
    expect(hosted).toEqual([`sky-test-${a.videoSha256.slice(0, 8)}.mp4`]);
    expect(a.media?.url).toBe(`https://media.test/${hosted[0]}`);
    expect(ep.stage).toBe('published');
  });

  it('reschedules submitted posts and records the move', async () => {
    await toQaPassed();
    stages.approve(ep, 'Tester', 'human', config);
    await stages.publish(
      ep,
      {
        targets: [{ platform: 'youtube', channelId: 'yt' }],
        mode: 'schedule',
        date: '2099-01-02T17:00:00Z',
        dryRun: false,
        publisher: {
          provider: 'buffer',
          endpoint: 'https://buffer.test',
          hostMedia: () => Promise.resolve({ url: 'https://media.test/v.mp4' }),
          post: () => Promise.resolve({ id: 'P1' }),
        },
        buildPayload: (p, t, m) =>
          buildCreatePostInput(p, t, m, { mode: 'schedule', date: '2099-01-02T17:00:00Z', aiDisclosure: false }),
      },
      'claude',
    );
    const moved: string[] = [];
    const r = await stages.reschedule(
      ep,
      {
        date: '2099-01-01T17:00:00Z',
        endpoint: 'https://buffer.test',
        edit: (input) => (
          moved.push(`${String(input.id)}@${String(input.dueAt)}:${String(input.text).length > 0}`),
          Promise.resolve()
        ),
      },
      'claude',
    );
    expect(moved).toEqual(['P1@2099-01-01T17:00:00.000Z:true']); // full post resent, not just the time
    expect(r.mode).toBe('reschedule');
    expect(readJson(ep.paths.publish, PublishRecord).attempts.map((x) => x.mode)).toEqual(['schedule', 'reschedule']);
    expect(ep.logs().at(-1)?.action).toBe('publish.reschedule');
    await expect(
      stages.reschedule(ep, { date: '2000-01-01T00:00:00Z', endpoint: 'x', edit: () => Promise.resolve() }, 'claude'),
    ).rejects.toThrow(/future/);
  });

  it('validateRecords flags hand-edited plans and stale reports', async () => {
    await toQaPassed();
    fs.writeFileSync(ep.paths.readme, episodeReport(ep));
    expect(validateRecords()).toEqual([]);
    const p = makePlan(ep);
    p.badge = 'edited by hand';
    writeJson(ep.paths.plan, p);
    const problems = validateRecords().join('\n');
    expect(problems).toMatch(/edited after validation/);
    expect(problems).toMatch(/rendered from a different plan/);
  });

  it('keeps sourced facts when research is re-run', () => {
    stages.researchSky(ep, 'pipeline');
    stages.addSourcedFact(
      ep,
      {
        id: 'src',
        statement: 's',
        values: [],
        source: { type: 'url', url: 'https://example.org', title: 't', accessed: '2026-11-11' },
      },
      'claude',
    );
    stages.researchSky(ep, 'pipeline');
    expect(stages.loadFacts(ep).some((f) => f.id === 'src')).toBe(true);
    expect(fs.existsSync(path.join(ws.dir, 'episodes', 'sky-test', 'log.jsonl'))).toBe(true);
  });
});

describe('review persistence', () => {
  it('re-running the automated fact-check keeps the review and stage', async () => {
    const ws = tempWorkspace();
    try {
      const ep = stages.createEpisode({
        series: 'sky-this-week',
        id: 'keep',
        location: EU,
        start: localMidnight('2026-11-16', EU.timeZone),
        end: localMidnight('2026-11-23', EU.timeZone),
        actor: 'claude',
      });
      stages.researchSky(ep, 'pipeline');
      writeJson(ep.paths.plan, makePlan(ep));
      stages.checkPlan(ep, 'claude');
      stages.runFactcheck(ep, 'pipeline');
      stages.reviewFactcheck(ep, 'pass', 'ok', 'claude');
      await stages.runVoice(ep, fakeTts, 'pipeline');
      stages.runFactcheck(ep, 'pipeline');
      expect(
        (JSON.parse(fs.readFileSync(ep.paths.factcheck, 'utf8')) as { review: { verdict: string } }).review.verdict,
      ).toBe('pass');
      stages.reviewFactcheck(ep, 'pass', 'again', 'claude');
      expect(ep.stage).toBe('voiced');
    } finally {
      ws.cleanup();
    }
  });
});
