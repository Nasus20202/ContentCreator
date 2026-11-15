/** ffmpeg / ffprobe wrappers. Both binaries are required on PATH (see docs/setup.md). */
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';
import { z } from 'zod';
import { isPianoStyle, loadPianoNote, pianoLoop, type PianoStyle } from './piano-loop';
import { isScoreStyle, renderScore, scoreNotes, type ScoreStyle } from './score';
import { renderToneBed } from './tone/render';
import { type ToneStyle } from './tone/styles';

const run = promisify(execFile);

export async function ffmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return run('ffmpeg', ['-hide_banner', '-y', ...args], { maxBuffer: 64 * 1024 * 1024 });
}

const Probe = z.object({
  format: z.object({ duration: z.string(), size: z.string() }),
  streams: z.array(
    z.object({
      codec_type: z.string(),
      codec_name: z.string(),
      width: z.number().optional(),
      height: z.number().optional(),
      r_frame_rate: z.string().optional(),
    }),
  ),
});
export type Probe = z.infer<typeof Probe>;

export async function probe(file: string): Promise<Probe> {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    file,
  ]);
  return Probe.parse(JSON.parse(stdout));
}

/** Integrated loudness (LUFS) and true peak (dBTP) via the EBU R128 filter. */
export async function loudness(file: string): Promise<{ lufs: number; truePeak: number }> {
  const { stderr } = await ffmpeg(['-nostats', '-i', file, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-']);
  return parseEbur128(stderr);
}

export function parseEbur128(stderr: string): { lufs: number; truePeak: number } {
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  const lufs = /I:\s+(-?[\d.]+) LUFS/.exec(summary);
  const peak = /Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(summary);
  if (!lufs) throw new Error('Could not parse loudness from ffmpeg output');
  return { lufs: Number(lufs[1]), truePeak: peak && peak[1] !== '-inf' ? Number(peak[1]) : -Infinity };
}

/** Intervals of (near-)black video, in seconds. */
export async function blackSegments(file: string): Promise<{ start: number; end: number }[]> {
  const { stderr } = await ffmpeg(['-i', file, '-vf', 'blackdetect=d=0.4:pix_th=0.04', '-an', '-f', 'null', '-']);
  return [...stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => ({
    start: Number(m[1]),
    end: Number(m[2]),
  }));
}

export async function extractFrame(file: string, tSec: number, out: string): Promise<void> {
  await ffmpeg(['-ss', tSec.toFixed(3), '-i', file, '-frames:v', '1', '-q:v', '3', out]);
}

/**
 * Music beds, chosen per series or pinned per episode in the plan (`music.style`). The `piano*` beds
 * are the channel's original piano loops (`piano-loop.ts`); the others are composed with Tone.js and
 * tonal on recorded instruments (`tone/compose.ts`) and rendered offline in headless Chromium.
 */
export type BedStyle = ToneStyle | PianoStyle | ScoreStyle;
export type MusicStyle = BedStyle;

/** The bed a series gets unless its plan pins `music.style`. */
export const SERIES_BED: Record<string, BedStyle> = {
  // Tone.js ports of the original arranged beds on the Kawai upright (owner's pick, 2026-11-15);
  // the originals (`orbit`/`nebula`/`meteor`, ../score.ts) stay available to pin per plan.
  'sky-this-week': 'orbit-tone',
  'sky-tonight': 'meteor-tone',
  'sky-school': 'nebula-tone',
  'one-shot': 'flute',
  'wrong-about-space': 'acoustic',
  'cosmic-top-5': 'pulse',
  'mission-control': 'strings',
  'weird-physics': 'pulse',
};

/** A new series without a chosen bed gets the calm Tone.js `nocturne` until one is picked. */
export const bedFor = (series: string): BedStyle => SERIES_BED[series] ?? 'nocturne';

export interface BedVariant {
  /** Picks the progression/motif variant and the humanisation. */
  seed?: number;
  /** Transposes the whole bed in semitones (−6..+6). */
  transpose?: number;
  /** Scene start times in seconds; beds put their sections (hook, body, outro) on them. */
  cues?: number[];
}

/** Render a bed to `out` (wav), faded and loudness-matched. Seeded, so re-renders are identical. */
export async function synthesizePad(
  out: string,
  seconds: number,
  style: MusicStyle = 'nocturne',
  variant: BedVariant = {},
): Promise<void> {
  const sr = 44100;
  const n = Math.ceil((seconds + 2) * sr);
  const resolved = style;
  if (isScoreStyle(resolved)) {
    const shift = variant.transpose ?? 0;
    const notes = new Map<number, Awaited<ReturnType<typeof loadPianoNote>>>();
    for (const midi of scoreNotes(resolved, shift)) notes.set(midi, await loadPianoNote(midi));
    const [left, right] = renderScore({
      style: resolved,
      seconds,
      sampleRate: sr,
      seed: variant.seed ?? 0,
      transpose: shift,
      cues: variant.cues ?? [0],
      piano: (midi) => {
        const note = notes.get(midi);
        if (!note) throw new Error(`score asked for an unloaded piano note ${midi}`);
        return note;
      },
    });
    return writeBed(out, left, right, n, sr);
  }
  if (isPianoStyle(resolved)) {
    const [left, right] = await pianoLoop(seconds, resolved, variant);
    return writeBed(out, left, right, n, sr);
  }
  const bed = await renderToneBed(resolved, seconds, variant);
  if (bed.sampleRate !== sr) throw new Error(`music bed sample rate ${bed.sampleRate} != ${sr}`);
  return writeBed(out, bed.left, bed.right, n, sr);
}

/**
 * Copy a channel into exactly `n` samples, zero-padding a short one. A renderer can return a sample
 * fewer than `ceil((seconds + 2) * sr)` through float rounding; reading past its end gives NaN, which
 * used to poison the peak and silently zero the whole bed.
 */
export function fitChannel(ch: Float32Array, n: number): Float32Array {
  if (ch.length === n) return ch;
  const outCh = new Float32Array(n);
  outCh.set(ch.subarray(0, n));
  return outCh;
}

/** Peak of the faded bed; throws if it is silent or not finite, so a mute bed never reaches a render. */
export function bedPeak(left: Float32Array, right: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < left.length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  if (!Number.isFinite(peak) || peak < 1e-4) throw new Error(`music bed is silent or invalid (peak ${peak})`);
  return peak;
}

async function writeBed(
  out: string,
  rawLeft: Float32Array,
  rawRight: Float32Array,
  n: number,
  sr: number,
): Promise<void> {
  const left = fitChannel(rawLeft, n);
  const right = fitChannel(rawRight, n);
  const dur = n / sr;

  // Fades, then peak-normalise only for headroom and fix the loudness afterwards: a struck piano
  // has a much higher crest factor than a sine, so equal peak would mean a different loudness.
  // Matching LUFS instead keeps `music.volume` meaning the same thing in every style.
  const fadeIn = Math.floor(2.5 * sr);
  const fadeOutStart = Math.floor((dur - 4) * sr);
  const fadeOut = Math.max(1, n - fadeOutStart);
  for (let i = 0; i < n; i++) {
    let g = 1;
    if (i < fadeIn) g = i / fadeIn;
    if (i > fadeOutStart) g *= (n - i) / fadeOut;
    left[i] *= g;
    right[i] *= g;
  }
  const norm = 0.95 / bedPeak(left, right);

  const pcm = Buffer.alloc(44 + n * 4);
  pcm.write('RIFF', 0);
  pcm.writeUInt32LE(36 + n * 4, 4);
  pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(2, 22);
  pcm.writeUInt32LE(sr, 24);
  pcm.writeUInt32LE(sr * 4, 28);
  pcm.writeUInt16LE(4, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36);
  pcm.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * norm)) * 32767), 44 + i * 4);
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * norm)) * 32767), 46 + i * 4);
  }
  await fs.writeFile(out, pcm);

  // One measurement pass, one gain pass. Bounded so a pathological bed cannot be pushed into the
  // limiter or pulled into inaudibility.
  const TARGET_LUFS = -17.8;
  const { lufs } = await loudness(out);
  const gain = Math.max(-12, Math.min(3, TARGET_LUFS - lufs));
  if (Math.abs(gain) > 0.05) {
    const tmp = `${out}.gain.wav`;
    await ffmpeg(['-i', out, '-af', `volume=${gain.toFixed(2)}dB`, tmp]);
    await fs.rename(tmp, out);
  }
}

/** Normalise to the -14 LUFS / -1 dBTP that short-form platforms play back at. Video stream is copied. */
export async function normalizeLoudness(input: string, output: string): Promise<void> {
  await ffmpeg([
    '-i',
    input,
    '-c:v',
    'copy',
    '-af',
    'loudnorm=I=-14:TP=-1.5:LRA=11',
    '-ar',
    '48000',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    output,
  ]);
}
