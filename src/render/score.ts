/**
 * Arranged music beds: a chord progression with a piano arpeggio, a soft kick and shaker, a sub bass
 * and a short motif, laid out in sections that follow the episode's scenes. The hook gets a lighter
 * groove, the body the full one, scene changes get a quiet riser, and the outro drops the drums and
 * lands on the home chord. Everything is synthesised or sampled locally (CC0 piano), so there are no
 * licensing questions, and it is seeded, so the same episode always renders the same bed.
 *
 * This module only fills sample buffers; `synthesizePad` in media.ts loads the piano samples, then
 * fades, normalises and writes the result.
 */

export const SCORE_STYLES = ['orbit', 'nebula', 'meteor'] as const;
export type ScoreStyle = (typeof SCORE_STYLES)[number];
export const isScoreStyle = (s: string): s is ScoreStyle => (SCORE_STYLES as readonly string[]).includes(s);

/** A voicing: the bass note, then the upper tones (MIDI). */
type Chord = { bass: number; upper: number[] };

/** Progressions in C major / A minor; the variant's transpose moves them. */
const PROGRESSIONS: Record<string, Chord[]> = {
  // vi – IV – I – V with added ninths and sixths: warm, a little wistful.
  heartland: [
    { bass: 45, upper: [60, 64, 67, 71] },
    { bass: 41, upper: [57, 60, 64, 67] },
    { bass: 48, upper: [60, 62, 64, 67] },
    { bass: 43, upper: [59, 62, 64, 67] },
  ],
  // IV – V – iii – vi: lifts, then settles.
  lift: [
    { bass: 41, upper: [57, 60, 64, 67] },
    { bass: 43, upper: [59, 62, 67, 69] },
    { bass: 40, upper: [59, 62, 64, 67] },
    { bass: 45, upper: [60, 64, 67, 71] },
  ],
  // i – VI – III – VII in D minor: cinematic, for explainers.
  voyage: [
    { bass: 38, upper: [57, 60, 64, 65] },
    { bass: 46, upper: [58, 62, 65, 69] },
    { bass: 41, upper: [57, 60, 65, 69] },
    { bass: 48, upper: [55, 60, 64, 67] },
  ],
  // I – V – vi – IV: bright and forward, for reminders.
  spark: [
    { bass: 48, upper: [60, 64, 67, 72] },
    { bass: 43, upper: [59, 62, 67, 71] },
    { bass: 45, upper: [60, 64, 69, 72] },
    { bass: 41, upper: [60, 65, 69, 72] },
  ],
};

type Recipe = {
  bpm: number;
  /** Progressions the seed picks from. */
  progressions: (keyof typeof PROGRESSIONS)[];
  barsPerChord: number;
  /** Arpeggio: indices into the chord's upper tones plus their octave, one per step. */
  arp: number[][];
  arpStepsPerBeat: number;
  arpOctave: number;
  arpGain: number;
  /** How long an arpeggio note rings before its damper falls (seconds). */
  arpRing: number;
  chordGain: number;
  bassGain: number;
  subGain: number;
  padGain: number;
  /** Beats of the bar (0..3) the kick plays in the full groove, and in the lighter hook groove. */
  kick: number[];
  kickHook: number[];
  kickGain: number;
  /** Shaker steps per beat in the full groove (0 = none). */
  shaker: number;
  shakerGain: number;
  /** Sidechain depth: how far the kick pushes the melodic instruments down. */
  pump: number;
  /** Motif rhythm (beats) and melody (indices into the upper tones, +12). */
  motifs: { at: number[]; notes: number[] }[];
  motifGain: number;
  reverb: number;
  riserGain: number;
};

