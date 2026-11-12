/** ffmpeg / ffprobe wrappers. Both binaries are required on PATH (see docs/setup.md). */
import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';
import { z } from 'zod';
import { ensurePianoSamples, pianoDir } from '../assets/piano';

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

/** Beds on the same harmony, chosen per series or per episode in the plan. */
export type MusicStyle = 'piano' | 'piano-pulse' | 'piano-air';

/** The bed a series gets unless its plan pins `music.style`. */
export const SERIES_BED: Record<string, MusicStyle> = {
  'sky-this-week': 'piano',
  'sky-tonight': 'piano-pulse',
  'sky-school': 'piano-air',
};

export const bedFor = (series: string): MusicStyle => SERIES_BED[series] ?? 'piano';

type Recipe = {
  /** Seconds per chord. */
  bar: number;
  /** Register offset added to the upper chord tones. */
  octave: number;
  /** Bass notes as seconds inside the bar (0 = the downbeat). */
  bassBeats: number[];
  noteGain: number;
  /**
   * Piano beds: how hard the keys are struck, 0..1. Chooses the soft or the medium sample layer
   * and scales it, so the two layers are never audible as a switch.
   */
  velocity: number;
  /** Piano beds: seconds inside the bar where the whole chord is struck (pedal down). */
  chordAt: number[];
  /** Piano beds: seconds inside the bar where one upper tone is picked out above the chord. */
  melodyAt: number[];
  /** Piano beds: milliseconds of roll between the notes of one chord — a hand, not a machine. */
  spread: number;
  padGain: number;
  /** Depth of the pad's slow tremolo; 0 keeps it dead still. */
  padWobble: number;
  subGain: number;
  pulseGain: number;
  echo: [number, number, number];
  /** Multiplies the echo delays: bigger values read as a bigger room. */
  echoTime: number;
};

const RECIPE: Record<MusicStyle, Recipe> = {
  // Sustained felt-piano chords with one picked-out note per bar: the default house sound.
  piano: {
    bar: 4,
    octave: 0,
    bassBeats: [0],
    noteGain: 0.3,
    velocity: 0.5,
    chordAt: [0],
    melodyAt: [2.6],
    spread: 26,
    padGain: 0.04,
    padWobble: 0.03,
    subGain: 0.01,
    pulseGain: 0,
    echo: [0.2, 0.13, 0.08],
    echoTime: 1,
  },
  // Chords on every half bar and a firmer bass: momentum for reminders, still piano.
  'piano-pulse': {
    bar: 4,
    octave: 0,
    bassBeats: [0, 2],
    noteGain: 0.26,
    velocity: 0.68,
    chordAt: [0, 2],
    melodyAt: [1, 3],
    spread: 14,
    padGain: 0.035,
    padWobble: 0,
    subGain: 0.012,
    pulseGain: 0,
    echo: [0.18, 0.11, 0.07],
    echoTime: 1,
  },
  // Eight-second chords an octave up, nothing on top: airier, more cinematic.
  'piano-air': {
    bar: 8,
    octave: 12,
    bassBeats: [0],
    noteGain: 0.34,
    velocity: 0.34,
    chordAt: [0],
    melodyAt: [],
    spread: 34,
    padGain: 0.045,
    padWobble: 0.05,
    subGain: 0.008,
    pulseGain: 0,
    echo: [0.26, 0.19, 0.13],
    echoTime: 1.25,
  },
};

/** Sample roots in `assets/audio/piano`: every three semitones from A1 to D#6 (see prepare-piano). */
const PIANO_LOW = 33;
const PIANO_HIGH = 87;
const PIANO_STEP = 3;
const pianoRoots = (): number[] => {
  const out: number[] = [];
  for (let m = PIANO_LOW; m <= PIANO_HIGH; m += PIANO_STEP) out.push(m);
  return out;
};

type Decoded = { left: Float32Array; right: Float32Array };

/**
 * ffmpeg writing raw PCM to stdout. `ffmpeg()` returns text, which corrupts float32 audio.
 */
async function ffmpegBytes(args: string[]): Promise<Buffer> {
  const { stdout } = await run('ffmpeg', ['-hide_banner', '-v', 'error', ...args], {
    encoding: 'buffer',
    maxBuffer: 256 * 1024 * 1024,
  });
  return stdout;
}

const decodedPiano = new Map<string, Decoded>();

