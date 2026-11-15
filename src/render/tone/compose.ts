/**
 * Music beds composed with Tone.js (samplers of recorded instruments, synths, effects) and tonal
 * (harmony), rendered offline in a headless browser by `render.ts`. Browser-only module: it is
 * bundled with esbuild and exposes `window.renderBed`.
 *
 * Every style follows the episode's scene cues: a lighter hook, the full groove in the body, a
 * thinner outro, and the home chord ringing out at the end. Seeded (including Math.random, which
 * Tone uses for noise), so a plan always renders the same bed.
 */
import * as Tone from 'tone';
import { Chord, Note, Scale } from 'tonal';

import { scoreEvents, type ScoreStyle } from '../score';
import { KAWAI, type ToneStyle } from './styles';

export interface BedSpec {
  style: ToneStyle;
  seconds: number;
  seed: number;
  transpose: number;
  cues: number[];
  sampleBase: string;
  samples: Record<string, string[]>;
}

type Sections = { hookEnd: number; outroStart: number; finalAt: number; bar: number; beat: number };

function sections(spec: BedSpec, bpm: number): Sections {
  const beat = 60 / bpm;
  const bar = beat * 4;
  const cues = spec.cues.length ? [...spec.cues].sort((a, b) => a - b) : [0];
  const hookEnd = cues[1] ?? Math.min(spec.seconds, 4);
  const outroStart = cues.length > 2 ? cues[cues.length - 1] : spec.seconds - 4;
  const finalAt = Math.max(bar, Math.floor((spec.seconds - 2.8) / bar) * bar);
  return { hookEnd, outroStart: Math.min(outroStart, finalAt), finalAt, bar, beat };
}

function rng(seed: number): () => number {
  let s = (seed * 2654435761 + 1013904223) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const shift = (n: string, semis: number): string => Note.fromMidi((Note.midi(n) ?? 60) + semis);

/** Chord symbol → note names voiced upward from `octave`, transposed by semitones. */
function voice(symbol: string, octave: number, transpose: number): string[] {
  const c = Chord.get(symbol);
  const root = `${c.tonic ?? 'C'}${octave}`;
  return c.intervals.map((iv) => shift(Note.transpose(root, iv), transpose));
}
const rootOf = (symbol: string, octave: number, transpose: number): string =>
  shift(`${Chord.get(symbol).tonic ?? 'C'}${octave}`, transpose);

function samplerUrls(files: string[]): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const f of files) urls[f.replace('.mp3', '').replace('s', '#')] = f;
  return urls;
}

function sampler(spec: BedSpec, inst: string, opts: Partial<Tone.SamplerOptions> = {}): Tone.Sampler {
  return new Tone.Sampler({
    urls: samplerUrls(spec.samples[inst] ?? []),
    baseUrl: `${spec.sampleBase}/${inst}/`,
    release: 1.2,
    ...opts,
  });
}

async function reverb(decay: number, wet: number): Promise<Tone.Reverb> {
  const r = new Tone.Reverb({ decay, wet, preDelay: 0.02 });
  await r.ready;
  return r;
}

/** Bus that ducks on every kick (the sidechain "pump"). */
function pumpBus(dest: Tone.InputNode, kicks: number[], depth: number): Tone.Gain {
  const g = new Tone.Gain(1).connect(dest);
  for (const k of kicks) {
    g.gain.setValueAtTime(1 - depth, k);
    g.gain.linearRampToValueAtTime(1, k + 0.22);
  }
  return g;
}

function drums(master: Tone.InputNode, opts: { snareTone?: boolean; dark?: boolean } = {}) {
  const out = opts.dark ? new Tone.Filter(4200, 'lowpass').connect(master) : master;
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.035,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.1 },
    volume: -6,
  }).connect(out);
  const snareVerb = new Tone.Reverb({ decay: 1.1, wet: 0.22 }).connect(out);
  const snare = new Tone.NoiseSynth({
    noise: { type: opts.dark ? 'pink' : 'white' },
    envelope: { attack: 0.001, decay: 0.17, sustain: 0 },
    volume: -13,
  }).chain(new Tone.Filter(opts.dark ? 1500 : 1900, 'bandpass'), snareVerb);
  const body = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 1.5,
    envelope: { attack: 0.001, decay: 0.09, sustain: 0 },
    volume: -16,
  }).connect(snareVerb);
  const hat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: opts.dark ? 0.03 : 0.035, sustain: 0 },
    volume: opts.dark ? -27 : -24,
  }).chain(new Tone.Filter(opts.dark ? 6500 : 8000, 'highpass'), out);
  const hitSnare = (t: number, v = 1) => {
    snare.triggerAttackRelease('16n', t, v);
    if (opts.snareTone) body.triggerAttackRelease('G2', '32n', t, v * 0.8);
  };
  return { kick, hitSnare, hat };
}