const RECIPE: Record<ScoreStyle, Recipe> = {
  // Sky This Week: a mid-tempo groove under the guide, steady but never pushy.
  orbit: {
    bpm: 92,
    progressions: ['heartland', 'lift'],
    barsPerChord: 1,
    arp: [
      [0, 2, 4, 2, 5, 3, 6, 3],
      [0, 3, 5, 6, 7, 6, 5, 3],
      [1, 4, 2, 5, 3, 6, 4, 7],
    ],
    arpStepsPerBeat: 2,
    arpOctave: 0,
    arpGain: 0.2,
    arpRing: 0.9,
    chordGain: 0.16,
    bassGain: 0.36,
    subGain: 0.07,
    padGain: 0.028,
    kick: [0, 2, 2.5],
    kickHook: [0, 2],
    kickGain: 0.36,
    shaker: 2,
    shakerGain: 0.05,
    pump: 0.32,
    motifs: [
      { at: [0, 0.75, 1.5, 2.5], notes: [3, 2, 1, 2] },
      { at: [0, 1, 1.5, 3], notes: [2, 3, 4, 3] },
    ],
    motifGain: 0.2,
    reverb: 0.3,
    riserGain: 0.05,
  },
  // Sky School: slower, wider and more cinematic; a half-time kick and a rolling arpeggio.
  nebula: {
    bpm: 78,
    progressions: ['voyage', 'heartland'],
    barsPerChord: 1,
    arp: [
      [0, 2, 4, 6, 7, 6, 4, 2],
      [0, 4, 2, 6, 3, 7, 4, 6],
    ],
    arpStepsPerBeat: 2,
    arpOctave: 0,
    arpGain: 0.2,
    arpRing: 1.4,
    chordGain: 0.15,
    bassGain: 0.34,
    subGain: 0.065,
    padGain: 0.04,
    kick: [0, 2.5],
    kickHook: [0],
    kickGain: 0.32,
    shaker: 2,
    shakerGain: 0.032,
    pump: 0.25,
    motifs: [
      { at: [0, 1.5, 2, 3], notes: [3, 4, 3, 1] },
      { at: [0, 0.5, 1, 2.5], notes: [1, 2, 3, 2] },
    ],
    motifGain: 0.19,
    reverb: 0.42,
    riserGain: 0.055,
  },
  // Sky Tonight: brighter and quicker, for a same-day reminder.
  meteor: {
    bpm: 104,
    progressions: ['spark', 'lift'],
    barsPerChord: 1,
    arp: [
      [0, 1, 2, 3, 4, 3, 2, 1],
      [0, 2, 4, 6, 4, 2, 5, 3],
    ],
    arpStepsPerBeat: 2,
    arpOctave: 0,
    arpGain: 0.2,
    arpRing: 0.7,
    chordGain: 0.15,
    bassGain: 0.38,
    subGain: 0.07,
    padGain: 0.024,
    kick: [0, 1, 2, 3],
    kickHook: [0, 2],
    kickGain: 0.3,
    shaker: 4,
    shakerGain: 0.04,
    pump: 0.35,
    motifs: [{ at: [0, 0.5, 1, 1.5], notes: [2, 3, 4, 3] }],
    motifGain: 0.19,
    reverb: 0.26,
    riserGain: 0.05,
  },
};

export interface PianoNote {
  left: Float32Array;
  right: Float32Array;
  /** Playback rate relative to the sample's root. */
  ratio: number;
}

export interface ScoreInput {
  style: ScoreStyle;
  seconds: number;
  sampleRate: number;
  seed: number;
  transpose: number;
  /** Scene start times in seconds (the first is 0). Sections and risers follow them. */
  cues: number[];
  piano: (midi: number) => PianoNote;
}

/** Every MIDI note a style can ask the piano for, so the caller can load the samples first. */
export function scoreNotes(style: ScoreStyle, transpose: number): number[] {
  const r = RECIPE[style];
  const out = new Set<number>();
  for (const name of r.progressions) {
    for (const c of PROGRESSIONS[name]) {
      out.add(c.bass + transpose);
      out.add(c.bass + 12 + transpose);
      for (const m of c.upper) {
        out.add(m + transpose);
        out.add(m + 12 + transpose);
        out.add(m + 12 + r.arpOctave + transpose);
        out.add(m + 24 + transpose);
      }
    }
  }
  return [...out];
}