/**
 * Decode one sample from `assets/audio/piano` and peak-normalise it, so the layer's recorded level
 * cannot change the bed: the recipe decides how hard the key is struck, not the sample.
 */
async function loadPiano(root: number, layer: 4 | 12): Promise<Decoded> {
  const key = `${root}_v${layer}`;
  const hit = decodedPiano.get(key);
  if (hit) return hit;
  await ensurePianoSamples();
  const file = path.join(pianoDir(), `${key}.mp3`);
  const raw = await ffmpegBytes(['-i', file, '-f', 'f32le', '-ac', '2', '-ar', '44100', '-']);
  const frames = raw.length / 8;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    const l = raw.readFloatLE(i * 8);
    const r = raw.readFloatLE(i * 8 + 4);
    left[i] = l;
    right[i] = r;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }
  if (peak > 0) {
    for (let i = 0; i < frames; i++) {
      left[i] /= peak;
      right[i] /= peak;
    }
  }
  const out = { left, right };
  decodedPiano.set(key, out);
  return out;
}

export interface BedVariant {
  /** Changes the note timing and velocities (humanisation) without changing the harmony. */
  seed?: number;
  /** Transposes the whole bed in semitones (−6..+6). */
  transpose?: number;
}

/**
 * Music bed synthesised locally (no licensing questions): a slow Am–F–C–G progression over a steady
 * detuned pad and sub, with a sampled felt piano playing the chord tones (see RECIPE), plus a few
 * stereo echoes for space. Seeded, so re-renders are identical.
 */
