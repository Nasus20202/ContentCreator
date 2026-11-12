/** Render-side units that need no browser: props assembly and ffmpeg-based QA on a synthetic clip. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Plan, Timeline } from '../src/core/schemas';
import { totalFrames } from '../src/core/timing';
import { ffmpeg } from '../src/render/media';
import { buildRenderProps, FPS } from '../src/render/prepare';
import { extractReviewFrames, runAutomatedQa } from '../src/render/qa';
import { EU, plan } from './fixtures';

const timeline: Timeline = {
  engine: 'test',
  voice: 'af_heart',
  narrationHash: 'h',
  timing: 'estimated-proportional',
  scenes: [
    {
      sceneId: 'conj',
      audioFile: 'voice/conj.wav',
      duration: 8,
      sentences: [
        { text: 'a', start: 0.15, end: 3.5, words: [] },
        { text: 'b', start: 3.8, end: 7.5, words: [] },
      ],
    },
    {
      sceneId: 'outro',
      audioFile: 'voice/outro.wav',
      duration: 3.5,
      sentences: [{ text: 'c', start: 0.15, end: 3, words: [] }],
    },
  ],
};

describe('buildRenderProps', () => {
  it('computes a sky snapshot per sky scene and maps assets', () => {
    const props = buildRenderProps(plan(), timeline, EU, [], 'music.wav');
    expect(Object.keys(props.sky)).toEqual(['conj']);
    expect(props.sky.conj.bodies.map((b) => b.name)).toEqual(['Mars', 'Jupiter']);
    expect(props.fps).toBe(FPS);
    expect(props.musicFile).toBe('music.wav');
  });

  it('refuses a timeline that does not match the plan', () => {
    expect(() => buildRenderProps(plan(), { ...timeline, scenes: timeline.scenes.slice(0, 1) }, EU, [])).toThrow(
      /Timeline scenes/,
    );
  });

  it('requires a location for sky scenes', () => {
    expect(() => buildRenderProps(plan(), timeline, undefined, [])).toThrow(/location/);
  });

  it('rejects chips whose windows overlap (they share one row)', () => {
    const p = plan();
    const chips: Plan['scenes'][number]['chips'] = [
      { text: 'AFTER MIDNIGHT', from: 0.2, to: { sentence: 1, edge: 'start', offset: 0 } },
      { text: 'MOONSET 20:04', from: { sentence: 0, edge: 'start', offset: 0.5 } },
    ];
    const scenes = p.scenes.map((s, i) => (i === 0 ? { ...s, chips } : s));
    expect(() => buildRenderProps({ ...p, scenes }, timeline, EU, [])).toThrow(/Chips overlap in scene "conj"/);
  });

  it('accepts chips handed over at a sentence boundary', () => {
    const p = plan();
    const chips: Plan['scenes'][number]['chips'] = [
      { text: 'AFTER MIDNIGHT', from: 0.2, to: { sentence: 1, edge: 'start', offset: 0 } },
      { text: 'MOONSET 20:04', from: { sentence: 1, edge: 'start', offset: 0 } },
    ];
    const scenes = p.scenes.map((s, i) => (i === 0 ? { ...s, chips } : s));
    expect(() => buildRenderProps({ ...p, scenes }, timeline, EU, [])).not.toThrow();
  });
});

describe('QA on a synthetic clip (ffmpeg)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-qa-'));
  const video = path.join(dir, 'v.mp4');
  const seconds = totalFrames(timeline, FPS) / FPS;

  beforeAll(async () => {
    await ffmpeg([
      ...['-f', 'lavfi', '-i', `testsrc2=size=1080x1920:rate=30:duration=${seconds}`],
      ...['-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`],
      ...['-af', 'loudnorm=I=-14:TP=-1.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', video],
    ]);
  }, 60_000);
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('passes technical checks for a well-formed clip', async () => {
    const checks = await runAutomatedQa(video, timeline, FPS);
    const failed = checks.filter((c) => !c.ok);
    expect(failed).toEqual([]);
    expect(checks.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        'resolution',
        'duration',
        'duration-matches-timeline',
        'loudness',
        'true-peak',
        'no-black-gaps',
      ]),
    );
  }, 60_000);

  it('flags a timeline mismatch', async () => {
    const longer = { ...timeline, scenes: [...timeline.scenes, { ...timeline.scenes[1], sceneId: 'extra' }] };
    const checks = await runAutomatedQa(video, longer, FPS);
    expect(checks.find((c) => c.name === 'duration-matches-timeline')?.ok).toBe(false);
  }, 60_000);

  it('extracts one frame per sentence plus each scene end', async () => {
    const frames = await extractReviewFrames(video, timeline, FPS, path.join(dir, 'qa'));
    expect(frames.map((f) => f.sceneId)).toEqual(['conj', 'conj', 'conj', 'outro', 'outro']);
    for (const f of frames) expect(fs.existsSync(path.join(dir, f.file))).toBe(true);
  }, 60_000);
});