/** Fill a stereo buffer with the arranged bed. Returns [left, right] of length ceil((seconds + 2) * sr). */
export function renderScore(input: ScoreInput): [Float32Array, Float32Array] {
  const r = RECIPE[input.style];
  const sr = input.sampleRate;
  const dur = input.seconds + 2;
  const n = Math.ceil(dur * sr);
  // Two buses: melodic (pumped by the kick, sent to the reverb) and drums.
  const melL = new Float32Array(n);
  const melR = new Float32Array(n);
  const drL = new Float32Array(n);
  const drR = new Float32Array(n);
  const at = (sec: number) => Math.floor(sec * sr);
  const pan = (p: number) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)] as const;
  const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
  const rnd = (salt: number): number => {
    const x = Math.sin((salt + input.seed * 1009) * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const beat = 60 / r.bpm;
  const bar = beat * 4;
  const prog = PROGRESSIONS[r.progressions[input.seed % r.progressions.length]].map((c) => ({
    bass: c.bass + input.transpose,
    upper: c.upper.map((m) => m + input.transpose),
  }));
  const arp = r.arp[Math.floor(input.seed / r.progressions.length) % r.arp.length];
  const motif = r.motifs[input.seed % r.motifs.length];

  // Sections, from the scene cues: the hook (first scene), the body, and the outro (last scene).
  const cues = input.cues.length > 0 ? [...input.cues].sort((a, b) => a - b) : [0];
  const hookEnd = cues[1] ?? Math.min(input.seconds, 4);
  const outroStart = cues.length > 2 ? cues[cues.length - 1] : input.seconds - 4;
  // The last chord lands on a downbeat ~3 s before the end and rings out.
  const finalAt = Math.max(outroStart, Math.floor((input.seconds - 2.6) / bar) * bar);
  const section = (t: number): 'hook' | 'body' | 'outro' | 'end' =>
    t >= finalAt ? 'end' : t < hookEnd - 1e-3 ? 'hook' : t >= outroStart - 1e-3 ? 'outro' : 'body';

  const piano = (t0: number, midi: number, gain: number, panPos: number, ring = Infinity, busL = melL, busR = melR) => {
    const note = input.piano(midi);
    const [gl, gr] = pan(panPos);
    const start = at(t0);
    const last = note.left.length - 2;
    const release = Math.floor(0.25 * sr);
    const ringN = Number.isFinite(ring) ? Math.floor(ring * sr) : Infinity;
    for (let j = 0, i = start, k = 0; i < n; i++, k++, j += note.ratio) {
      const idx = Math.floor(j);
      if (idx >= last || k > ringN + release) break;
      const fr = j - idx;
      const env = k > ringN ? 1 - (k - ringN) / release : 1;
      const s = env * gain;
      busL[i] += (note.left[idx] * (1 - fr) + note.left[idx + 1] * fr) * s * gl;
      busR[i] += (note.right[idx] * (1 - fr) + note.right[idx + 1] * fr) * s * gr;
    }
  };

  const kicks: number[] = [];
  const kick = (t0: number, gain: number) => {
    kicks.push(t0);
    const s0 = at(t0);
    let ph = 0;
    for (let i = s0; i < Math.min(n, s0 + at(0.45)); i++) {
      const t = (i - s0) / sr;
      const f = 46 + 90 * Math.exp(-t / 0.03);
      ph += (2 * Math.PI * f) / sr;
      const env = Math.min(1, t / 0.002) * Math.exp(-t / 0.2);
      const v = Math.sin(ph) * env * gain;
      drL[i] += v;
      drR[i] += v;
    }
  };

  let noiseState = 0x9e3779b9 ^ input.seed;
  const noise = () => {
    noiseState ^= noiseState << 13;
    noiseState ^= noiseState >>> 17;
    noiseState ^= noiseState << 5;
    return ((noiseState >>> 0) / 4294967296) * 2 - 1;
  };
  const shaker = (t0: number, gain: number, panPos: number) => {
    const s0 = at(t0);
    const [gl, gr] = pan(panPos);
    let prev = 0;
    let prev2 = 0;
    for (let i = s0; i < Math.min(n, s0 + at(0.09)); i++) {
      const t = (i - s0) / sr;
      // Two first-order differences: a cheap high-pass that leaves only the "sss".
      const x = noise();
      const hp = x - 2 * prev + prev2;
      prev2 = prev;
      prev = x;
      const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.025);
      const v = hp * 0.35 * env * gain;
      drL[i] += v * gl;
      drR[i] += v * gr;
    }
  };

  const sub = (t0: number, midi: number, length: number, gain: number) => {
    const f = midiHz(midi);
    const s0 = at(t0);
    for (let i = s0; i < Math.min(n, s0 + at(length)); i++) {
      const t = (i - s0) / sr;
      const env = Math.min(1, t / 0.01) * Math.min(1, (length - t) / 0.08) * Math.exp(-t / (length * 0.8));
      const v = Math.sin(2 * Math.PI * f * t) * env * gain;
      melL[i] += v;
      melR[i] += v;
    }
  };

  const pad = (t0: number, length: number, chord: Chord) => {
    chord.upper.forEach((m, vi) => {
      for (const [det, side] of [
        [-0.0015, -0.5],
        [0.0015, 0.5],
      ] as const) {
        const f = midiHz(m) * (1 + det);
        const [gl, gr] = pan(side);
        const s0 = at(t0);
        for (let i = s0; i < Math.min(n, s0 + at(length + 0.6)); i++) {
          const t = (i - s0) / sr;
          const env = Math.min(1, t / 0.6) * Math.min(1, Math.max(0, (length + 0.6 - t) / 0.6));
          const wob = 1 + 0.05 * Math.sin(2 * Math.PI * (0.11 + vi * 0.03) * t);
          const ph = 2 * Math.PI * f * t;
          const v = (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) * r.padGain * env * wob;
          melL[i] += v * gl;
          melR[i] += v * gr;
        }
      }
    });
  };

  /** Filtered noise that swells into a cue: the ear hears "something changes here". */
  const riser = (end: number, length: number, gain: number) => {
    const s0 = at(Math.max(0, end - length));
    const s1 = Math.min(n, at(end));
    let lp = 0;
    for (let i = s0; i < s1; i++) {
      const k = (i - s0) / Math.max(1, s1 - s0);
      const cutoff = 0.02 + 0.25 * k * k;
      lp += cutoff * (noise() - lp);
      const v = lp * gain * k * k * 2.2;
      const [gl, gr] = pan(Math.sin(k * 6) * 0.4);
      drL[i] += v * gl;
      drR[i] += v * gr;
    }
  };

  /** A soft low boom with an airy tail where the hook hands over to the body. */
  const impact = (t0: number, midi: number, gain: number) => {
    const s0 = at(t0);
    const f = midiHz(midi);
    let lp = 0;
    for (let i = s0; i < Math.min(n, s0 + at(2.4)); i++) {
      const t = (i - s0) / sr;
      const boom = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.7);
      lp += 0.06 * (noise() - lp);
      const air = lp * Math.exp(-t / 0.9) * 0.8;
      const env = Math.min(1, t / 0.005);
      drL[i] += (boom + air) * env * gain;
      drR[i] += (boom - air * 0.4) * env * gain;
    }
  };

  // ----------------------------------------------------------------- arrangement
  for (let b = 0, t0 = 0; t0 < finalAt - 1e-6; b++, t0 = b * bar) {
    const chord = prog[Math.floor(b / r.barsPerChord) % prog.length];
    const sec = section(t0);
    const firstOfChord = b % r.barsPerChord === 0;
    const human = (salt: number) => (rnd(salt) - 0.5) * 0.012;

    if (firstOfChord) {
      pad(t0, bar * r.barsPerChord, chord);
      // Chord, rolled like a hand would, and the bass under it.
      chord.upper.forEach((m, k) =>
        piano(t0 + k * 0.018 + human(b * 7 + k), m, r.chordGain * (0.85 + 0.15 * rnd(b * 3 + k)), (k - 1.5) * 0.3),
      );
      piano(t0, chord.bass, r.bassGain, -0.1);
    }

    // Arpeggio over chord tones and their octave.
    const pool = [...chord.upper, ...chord.upper.map((m) => m + 12)].map((m) => m + r.arpOctave);
    const steps = 4 * r.arpStepsPerBeat;
    {
      for (let s = 0; s < steps; s++) {
        // The outro thins the arpeggio to every other note.
        if (sec === 'outro' && s % 2 === 1) continue;
        const ts = t0 + (s * beat) / r.arpStepsPerBeat + human(b * 31 + s);
        const accent = s % r.arpStepsPerBeat === 0 ? 1 : 0.78;
        const g = r.arpGain * accent * (0.85 + 0.15 * rnd(b * 13 + s)) * (sec === 'hook' ? 0.85 : 1);
        piano(ts, pool[arp[s % arp.length] % pool.length], g, s % 2 === 0 ? 0.35 : -0.35, r.arpRing);
      }
    }

    // Groove.
    if (sec === 'hook' || sec === 'body') {
      const kicksHere = sec === 'hook' ? r.kickHook : r.kick;
      for (const k of kicksHere) kick(t0 + k * beat, r.kickGain * (k === 0 ? 1 : 0.8));
      for (const k of kicksHere) sub(t0 + k * beat, chord.bass - 12, beat * 0.9, r.subGain);
      if (sec === 'body' && r.shaker > 0) {
        for (let s = 0; s < 4 * r.shaker; s++) {
          const off = s % 2 === 1;
          shaker(
            t0 + (s * beat) / r.shaker + human(b * 17 + s),
            r.shakerGain * (off ? 1 : 0.55) * (0.8 + 0.2 * rnd(b * 19 + s)),
            off ? 0.3 : -0.3,
          );
        }
      }
    }

    // Motif: every other bar in the body, high and light, so it reads as a tune and not a loop.
    if (sec === 'body' && b % 2 === 1) {
      motif.at.forEach((a, k) => {
        const m =
          chord.upper[motif.notes[k] % chord.upper.length] + 12 * (motif.notes[k] >= chord.upper.length ? 2 : 1);
        piano(t0 + a * beat, m, r.motifGain, 0.15, 1.6);
      });
    }
  }

  // Scene changes: a riser into each, and a soft impact where the hook hands over.
  cues.slice(1).forEach((c, i) => {
    if (c >= finalAt) return;
    riser(c, i === 0 ? 1.6 : 1.1, r.riserGain * (i === 0 ? 1.3 : 1));
  });
  if (cues[1] !== undefined && cues[1] < finalAt) impact(cues[1], prog[0].bass - 12, 0.12);

  // The ending: the home chord, struck full, with its bass, ringing into the fade.
  {
    const home = prog[0];
    home.upper.forEach((m, k) => piano(finalAt + k * 0.03, m, r.chordGain * 1.15, (k - 1.5) * 0.3));
    home.upper.forEach((m, k) => piano(finalAt + 0.12 + k * 0.05, m + 12, r.chordGain * 0.55, (1.5 - k) * 0.3));
    piano(finalAt, home.bass, r.bassGain, 0);
    pad(finalAt, input.seconds + 2 - finalAt, home);
  }

  // Sidechain: each kick briefly pushes the melodic bus down, which gives the groove its breath.
  if (r.pump > 0 && kicks.length) {
    kicks.sort((a, b) => a - b);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      while (k + 1 < kicks.length && kicks[k + 1] <= t) k++;
      const dt = t - kicks[k];
      if (dt < 0 || dt > 0.5) continue;
      const g = 1 - r.pump * Math.exp(-dt / 0.11) * Math.min(1, dt / 0.004 + 0.6);
      melL[i] *= g;
      melR[i] *= g;
    }
  }

  // Reverb on the melodic bus (Schroeder: four combs and two all-passes per side).
  const [wetL, wetR] = reverb(melL, melR, sr);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    left[i] = melL[i] + wetL[i] * r.reverb + drL[i] + wetL[i] * 0.04;
    right[i] = melR[i] + wetR[i] * r.reverb + drR[i] + wetR[i] * 0.04;
  }
  return [left, right];
}

function reverb(inL: Float32Array, inR: Float32Array, sr: number): [Float32Array, Float32Array] {
  const scale = sr / 44100;
  const side = (input: Float32Array, spread: number): Float32Array => {
    const n = input.length;
    const out = new Float32Array(n);
    for (const d0 of [1116, 1188, 1277, 1356, 1422, 1491]) {
      const d = Math.floor((d0 + spread) * scale * 1.5);
      const buf = new Float32Array(d);
      let idx = 0;
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const y = buf[idx];
        lp = y * 0.7 + lp * 0.3;
        buf[idx] = input[i] * 0.5 + lp * 0.84;
        out[i] += y / 6;
        idx = (idx + 1) % d;
      }
    }
    for (const d0 of [556, 441, 341]) {
      const d = Math.floor((d0 + spread) * scale);
      const buf = new Float32Array(d);
      let idx = 0;
      for (let i = 0; i < n; i++) {
        const b = buf[idx];
        const x = out[i];
        buf[idx] = x + b * 0.5;
        out[i] = b - x * 0.5;
        idx = (idx + 1) % d;
      }
    }
    return out;
  };
  return [side(inL, 0), side(inR, 23)];
}
