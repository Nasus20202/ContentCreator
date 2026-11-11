/**
 * Automated technical QA plus frame extraction for Claude's visual review.
 * Thresholds follow platform norms for vertical short-form video.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { QaRecord, Timeline } from '../core/schemas';
import { resolveTime, sceneStarts } from '../core/timing';
import { blackSegments, extractFrame, loudness, probe } from './media';

export const QA_LIMITS = {
  width: 1080,
  height: 1920,
  maxDurationSec: 60,
  minDurationSec: 10,
  lufs: [-18, -11] as const,
  maxTruePeak: -0.5,
  maxBlackSec: 0.6,
};

export async function runAutomatedQa(video: string, timeline: Timeline, fps: number): Promise<QaRecord['automated']> {
  const checks: QaRecord['automated'] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  const p = await probe(video);
  const v = p.streams.find((s) => s.codec_type === 'video');
  const a = p.streams.find((s) => s.codec_type === 'audio');
  const dur = Number(p.format.duration);
  add('resolution', v?.width === QA_LIMITS.width && v?.height === QA_LIMITS.height, `${v?.width}x${v?.height}`);
  add('video-codec', v?.codec_name === 'h264', String(v?.codec_name));
  add('audio-present', a !== undefined, String(a?.codec_name ?? 'none'));
  add(
    'duration',
    dur >= QA_LIMITS.minDurationSec && dur <= QA_LIMITS.maxDurationSec,
    `${dur.toFixed(2)} s (limit ${QA_LIMITS.maxDurationSec} s)`,
  );

  const expected = sceneStarts(timeline, fps).reduce((n, s) => n + s.frames, 0) / fps;
  add(
    'duration-matches-timeline',
    Math.abs(dur - expected) < 0.2,
    `video ${dur.toFixed(2)} s vs timeline ${expected.toFixed(2)} s`,
  );

  const l = await loudness(video);
  add(
    'loudness',
    l.lufs >= QA_LIMITS.lufs[0] && l.lufs <= QA_LIMITS.lufs[1],
    `${l.lufs} LUFS (target ${QA_LIMITS.lufs.join('…')})`,
  );
  add('true-peak', l.truePeak <= QA_LIMITS.maxTruePeak, `${l.truePeak} dBFS`);

  const black = await blackSegments(video);
  const longest = black.reduce((m, b) => Math.max(m, b.end - b.start), 0);
  add(
    'no-black-gaps',
    longest <= QA_LIMITS.maxBlackSec,
    black.length ? `longest black ${longest.toFixed(2)} s` : 'none',
  );
  return checks;
}

/** One frame per sentence (shortly after it starts) plus each scene's last frame: what Claude reviews visually. */
export async function extractReviewFrames(
  video: string,
  timeline: Timeline,
  fps: number,
  outDir: string,
): Promise<QaRecord['frames']> {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const frames: QaRecord['frames'] = [];
  const starts = sceneStarts(timeline, fps);
  for (const [i, sc] of timeline.scenes.entries()) {
    const base = starts[i].from / fps;
    const times = sc.sentences.map((s) =>
      resolveTime({ sentence: sc.sentences.indexOf(s), edge: 'start', offset: 0.6 }, sc.sentences),
    );
    times.push(starts[i].frames / fps - 0.1);
    for (const [j, t] of times.entries()) {
      const tSec = Math.round((base + t) * 100) / 100;
      const file = path.join(outDir, `${String(i).padStart(2, '0')}-${sc.sceneId}-${j}.jpg`);
      await extractFrame(video, tSec, file);
      frames.push({ file: path.relative(path.dirname(outDir), file), sceneId: sc.sceneId, tSec });
    }
  }
  return frames;
}
