/**
 * Render the piano beds on their own, plus one file that plays them back to back, so a human can
 * choose a bed without watching three videos. Nothing in the pipeline is touched.
 *
 *   pnpm tsx scripts/music-ab.ts [seconds]
 *
 * The beds are peak-normalised in production, which leaves up to ~1 LU between them, so the copies
 * here are level-matched to their common mean: the comparison should be about character, not level.
 * Writes `build/music/music-<style>.mp3`, `music-ab.mp3` and `music-ab.png` (waveforms).
 */
import fs from 'node:fs';
import path from 'node:path';
import { Episode } from '../src/core/episode';
import { ffmpeg, loudness, synthesizePad, type MusicStyle } from '../src/render/media';

const STYLES: MusicStyle[] = ['orbit', 'nebula', 'meteor', 'piano', 'piano-pulse', 'piano-air'];
const seconds = Number(process.argv[2] ?? 20);
if (!Number.isFinite(seconds) || seconds < 5) {
  console.error('usage: pnpm tsx scripts/music-ab.ts [seconds >= 5]');
  process.exit(1);
}

const ep = Episode.load('sky-tonight-2026-12-13-eu-central');
const out = path.join(ep.paths.build, 'music');
fs.mkdirSync(out, { recursive: true });

const raw = new Map<MusicStyle, string>();
for (const style of STYLES) {
  const wav = path.join(out, `music-${style}-raw.wav`);
  const mp3 = path.join(out, `music-${style}-raw.mp3`);
  await synthesizePad(wav, seconds, style);
  await ffmpeg(['-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '192k', mp3]);
  fs.rmSync(wav);
  raw.set(style, mp3);
}

const measured = new Map<MusicStyle, number>();
for (const style of STYLES) measured.set(style, (await loudness(raw.get(style)!)).lufs);
const target = STYLES.reduce((a, s) => a + measured.get(s)!, 0) / STYLES.length;

const matched: string[] = [];
for (const style of STYLES) {
  const src = raw.get(style)!;
  const dst = path.join(out, `music-${style}.mp3`);
  const gain = (target - measured.get(style)!).toFixed(2);
  await ffmpeg(['-y', '-i', src, '-af', `volume=${gain}dB`, '-codec:a', 'libmp3lame', '-b:a', '192k', dst]);
  fs.rmSync(src);
  const { lufs } = await loudness(dst);
  console.log(
    `${style.padEnd(8)} ${seconds} s  ${measured.get(style)!.toFixed(1)} → ${lufs.toFixed(1)} LUFS  → ${path.relative(process.cwd(), dst)}`,
  );
  matched.push(dst);
}

// One file to play straight through: a beat of silence between beds so the switch is audible.
// The gap is generated inside the filter graph — a silence *file* in a concat list gets dropped
// when the inputs are mp3.
const ab = path.join(out, 'music-ab.mp3');
await ffmpeg([
  '-y',
  '-i',
  matched[0],
  '-i',
  matched[1],
  '-i',
  matched[2],
  '-f',
  'lavfi',
  '-t',
  '1',
  '-i',
  'anullsrc=r=44100:cl=stereo',
  '-filter_complex',
  '[0:a][3:a][1:a][3:a][2:a]concat=n=5:v=0:a=1[a]',
  '-map',
  '[a]',
  '-codec:a',
  'libmp3lame',
  '-b:a',
  '192k',
  ab,
]);

// Waveforms, so the difference is also visible: the pulse bed has a thump every two seconds, the
// sparse bed rings out for longer.
for (const style of STYLES) {
  await ffmpeg([
    '-y',
    '-i',
    path.join(out, `music-${style}.mp3`),
    '-filter_complex',
    'showwavespic=s=1200x200:colors=#ffd666',
    path.join(out, `wave-${style}.png`),
  ]);
}

console.log(`A/B sheet  ${STYLES.join(' → ')}  → ${path.relative(process.cwd(), ab)}`);