/** A soft, round kick: a sine thump with the click filtered off (no noise). */
function softKick(dest: Tone.InputNode, volume = -10): Tone.MembraneSynth {
  return new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    envelope: { attack: 0.004, decay: 0.32, sustain: 0, release: 0.1 },
    volume,
  }).chain(new Tone.Filter(240, 'lowpass', -24), dest);
}

type MelodyNote = { bar: number; at: number; dur: number; note: string };

/**
 * A singable line over a progression: chord tones on the strong beats, scale steps in between, an
 * arch per four-bar phrase (up, then home), ending each phrase on a chord tone. `rhythm` holds one
 * pattern per bar of [start, length] in beats. Untransposed; shift the notes by the episode's
 * transpose when playing them.
 */
function melody(
  prog: string[],
  key: string,
  octave: number,
  bars: number,
  rhythm: [number, number][][],
  r: () => number,
): MelodyNote[] {
  const scale = Scale.get(`${key} major`).notes.map((n) => Note.chroma(n));
  const base = Note.midi(`${key}${octave}`) ?? 72;
  const lo = base - 3;
  const hi = base + 14;
  let cur = base + 4;
  const out: MelodyNote[] = [];
  for (let b = 0; b < bars; b++) {
    const sym = prog[b % prog.length];
    const tones = Chord.get(sym).notes.map((n) => Note.chroma(n));
    const steps = rhythm[b % rhythm.length];
    const phrase = b % 4;
    const dir = phrase < 2 ? 1 : -1;
    steps.forEach(([at, dur], i) => {
      const strong = at % 2 === 0;
      const last = phrase === 3 && i === steps.length - 1;
      const allowed = strong || last ? tones : scale;
      const want = last ? base + (b % 8 === 7 ? 0 : 4) : cur + dir * (strong ? 2 + Math.floor(r() * 3) : 1);
      let best = cur;
      let bestD = Infinity;
      for (let m = lo; m <= hi; m++) {
        if (!allowed.includes(m % 12)) continue;
        const d = Math.abs(m - want) + (m === cur && !last ? 1.5 : 0);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      cur = best;
      out.push({ bar: b, at, dur, note: Note.fromMidi(best) });
    });
  }
  return out;
}

/** Fingerpicked guitar for one bar (Travis pattern: alternating bass, treble in between). */
function travis(guitar: Tone.Sampler, sym: string, t0: number, s: Sections, transpose: number, r: () => number) {
  const tri = voice(sym, 3, transpose);
  const bassA = rootOf(sym, 2, transpose);
  const bassB = shift(bassA, 7);
  const treble = [shift(tri[1], 12), shift(tri[2], 12), shift(tri[0], 12)];
  for (let e = 0; e < 8; e++) {
    const t = t0 + e * (s.beat / 2) + r() * 0.5 * 0.012;
    const v = 0.5 + 0.22 * r();
    if (e % 2 === 0) guitar.triggerAttackRelease(e % 4 === 0 ? bassA : bassB, s.beat * 1.6, t, v + 0.1);
    else guitar.triggerAttackRelease(treble[(e >> 1) % 3], s.beat * 1.2, t, v);
  }
}

type Composer = (spec: BedSpec, master: Tone.ToneAudioNode, r: () => number) => Promise<void>;
const forBars = (s: Sections, fn: (b: number, t0: number) => void) => {
  for (let b = 0, t0 = 0; t0 < s.finalAt - 1e-6; b++, t0 = b * s.bar) fn(b, t0);
};
const isBody = (s: Sections, t0: number) => t0 >= s.hookEnd && t0 < s.outroStart;
/** Lift any note below G3 an octave, so voicings sit in the middle register. */
const mid = (n: string): string => ((Note.midi(n) ?? 60) < 55 ? shift(n, 12) : n);

// ------------------------------------------------------------------ styles

/** One Shot / Sky School: fingerpicked acoustic guitar (Travis pattern), harp shimmer, violin line. */
const acoustic: Composer = async (spec, master, r) => {
  const s = sections(spec, 78);
  const prog = [
    ['D', 'A', 'Bm', 'G'],
    ['G', 'D', 'Em', 'C'],
  ][spec.seed % 2];
  const verb = await reverb(3.2, 0.3);
  verb.connect(master);
  const guitar = sampler(spec, 'guitar-acoustic', { release: 1.6, volume: -4 }).connect(verb);
  const harp = sampler(spec, 'harp', { release: 2, volume: -18 }).connect(verb);
  const violin = sampler(spec, 'violin', { attack: 0.4, release: 1.5, volume: -22 }).connect(verb);
  await Tone.loaded();
  forBars(s, (b, t0) => {
    const sym = prog[b % prog.length];
    const tri = voice(sym, 3, spec.transpose);
    for (let e = 0; e < 8; e++) {
      const t = t0 + e * (s.beat / 2) + r() * 0.5 * 0.012;
      const v = 0.55 + 0.25 * r();
      const bassA = rootOf(sym, 2, spec.transpose);
      const treble = [shift(tri[1], 12), shift(tri[2], 12), shift(tri[0], 12)];
      if (e % 2 === 0) guitar.triggerAttackRelease(e % 4 === 0 ? bassA : shift(bassA, 7), s.beat * 1.6, t, v + 0.1);
      else guitar.triggerAttackRelease(treble[(e >> 1) % 3], s.beat * 1.2, t, v);
    }
    if (isBody(s, t0)) {
      if (b % 2 === 1) violin.triggerAttackRelease(shift(tri[2], 12), s.bar * 0.95, t0, 0.5);
      harp.triggerAttackRelease(shift(tri[0], 24), s.beat, t0 + s.beat * 3.5, 0.45);
    }
  });
  const home = voice(prog[0], 3, spec.transpose);
  home.forEach((n, i) => guitar.triggerAttackRelease(n, 3, s.finalAt + i * 0.035, 0.7));
  guitar.triggerAttackRelease(rootOf(prog[0], 2, spec.transpose), 3, s.finalAt, 0.75);
  harp.triggerAttackRelease(shift(home[0], 24), 2.5, s.finalAt + 0.2, 0.5);
};

/**
 * Cosmic Top 5 / Weird Physics: a modern-classical pulse on real instruments. Repeating piano
 * eighths, pizzicato-style contrabass, mid-register harp and a low violin melody (nothing high-pitched) over a soft round kick that
 * gently pumps the mix. No synths, no noise drums.
 */
const pulse: Composer = async (spec, master, r) => {
  const s = sections(spec, 100);
  const [key, prog] = (
    [
      ['C', ['Am', 'F', 'C', 'G']],
      ['G', ['Em', 'C', 'G', 'D']],
    ] as const
  )[spec.seed % 2];
  const kicks: number[] = [];
  for (let t = 0; t < s.finalAt; t += s.beat) if (t >= s.hookEnd || Math.round(t / s.beat) % 2 === 0) kicks.push(t);
  const verb = await reverb(3, 0.3);
  verb.connect(master);
  const bus = pumpBus(verb, kicks, 0.3);
  const piano = sampler(spec, 'piano', { release: 1.2, volume: -6 }).chain(new Tone.Filter(4500, 'lowpass', -12), bus);
  const harp = sampler(spec, 'harp', { release: 2, volume: -16 }).connect(bus);
  const bass = sampler(spec, 'contrabass', { attack: 0.01, release: 0.25, volume: -6 }).connect(bus);
  const violin = sampler(spec, 'violin', { attack: 0.25, release: 1.6, volume: -10 }).chain(
    new Tone.Filter(3200, 'lowpass', -24),
    verb,
  );
  const kick = softKick(master, -9);
  await Tone.loaded();
  for (const k of kicks) kick.triggerAttackRelease('C2', '8n', k, k >= s.hookEnd ? 0.8 : 0.6);
  const bars = Math.round(s.finalAt / s.bar);
  const line = melody(
    [...prog],
    key,
    4,
    bars,
    [
      [
        [0, 2],
        [2, 1.5],
        [3.5, 0.5],
      ],
      [
        [0, 3],
        [3, 1],
      ],
      [
        [0, 1],
        [1, 1],
        [2, 2],
      ],
      [[0, 4]],
    ],
    r,
  );
  forBars(s, (b, t0) => {
    const sym = prog[b % prog.length];
    const tri = voice(sym, 4, spec.transpose);
    const body = isBody(s, t0);
    const pat = [tri[0], tri[1], tri[2], tri[1], shift(tri[0], 12), tri[2], tri[1], tri[2]];
    pat.forEach((n, i) =>
      piano.triggerAttackRelease(
        n,
        s.beat * 0.9,
        t0 + i * (s.beat / 2) + r() * 0.5 * 0.008,
        (i % 2 ? 0.32 : 0.45) + 0.08 * r(),
      ),
    );
    piano.triggerAttackRelease(rootOf(sym, 3, spec.transpose), s.bar, t0, 0.45);
    const root = rootOf(sym, 2, spec.transpose);
    if (body) {
      for (let e = 0; e < 8; e++)
        bass.triggerAttackRelease(
          e % 4 === 3 ? shift(root, 7) : root,
          s.beat * 0.35,
          t0 + e * (s.beat / 2),
          e % 2 ? 0.5 : 0.75,
        );
      for (const q of [3, 7, 11, 15]) harp.triggerAttackRelease(tri[(q >> 2) % 3], s.beat, t0 + q * (s.beat / 4), 0.3);
      for (const m of line.filter((x) => x.bar === b))
        violin.triggerAttackRelease(shift(m.note, spec.transpose), m.dur * s.beat * 0.95, t0 + m.at * s.beat, 0.6);
    } else {
      bass.triggerAttackRelease(root, s.beat * 1.5, t0, 0.6);
    }
  });
  const home = voice(prog[0], 4, spec.transpose);
  home.forEach((n, i) => piano.triggerAttackRelease(n, 3, s.finalAt + i * 0.04, 0.5));
  bass.triggerAttackRelease(rootOf(prog[0], 2, spec.transpose), 2.5, s.finalAt, 0.6);
  harp.triggerAttackRelease(home[0], 2.5, s.finalAt + 0.2, 0.4);
};

/**
 * Strings: a violin song. Piano broken chords and contrabass carry a slow four-chord-pair ballad;
 * a solo violin sings the melody in the body, a second violin holds the chord underneath, harp
 * rolls mark the phrases.
 */
const strings: Composer = async (spec, master, r) => {
  const s = sections(spec, 72);
  const [key, prog] = (
    [
      ['D', ['D', 'A', 'Bm', 'F#m', 'G', 'D', 'G', 'A']],
      ['G', ['G', 'D', 'Em', 'Bm', 'C', 'G', 'C', 'D']],
    ] as const
  )[spec.seed % 2];
  const verb = await reverb(3.6, 0.34);
  verb.connect(master);
  const piano = sampler(spec, 'piano', { release: 1.8, volume: -9 }).connect(verb);
  const bass = sampler(spec, 'contrabass', { attack: 0.2, release: 1.6, volume: -12 }).connect(verb);
  const lead = sampler(spec, 'violin', { attack: 0.12, release: 1.3, volume: -5 }).chain(
    new Tone.Filter(5200, 'lowpass', -24),
    verb,
  );
  const pad = sampler(spec, 'violin', { attack: 0.7, release: 2, volume: -17 }).chain(
    new Tone.Filter(4000, 'lowpass', -24),
    verb,
  );
  const harp = sampler(spec, 'harp', { release: 2.4, volume: -15 }).connect(verb);
  await Tone.loaded();
  const bars = Math.round(s.finalAt / s.bar);
  const line = melody(
    [...prog],
    key,
    5,
    bars,
    [
      [
        [0, 3],
        [3, 1],
      ],
      [
        [0, 1.5],
        [1.5, 0.5],
        [2, 2],
      ],
      [
        [0, 2],
        [2, 1],
        [3, 1],
      ],
      [[0, 4]],
    ],
    r,
  );
  forBars(s, (b, t0) => {
    const sym = prog[b % prog.length];
    const tri = voice(sym, 4, spec.transpose);
    const root = rootOf(sym, 3, spec.transpose);
    const body = isBody(s, t0);
    const arp = [root, shift(root, 7), tri[1], shift(root, 7), shift(root, 12), tri[1], tri[2], tri[1]];
    arp.forEach((n, i) =>
      piano.triggerAttackRelease(
        n,
        s.beat * 1.5,
        t0 + i * (s.beat / 2) + r() * 0.5 * 0.012,
        (i % 4 === 0 ? 0.48 : 0.34) + 0.06 * r(),
      ),
    );
    bass.triggerAttackRelease(rootOf(sym, 2, spec.transpose), s.bar * 0.98, t0, 0.55);
    if (body) {
      for (const m of line.filter((x) => x.bar === b))
        lead.triggerAttackRelease(
          shift(m.note, spec.transpose),
          m.dur * s.beat * 0.97,
          t0 + m.at * s.beat,
          0.62 + 0.08 * r(),
        );
      pad.triggerAttackRelease(tri[1], s.bar * 0.98, t0, 0.45);
      if (b % 4 === 0) tri.forEach((n, i) => harp.triggerAttackRelease(shift(n, 12), s.beat * 2, t0 + i * 0.07, 0.4));
    }
  });
  const home = voice(prog[0], 4, spec.transpose);
  home.forEach((n, i) => piano.triggerAttackRelease(n, 3.2, s.finalAt + i * 0.04, 0.5));
  bass.triggerAttackRelease(rootOf(prog[0], 2, spec.transpose), 3, s.finalAt, 0.55);
  lead.triggerAttackRelease(shift(`${key}5`, spec.transpose), 2.6, s.finalAt, 0.5);
};

/**
 * Flute: a pastoral song. Fingerpicked acoustic guitar and harp, contrabass in the body, and a
 * wooden-sounding flute melody that enters after the hook.
 */
const flute: Composer = async (spec, master, r) => {
  const s = sections(spec, 84);
  const [key, prog] = (
    [
      ['G', ['G', 'Em', 'C', 'D']],
      ['C', ['C', 'Am', 'F', 'G']],
    ] as const
  )[spec.seed % 2];
  const verb = await reverb(3.2, 0.3);
  verb.connect(master);
  const guitar = sampler(spec, 'guitar-acoustic', { release: 1.6, volume: -6 }).connect(verb);
  const harp = sampler(spec, 'harp', { release: 2, volume: -17 }).connect(verb);
  const bass = sampler(spec, 'contrabass', { attack: 0.15, release: 1.2, volume: -14 }).connect(verb);
  const fl = sampler(spec, 'flute', { attack: 0.06, release: 0.9, volume: -7 }).chain(
    new Tone.Filter(6500, 'lowpass', -24),
    verb,
  );
  await Tone.loaded();
  const bars = Math.round(s.finalAt / s.bar);
  const line = melody(
    [...prog],
    key,
    5,
    bars,
    [
      [
        [0, 1],
        [1, 1],
        [2, 1.5],
        [3.5, 0.5],
      ],
      [
        [0, 3],
        [3, 1],
      ],
      [
        [0, 1.5],
        [1.5, 0.5],
        [2, 1],
        [3, 1],
      ],
      [[0, 4]],
    ],
    r,
  );
  forBars(s, (b, t0) => {
    const sym = prog[b % prog.length];
    travis(guitar, sym, t0, s, spec.transpose, r);
    if (isBody(s, t0)) {
      bass.triggerAttackRelease(rootOf(sym, 2, spec.transpose), s.bar * 0.9, t0, 0.5);
      for (const m of line.filter((x) => x.bar === b))
        fl.triggerAttackRelease(
          shift(m.note, spec.transpose),
          m.dur * s.beat * 0.9,
          t0 + m.at * s.beat,
          0.55 + 0.1 * r(),
        );
      harp.triggerAttackRelease(shift(voice(sym, 4, spec.transpose)[0], 12), s.beat, t0 + s.beat * 3.5, 0.4);
    }
  });
  const home = voice(prog[0], 3, spec.transpose);
  home.forEach((n, i) => guitar.triggerAttackRelease(n, 3, s.finalAt + i * 0.035, 0.65));
  guitar.triggerAttackRelease(rootOf(prog[0], 2, spec.transpose), 3, s.finalAt, 0.7);
  fl.triggerAttackRelease(shift(`${key}5`, spec.transpose), 2.4, s.finalAt, 0.45);
  harp.triggerAttackRelease(shift(home[0], 24), 2.5, s.finalAt + 0.2, 0.45);
};

/**
 * Wrong About Space: lo-fi hip-hop, one steady loop. A mellow clean electric guitar carries the
 * ninth chords, the piano only pads quietly underneath, electric bass and a dusty swung beat run the
 * same pattern from the first bar to the last, with tape wow and a little vinyl.
 */
const lofi: Composer = async (spec, master, r) => {
  const s = sections(spec, 74);
  const prog = [
    ['Dm9', 'G13', 'Cmaj9', 'Am9'],
    ['Fmaj9', 'Em9', 'Dm9', 'Cmaj9'],
  ][spec.seed % 2];
  const swing = s.beat * 0.12;
  const tape = new Tone.Filter(3000, 'lowpass', -24).connect(master);
  const sat = new Tone.Distortion({ distortion: 0.06, wet: 0.4 }).connect(tape);
  const wow = new Tone.Vibrato({ frequency: 0.45, depth: 0.05 }).connect(sat);
  const verb = await reverb(2.4, 0.28);
  verb.connect(wow);
  const guitar = sampler(spec, 'guitar-electric', { release: 1.4, volume: -8 }).chain(
    new Tone.Chorus(1.2, 3, 0.4).start(),
    verb,
  );
  const piano = sampler(spec, 'piano', { attack: 0.02, release: 2, volume: -20 }).connect(verb);
  const bass = sampler(spec, 'bass-electric', { release: 0.6, volume: -5 }).connect(sat);
  const crush = new Tone.BitCrusher(10);
  crush.wet.value = 0.25;
  crush.connect(tape);
  const d = drums(crush, { snareTone: true, dark: true });
  const vinyl = new Tone.Noise({ type: 'pink', volume: -62 }).chain(new Tone.Filter(1800, 'bandpass'), master);
  vinyl.start(0).stop(s.finalAt + 2.6);
  await Tone.loaded();
  forBars(s, (b, t0) => {
    const sym = prog[b % prog.length];
    const chord = voice(sym, 3, spec.transpose).slice(1).map(mid);
    // Guitar: the same two strums every bar (downbeat, then the swung "and" of 3), gently rolled.
    chord.forEach((n, i) => guitar.triggerAttackRelease(n, s.beat * 2, t0 + i * 0.03, 0.5));
    chord.forEach((n, i) => guitar.triggerAttackRelease(n, s.beat * 1.2, t0 + s.beat * 2.5 + swing + i * 0.025, 0.38));
    // Piano: one soft sustained chord per bar, just colour underneath.
    piano.triggerAttackRelease(chord, s.bar * 0.95, t0, 0.22);
    const root = rootOf(sym, 2, spec.transpose);
    bass.triggerAttackRelease(root, s.beat * 1.6, t0, 0.75);
    bass.triggerAttackRelease(root, s.beat * 0.6, t0 + s.beat * 2.5 + swing, 0.55);
    // The beat: identical every bar (boom ... bap, boom-boom bap), swung hats.
    d.kick.triggerAttackRelease('C1', '8n', t0, 0.9);
    d.kick.triggerAttackRelease('C1', '8n', t0 + s.beat * 2.5 + swing, 0.7);
    d.hitSnare(t0 + s.beat + 0.015, 0.7);
    d.hitSnare(t0 + s.beat * 3 + 0.015, 0.7);
    for (let h = 0; h < 8; h++)
      d.hat.triggerAttackRelease(
        '32n',
        t0 + h * (s.beat / 2) + (h % 2 ? swing : 0),
        (h % 2 ? 0.6 : 0.4) * (0.9 + 0.2 * r()),
      );
  });
  const home = voice(prog[0], 3, spec.transpose).slice(1).map(mid);
  home.forEach((n, i) => guitar.triggerAttackRelease(n, 3, s.finalAt + i * 0.04, 0.5));
  piano.triggerAttackRelease(home, 3, s.finalAt, 0.2);
  bass.triggerAttackRelease(rootOf(prog[0], 2, spec.transpose), 2.5, s.finalAt, 0.7);
};

/** Sky This Week: night-sky piano. Recorded piano arpeggios, harp and contrabass, violin pad, soft pulse. */
const nocturne: Composer = async (spec, master, r) => {
  const s = sections(spec, 88);
  const prog = [
    ['C#m', 'A', 'E', 'B'],
    ['Am', 'F', 'C', 'G'],
  ][spec.seed % 2];
  const kicks: number[] = [];
  for (let t = 0; t < s.finalAt; t += s.beat * 2) if (t >= s.hookEnd) kicks.push(t);
  const verb = await reverb(3.8, 0.33);
  verb.connect(master);
  const bus = pumpBus(verb, kicks, 0.25);
  const piano = sampler(spec, 'piano', { release: 2.2, volume: -5 }).connect(bus);
  const harp = sampler(spec, 'harp', { release: 2.5, volume: -14 }).connect(verb);
  const violin = sampler(spec, 'violin', { attack: 0.6, release: 2, volume: -20 }).connect(verb);
  const contrabass = sampler(spec, 'contrabass', { attack: 0.1, release: 1.5, volume: -12 }).connect(verb);
  const kick = softKick(master, -12);
  await Tone.loaded();
  forBars(s, (b, t0) => {
    const sym = prog[b % prog.length];
    const tri = voice(sym, 4, spec.transpose);
    const body = isBody(s, t0);
    const arp = [tri[0], tri[1], tri[2], shift(tri[0], 12), tri[2], tri[1], shift(tri[1], 12), tri[2]];
    arp.forEach((n, i) =>
      piano.triggerAttackRelease(
        n,
        s.beat * 1.2,
        t0 + i * (s.beat / 2) + r() * 0.5 * 0.01,
        (i % 2 ? 0.38 : 0.5) + 0.08 * r(),
      ),
    );
    harp.triggerAttackRelease(rootOf(sym, 3, spec.transpose), s.bar, t0, 0.55);
    contrabass.triggerAttackRelease(rootOf(sym, 2, spec.transpose), s.bar * 0.95, t0, 0.6);
    if (body) {
      violin.triggerAttackRelease(shift(tri[b % 3], 12), s.bar * 0.98, t0, 0.5);
      for (const k of [0, 2]) kick.triggerAttackRelease('C2', '8n', t0 + k * s.beat, 0.8);
    }
  });
  const home = voice(prog[0], 4, spec.transpose);
  home.forEach((n, i) => piano.triggerAttackRelease(n, 3.2, s.finalAt + i * 0.04, 0.5));
  harp.triggerAttackRelease(shift(home[0], 12), 3, s.finalAt + 0.15, 0.5);
  contrabass.triggerAttackRelease(rootOf(prog[0], 2, spec.transpose), 3, s.finalAt, 0.6);
};

/**
 * Tone.js ports of the original arranged beds (nebula, orbit, meteor): the same event list as
 * `../score.ts`, played on the Kawai upright's soft layer with Tone instruments standing in for the
 * hand-written kick, sub, pad, shaker, riser, impact, sidechain and reverb.
 */
const scoreTone =
  (style: ScoreStyle): Composer =>
  async (spec, master) => {
    const arr = scoreEvents({
      style,
      seconds: spec.seconds,
      seed: spec.seed,
      transpose: spec.transpose,
      cues: spec.cues,
    });
    const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

    // Melodic bus, ducked by the kick, dry plus a reverb send; drums dry.
    const pump = new Tone.Gain(1);
    pump.connect(master);
    const verb = await reverb(1.6, 1);
    pump.connect(verb);
    verb.connect(new Tone.Gain(arr.reverb + 0.04).connect(master));
    const drums = new Tone.Gain(1).connect(master);

    // One sampler per pan position, all on the soft layer (what the original beds play).
    const urls: Record<number, string> = {};
    for (const f of spec.samples[KAWAI] ?? []) {
      const m = /^(\d+)_v4\.mp3$/.exec(f);
      if (m) urls[Number(m[1])] = f;
    }
    const pianos = new Map<number, Tone.Sampler>();
    for (const e of arr.events) {
      if (e.type !== 'piano' || pianos.has(e.pan)) continue;
      const panner = new Tone.Panner(e.pan).connect(pump);
      pianos.set(
        e.pan,
        new Tone.Sampler({ urls, baseUrl: `${spec.sampleBase}/${KAWAI}/`, release: 0.25 }).connect(panner),
      );
    }

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: Math.log2(136 / 46),
      oscillator: { type: 'sine' },
      envelope: { attack: 0.002, decay: 0.45, sustain: 0, release: 0.05 },
    }).connect(drums);
    const sub = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.6, sustain: 0.2, release: 0.08 },
    }).connect(pump);
    const pads = ([-1, 1] as const).map((side) =>
      new Tone.PolySynth(Tone.Synth, {
        detune: side * 2.6,
        oscillator: { type: 'custom', partials: [1, 0.12] },
        envelope: { attack: 0.6, decay: 0, sustain: 1, release: 0.6 },
      }).connect(new Tone.Panner(side * 0.5).connect(pump)),
    );
    const shakers = new Map<number, Tone.NoiseSynth>();
    const shakerAt = (pan: number) => {
      if (!shakers.has(pan)) {
        const n = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.004, decay: 0.08, sustain: 0 },
        });
        n.chain(new Tone.Filter(7000, 'highpass'), new Tone.Panner(pan), drums);
        shakers.set(pan, n);
      }
      return shakers.get(pan)!;
    };
    await Tone.loaded();

    const kicks: number[] = [];
    // Humanised timing can nudge the first notes just before 0 s; Web Audio needs t >= 0.
    for (const e of arr.events.map((x) => ('t' in x ? { ...x, t: Math.max(0, x.t) } : x))) {
      if (e.type === 'piano') {
        const dur = Number.isFinite(e.ring) ? e.ring : 6;
        pianos.get(e.pan)!.triggerAttackRelease(hz(e.midi), dur, e.t, Math.min(1, e.gain * 2.5));
      } else if (e.type === 'kick') {
        kicks.push(e.t);
        kick.triggerAttackRelease(46, 0.4, e.t, e.gain);
      } else if (e.type === 'sub') {
        sub.triggerAttackRelease(hz(e.midi), Math.max(0.05, e.length - 0.08), e.t, e.gain);
      } else if (e.type === 'pad') {
        for (const p of pads) p.triggerAttackRelease(e.upper.map(hz), e.length, e.t, arr.padGain);
      } else if (e.type === 'shaker') {
        shakerAt(e.pan).triggerAttackRelease(0.08, e.t, Math.min(1, e.gain * 3));
      } else if (e.type === 'riser') {
        const t0 = Math.max(0, e.end - e.length);
        const lp = new Tone.Filter(140, 'lowpass');
        const g = new Tone.Gain(0);
        const noise = new Tone.Noise('white').chain(lp, g, drums);
        lp.frequency.setValueAtTime(140, t0);
        lp.frequency.exponentialRampToValueAtTime(2200, e.end);
        const curve = Array.from({ length: 32 }, (_, i) => (i / 31) ** 2 * e.gain * 2.2);
        g.gain.setValueCurveAtTime(curve, t0, e.end - t0);
        noise.start(t0).stop(e.end);
      } else {
        const boom = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.005, decay: 2.2, sustain: 0, release: 0.1 },
        }).connect(drums);
        boom.triggerAttackRelease(hz(e.midi), 2.3, e.t, e.gain);
        const air = new Tone.Gain(0);
        new Tone.Noise('white')
          .chain(new Tone.Filter(420, 'lowpass'), air, drums)
          .start(e.t)
          .stop(e.t + 2.4);
        air.gain.setValueAtTime(e.gain * 0.8, e.t);
        air.gain.setTargetAtTime(0, e.t, 0.9);
      }
    }

    // Sidechain: each kick dips the melodic bus and lets it breathe back (same curve as the original).
    for (const t of kicks.sort((a, b) => a - b)) {
      pump.gain.setValueAtTime(1 - arr.pump * 0.6, t);
      pump.gain.linearRampToValueAtTime(1 - arr.pump, t + 0.0016);
      pump.gain.setTargetAtTime(1, t + 0.0016, 0.11);
    }
  };