export async function synthesizePad(
  out: string,
  seconds: number,
  style: MusicStyle = 'piano',
  variant: BedVariant = {},
): Promise<void> {
  const recipe = RECIPE[style];
  const seedOffset = (variant.seed ?? 0) * 1009;
  const shift = variant.transpose ?? 0;
  const sr = 44100;
  const dur = seconds + 2;
  const n = Math.ceil(dur * sr);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
  const pan = (p: number) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)] as const;
  const add = (i: number, l: number, r: number) => {
    if (i < 0 || i >= n) return;
    left[i] += l;
    right[i] += r;
  };

  // Am – F – C – G, one chord per bar, overlapping into the next.
  const chords = [
    [45, 57, 60, 64],
    [41, 53, 57, 60],
    [48, 55, 60, 64],
    [43, 50, 55, 59],
  ].map((c) => c.map((m) => m + shift));
  const bar = recipe.bar;
  const at = (sec: number) => Math.floor(sec * sr);

  // Humanisation is hashed from the note's position, not drawn from a stream, so the same episode
  // always renders the same bed.
  const rnd = (salt: number): number => {
    const x = Math.sin((salt + seedOffset) * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  // Sampled piano. One sample every three semitones is resampled for the notes in between, which
  // is what a sampler does: up a semitone shortens the tail and brightens the tone.
  const roots = pianoRoots();
  const layer: 4 | 12 = recipe.velocity >= 0.75 ? 12 : 4;
  const notes = new Map<number, Decoded & { ratio: number }>();
  {
    const wanted = new Set<number>();
    for (const chord of chords) {
      wanted.add(chord[0]);
      for (const m of chord.slice(1)) {
        wanted.add(m + recipe.octave);
        if (recipe.melodyAt.length > 0) wanted.add(m + recipe.octave + 12);
      }
    }
    for (const midi of wanted) {
      const root = roots.reduce((best, r) => (Math.abs(r - midi) < Math.abs(best - midi) ? r : best), roots[0]);
      const sample = await loadPiano(root, layer);
      notes.set(midi, { ...sample, ratio: 2 ** ((midi - root) / 12) });
    }
  }
  const playPiano = (startSample: number, midi: number, gain: number, panPos: number) => {
    const note = notes.get(midi);
    if (!note) return;
    const [gl, gr] = pan(panPos);
    const last = note.left.length - 2;
    for (let j = 0, i = startSample; i < n; i++, j += note.ratio) {
      const idx = Math.floor(j);
      if (idx >= last) break;
      const fr = j - idx;
      const l = (note.left[idx] * (1 - fr) + note.left[idx + 1] * fr) * gain * gl;
      const r = (note.right[idx] * (1 - fr) + note.right[idx + 1] * fr) * gain * gr;
      add(i, l, r);
    }
  };

  for (let start = 0, barIndex = 0; start < dur; start += bar, barIndex++) {
    const chord = chords[barIndex % chords.length];

    // Pad: two detuned sines plus a quiet third harmonic per note, slow swell in and out.
    chord.forEach((m, vi) => {
      for (const [det, side] of [
        [-0.0012, -0.35],
        [0.0012, 0.35],
      ] as const) {
        const f = midiHz(m) * (1 + det);
        const [gl, gr] = pan(side);
        for (let i = at(start); i < Math.min(n, at(start + bar + 2.2)); i++) {
          const t = i / sr - start;
          // Piano beds get a steady pad (short cross-fades between chords) so the bed never drops
          // out between notes.
          const env = Math.min(1, t / 1) * Math.min(1, Math.max(0, (bar + 1 - t) / 1));
          const wobble = 1 + recipe.padWobble * Math.sin(2 * Math.PI * (0.05 + vi * 0.013) * t);
          const ph = 2 * Math.PI * f * t;
          const s = (Math.sin(ph) + 0.16 * Math.sin(3 * ph)) * recipe.padGain * env * wobble;
          add(i, s * gl, s * gr);
        }
      }
    });

    // Sub: the chord root an octave down, barely there.
    const sub = midiHz(chord[0] - 12);
    for (let i = at(start); i < Math.min(n, at(start + bar + 2.2)); i++) {
      const t = i / sr - start;
      const env = Math.min(1, t / 2) * Math.min(1, Math.max(0, (bar + 2.2 - t) / 2.2));
      const s = Math.sin(2 * Math.PI * sub * t) * recipe.subGain * env;
      add(i, s, s);
    }

    {
      // Piano: the chord is struck and left to ring (pedal down), with a bass note underneath and
      // — depending on the style — one upper tone picked out between the chords.
      const upper = chord.slice(1);
      for (const beat of recipe.bassBeats) {
        playPiano(at(start + beat), chord[0], recipe.noteGain * 1.45, -0.15);
      }
      recipe.chordAt.forEach((beat, c) => {
        upper.forEach((m, k) => {
          // Roll the chord: the notes are not struck on the same millisecond.
          const offset = (k * recipe.spread) / 1000;
          const gain = recipe.noteGain * (0.72 + 0.1 * rnd(k + barIndex * 5 + c));
          playPiano(at(start + beat + offset), m + recipe.octave, gain, (k - 1) * 0.4);
        });
      });
      recipe.melodyAt.forEach((beat, k) => {
        const m = upper[(barIndex + k) % upper.length] + recipe.octave + 12;
        playPiano(at(start + beat), m, recipe.noteGain * 0.85, 0.3);
      });
    }

    // Pulse: a soft low thump on the downbeat and the half-bar, for the styles that want momentum.
    if (recipe.pulseGain > 0) {
      for (const beat of [0, bar / 2]) {
        const t0 = start + beat;
        const f = midiHz(chord[0] - 24);
        for (let i = at(t0); i < Math.min(n, at(t0 + 0.5)); i++) {
          const t = i / sr - t0;
          const env = Math.min(1, t / 0.006) * Math.exp(-t / 0.16);
          const s = Math.sin(2 * Math.PI * f * t) * recipe.pulseGain * env;
          add(i, s, s);
        }
      }
    }
  }

  // Space: three cross-panned echoes of the dry signal.
  const echo = (delaySec: number, gain: number, swap: boolean) => {
    const d = Math.floor(delaySec * sr);
    for (let i = n - 1; i >= d; i--) {
      if (swap) add(i, right[i - d] * gain, left[i - d] * gain);
      else add(i, left[i - d] * gain, right[i - d] * gain);
    }
  };
  echo(0.093 * recipe.echoTime, recipe.echo[0], false);
  echo(0.157 * recipe.echoTime, recipe.echo[1], true);
  echo(0.241 * recipe.echoTime, recipe.echo[2], false);

  // Fades, then peak-normalise only for headroom and fix the loudness afterwards: a struck piano
  // has a much higher crest factor than a sine, so equal peak would mean a different loudness.
  // Matching LUFS instead keeps `music.volume` meaning the same thing in every style.
  const fadeIn = Math.floor(2.5 * sr);
  const fadeOutStart = Math.floor((dur - 4) * sr);
  const fadeOut = Math.max(1, n - fadeOutStart);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    let g = 1;
    if (i < fadeIn) g = i / fadeIn;
    if (i > fadeOutStart) g *= (n - i) / fadeOut;
    left[i] *= g;
    right[i] *= g;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const norm = peak > 0 ? 0.95 / peak : 0;

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
