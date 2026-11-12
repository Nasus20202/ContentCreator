/**
 * Generate variants of a music bed so they can be auditioned side by side. Nothing in the pipeline
 * changes; to use one, pin it in the plan with `music.style`, `music.seed`, `music.transpose`.
 *
 *   pnpm tsx scripts/music-variants.ts [--style piano] [--seeds 0,1,2] [--transpose 0,-2,2]
 *                                      [--seconds 20] [--out <dir>]
 *
 * Writes one mp3 per combination (`<style>-s<seed>-t<transpose>.mp3`) plus `sheet.mp3`, which plays
 * them back to back with a 1 s gap. Every file is level-matched by synthesizePad (-17.8 LUFS).
 */
import fs from 'node:fs';
import path from 'node:path';
import { Episode } from '../src/core/episode';
import { ffmpeg, loudness, synthesizePad, type MusicStyle } from '../src/render/media';

const STYLES: MusicStyle[] = ['piano', 'piano-pulse', 'piano-air'];

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const style = arg('style', 'piano') as MusicStyle;
const seeds = arg('seeds', '0,1,2').split(',').map(Number);
const shifts = arg('transpose', '0').split(',').map(Number);
const seconds = Number(arg('seconds', '20'));

if (!STYLES.includes(style)) throw new Error(`--style must be one of ${STYLES.join(', ')}`);
if (seeds.some((s) => !Number.isInteger(s) || s < 0 || s > 999)) throw new Error('--seeds: integers 0..999');
if (shifts.some((t) => !Number.isInteger(t) || t < -6 || t > 6)) throw new Error('--transpose: integers -6..6');
if (!(seconds >= 5)) throw new Error('--seconds must be at least 5');

const out = arg('out', path.join(Episode.load('sky-tonight-2026-12-13-eu-central').paths.build, 'music', 'variants'));
fs.mkdirSync(out, { recursive: true });

const files: string[] = [];
for (const seed of seeds) {
  for (const transpose of shifts) {
    const name = `${style}-s${seed}-t${transpose}`;
    const mp3 = path.join(out, `${name}.mp3`);
    const wav = path.join(out, `${name}.wav`);
    await synthesizePad(wav, seconds, style, { seed, transpose });
    await ffmpeg(['-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '192k', mp3]);
    fs.rmSync(wav);
    const { lufs, truePeak } = await loudness(mp3);
    console.log(
      `${name.padEnd(22)} ${lufs.toFixed(1)} LUFS  ${truePeak.toFixed(1)} dBTP  → ${path.relative(process.cwd(), mp3)}`,
    );
    files.push(mp3);
  }
}

if (files.length > 1) {
  const silence = path.join(out, 'gap.wav');
  await ffmpeg(['-y', '-f', 'lavfi', '-t', '1', '-i', 'anullsrc=r=44100:cl=stereo', silence]);
  const parts = files.flatMap((f, i) => (i === 0 ? [f] : [silence, f]));
  const args = ['-y'];
  for (const p of parts) args.push('-i', p);
  const chain = parts.map((_, i) => `[${i}:a]`).join('');
  args.push(
    '-filter_complex',
    `${chain}concat=n=${parts.length}:v=0:a=1[a]`,
    '-map',
    '[a]',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '192k',
    path.join(out, 'sheet.mp3'),
  );
  await ffmpeg(args);
  fs.rmSync(silence);
  console.log(
    `sheet (${files.length} variants, 1 s gaps) → ${path.relative(process.cwd(), path.join(out, 'sheet.mp3'))}`,
  );
}