const COMPOSERS: Record<ToneStyle, Composer> = {
  acoustic,
  strings,
  flute,
  pulse,
  lofi,
  nocturne,
  'nebula-tone': scoreTone('nebula'),
  'orbit-tone': scoreTone('orbit'),
  'meteor-tone': scoreTone('meteor'),
};

function toBase64(a: Float32Array): string {
  const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function renderBed(spec: BedSpec): Promise<{ sampleRate: number; left: string; right: string }> {
  const sampleRate = 44100;
  // Tone's noise sources use Math.random; seed it so renders are reproducible.
  Math.random = rng(spec.seed + 7919);
  const r = rng(spec.seed);
  const buffer = await Tone.Offline(
    async () => {
      const comp = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.01, release: 0.2 }).toDestination();
      // Keep the top end soft: nothing glassy or fizzy above ~9 kHz reaches the bed.
      const master = new Tone.Filter({ frequency: 9000, type: 'lowpass', rolloff: -12 }).connect(comp);
      await COMPOSERS[spec.style](spec, master, r);
    },
    spec.seconds + 2,
    2,
    sampleRate,
  );
  return { sampleRate, left: toBase64(buffer.getChannelData(0)), right: toBase64(buffer.getChannelData(1)) };
}

(globalThis as unknown as { renderBed: typeof renderBed }).renderBed = renderBed;
