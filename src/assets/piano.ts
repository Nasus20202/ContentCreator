/**
 * The piano samples the music bed plays (see `assets/audio/piano/README.md`).
 *
 * Source: the FreePats "Upright Piano KW" sound bank (a Kawai upright, recorded by Gonzalo and
 * Roberto, Jan 2017), published under CC0 1.0 — no attribution required. The bank is a 7z archive;
 * this module downloads it once, extracts the FLAC samples into `.cache/` (gitignored), and cuts
 * the trimmed mp3s the bed reads. Extraction needs the `7z` command on PATH.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { paths } from '../core/paths';

const run = promisify(execFile);

export const PIANO_ARCHIVE_URL =
  'https://freepats.zenvoid.org/Piano/UprightPianoKW/UprightPianoKW-SFZ+FLAC-20220221.7z';
const ARCHIVE_NAME = 'UprightPianoKW-SFZ+FLAC-20220221';
export const PIANO_LOW = 33; // A1
export const PIANO_HIGH = 87; // D#6
export const PIANO_STEP = 3; // the bank's own sample spacing
/** Bed velocity layers: 4 = soft (vL), 12 = hard (vH). The bank has no vH for A2 and C4; those fall back to vL. */
export const PIANO_LAYERS = [4, 12] as const;
export const PIANO_SECONDS = 5.5;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const sampleName = (midi: number): string => NOTE_NAMES[midi % 12] + String(Math.floor(midi / 12) - 1);

export const pianoDir = (): string => path.join(paths.root, 'assets', 'audio', 'piano');
export const pianoCacheDir = (): string => path.join(paths.root, '.cache', 'piano-kw');

/** Every (root, layer) the bed can ask for. */
export function pianoFiles(): { midi: number; layer: number; file: string }[] {
  const out: { midi: number; layer: number; file: string }[] = [];
  for (let midi = PIANO_LOW; midi <= PIANO_HIGH; midi += PIANO_STEP) {
    for (const layer of PIANO_LAYERS) out.push({ midi, layer, file: path.join(pianoDir(), `${midi}_v${layer}.mp3`) });
  }
  return out;
}

let ensuring: Promise<void> | undefined;

/**
 * Make sure every piano sample exists on disk. Idempotent and memoised per process: files that are
 * already present are left alone; the archive is only downloaded and extracted when a cut is missing.
 */
export function ensurePianoSamples(fetchImpl: typeof fetch = fetch): Promise<void> {
  ensuring ??= doEnsure(fetchImpl).catch((err) => {
    ensuring = undefined;
    throw err;
  });
  return ensuring;
}

async function doEnsure(fetchImpl: typeof fetch): Promise<void> {
  const missing = pianoFiles().filter((f) => !fs.existsSync(f.file));
  if (missing.length === 0) return;
  fs.mkdirSync(pianoDir(), { recursive: true });
  const src = await extractedBank(fetchImpl);
  for (const { midi, layer, file } of missing) {
    const wanted = path.join(src, `${sampleName(midi)}v${layer === 12 ? 'H' : 'L'}.flac`);
    const fallback = path.join(src, `${sampleName(midi)}vL.flac`);
    const input = fs.existsSync(wanted) ? wanted : fallback;
    if (!fs.existsSync(input)) throw new Error(`piano bank has no sample for ${sampleName(midi)}`);
    await run('ffmpeg', [
      '-hide_banner',
      '-v',
      'error',
      '-y',
      '-i',
      input,
      '-t',
      String(PIANO_SECONDS),
      '-af',
      // Top-octave hiss from the room and preamp is not piano: cut above 7 kHz and below 40 Hz.
      `highpass=f=40,lowpass=f=7000,afade=t=out:st=${PIANO_SECONDS - 0.6}:d=0.6`,
      '-ar',
      '44100',
      '-ac',
      '2',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '160k',
      file,
    ]);
  }
}

/** Download the archive into the cache once, extract it, and return the folder with the samples. */
async function extractedBank(fetchImpl: typeof fetch): Promise<string> {
  const cache = pianoCacheDir();
  const bank = path.join(cache, ARCHIVE_NAME, 'samples');
  if (fs.existsSync(bank)) return bank;
  fs.mkdirSync(cache, { recursive: true });
  const archive = path.join(cache, `${ARCHIVE_NAME}.7z`);
  if (!fs.existsSync(archive)) {
    const res = await fetchImpl(PIANO_ARCHIVE_URL);
    if (!res.ok) throw new Error(`piano bank download: HTTP ${res.status} from ${PIANO_ARCHIVE_URL}`);
    fs.writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
  }
  try {
    await run('7z', ['x', '-y', `-o${cache}`, archive]);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(
        'extracting the piano bank needs the 7z command (apt install p7zip-full / brew install sevenzip)',
        {
          cause: err,
        },
      );
    }
    throw err;
  }
  return bank;
}
