/** ffmpeg / ffprobe wrappers. Both binaries are required on PATH (see docs/setup.md). */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';

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
 * Ambient music bed synthesised locally (no licensing questions): a slow detuned A-minor pad
 * with pink-noise air, low-passed and echoed.
 */
export async function synthesizePad(out: string, seconds: number): Promise<void> {
  const d = Math.ceil(seconds + 2);
  const fadeOut = Math.max(0, d - 4);
  await ffmpeg([
    ...['110', '164.8', '220.6', '329.2'].flatMap((f) => ['-f', 'lavfi', '-i', `sine=f=${f}:d=${d}`]),
    '-f',
    'lavfi',
    '-i',
    `anoisesrc=d=${d}:c=pink:a=0.02`,
    '-filter_complex',
    '[0]volume=0.5[a];[1]volume=0.35[b];[2]volume=0.25,tremolo=f=0.13:d=0.6[c];[3]volume=0.12,tremolo=f=0.21:d=0.8[e];' +
      '[4]lowpass=f=900[n];[a][b][c][e][n]amix=inputs=5:normalize=0,lowpass=f=1400,' +
      `aecho=0.8:0.7:600|1100:0.35|0.25,afade=t=in:d=3,afade=t=out:st=${fadeOut}:d=4,volume=0.9`,
    '-ar',
    '44100',
    out,
  ]);
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
