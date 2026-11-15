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
import { Chord, Note } from 'tonal';

import type { ToneStyle } from './styles';

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
    const bassA = rootOf(sym, 2, spec.transpose);
    const bassB = shift(bassA, 7);
    const treble = [shift(tri[1], 12), shift(tri[2], 12), shift(tri[0], 12)];
    for (let e = 0; e < 8; e++) {
      const t = t0 + e * (s.beat / 2) + r() * 0.5 * 0.012;
      const v = 0.55 + 0.25 * r();
      if (e % 2 === 0) guitar.triggerAttackRelease(e % 4 === 0 ? bassA : bassB, s.beat * 1.6, t, v + 0.1);
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

/** Cosmic Top 5 / Sky Tonight: bright electronic. Supersaw stabs, plucky arp, four-on-the-floor. */
const pulse: Composer = async (spec, master, r) => {
  const s = sections(spec, 120);
  const prog = ['Am', 'F', 'C', 'G'];
  const kicks: number[] = [];
  for (let t = 0; t < s.finalAt; t += s.beat) if (t >= s.hookEnd || Math.round(t / s.beat) % 2 === 0) kicks.push(t);
  const verb = await reverb(2.2, 0.28);
  verb.connect(master);
  const bus = pumpBus(verb, kicks, 0.65);
  const chords = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 28 },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.35, release: 0.4 },
    volume: -20,
  }).chain(new Tone.Filter(2600, 'lowpass'), bus);
  const pluck = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square8' },
    envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.08 },
    volume: -22,
  }).chain(new Tone.Filter(3200, 'lowpass'), new Tone.PingPongDelay('8n.', 0.25), bus);
  const bass = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 2, type: 'lowpass' },
    filterEnvelope: { attack: 0.005, decay: 0.15, sustain: 0.2, baseFrequency: 120, octaves: 2.6 },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.5, release: 0.08 },
    volume: -12,
  }).connect(bus);
  const d = drums(master);
  for (const k of kicks) d.kick.triggerAttackRelease('C1', '8n', k);
  forBars(s, (b, t0) => {
    const sym = prog[b % prog.length];
    const notes = voice(sym, 4, spec.transpose);
    const body = isBody(s, t0);
    chords.triggerAttackRelease(notes, s.beat * 0.9, t0, 0.8);
    if (body) chords.triggerAttackRelease(notes, s.beat * 0.5, t0 + s.beat * 2.5, 0.6);
    const root = rootOf(sym, 2, spec.transpose);
    for (let e = 0; e < 8; e++)
      bass.triggerAttackRelease(e % 2 ? shift(root, 12) : root, s.beat * 0.4, t0 + e * (s.beat / 2), 0.9);
    const arp = [...notes, ...notes.map((n) => shift(n, 12))];
    for (let q = 0; q < 16; q++) {
      if (!body && q % 2) continue;
      const n = arp[(q * 3 + (b % 2)) % arp.length];
      pluck.triggerAttackRelease(shift(n, 12), '32n', t0 + q * (s.beat / 4) + r() * 0.5 * 0.006, 0.5 + 0.3 * r());
    }
    if (body) {
      d.hitSnare(t0 + s.beat);
      d.hitSnare(t0 + s.beat * 3);
      for (let h = 0; h < 4; h++) d.hat.triggerAttackRelease('32n', t0 + h * s.beat + s.beat / 2);
    }
  });
  chords.triggerAttackRelease(voice(prog[0], 4, spec.transpose), 2.6, s.finalAt, 0.8);
  bass.triggerAttackRelease(rootOf(prog[0], 2, spec.transpose), 2.4, s.finalAt);
};

/**
 * Mission Control: a driving band groove on recorded instruments. Palm-muted electric guitar in
 * 16ths, electric bass in 8ths, piano chords, a violin line on top, four-on-the-floor with a pump.
 */
const drive: Composer = async (spec, master, r) => {
  const s = sections(spec, 116);
  const prog = ['Em', 'C', 'G', 'D'];
  const kicks: number[] = [];
  for (let t = 0; t < s.finalAt; t += s.beat) if (t >= s.hookEnd || Math.round(t / s.beat) % 2 === 0) kicks.push(t);
  const verb = await reverb(2.6, 0.24);
  verb.connect(master);
  const bus = pumpBus(verb, kicks, 0.45);
  const chug = sampler(spec, 'guitar-electric', { release: 0.06, volume: -9 }).chain(
    new Tone.Filter(2400, 'lowpass'),
    bus,
  );
  const bass = sampler(spec, 'bass-electric', { release: 0.12, volume: -5 }).connect(bus);
  const violin = sampler(spec, 'violin', { attack: 0.08, release: 1.2, volume: -12 }).chain(
    new Tone.FeedbackDelay('8n', 0.2),
    verb,
  );
  const piano = sampler(spec, 'piano', { release: 1.5, volume: -16 }).connect(verb);
  const d = drums(master, { snareTone: true });
  await Tone.loaded();
  for (const k of kicks) d.kick.triggerAttackRelease('C1', '8n', k);
  const melody = [
    [4, 2, 1, 0],
    [0, 1, 2, 4],
  ][spec.seed % 2];
  forBars(s, (b, t0) => {
    const sym = prog[b % prog.length];
    const root = rootOf(sym, 2, spec.transpose);
    const body = isBody(s, t0);
    // Palm-muted power chord (root + fifth) in 16ths, accents on the beat.
    for (let q = 0; q < 16; q++) {
      if (!body && q % 2) continue;
      const t = t0 + q * (s.beat / 4) + r() * 0.5 * 0.004;
      const v = (q % 4 === 0 ? 0.85 : 0.55) + 0.1 * r();
      chug.triggerAttackRelease([shift(root, 12), shift(root, 19)], s.beat / 6, t, v);
    }
    for (let e = 0; e < 8; e++) bass.triggerAttackRelease(root, s.beat * 0.42, t0 + e * (s.beat / 2), 0.8);
    piano.triggerAttackRelease(voice(sym, 4, spec.transpose), s.beat * 2, t0, 0.35);
    if (body) {
      const tones = voice(sym, 5, spec.transpose);
      violin.triggerAttackRelease(tones[melody[b % 4] % tones.length], s.beat * 2.8, t0, 0.65);
      violin.triggerAttackRelease(tones[(melody[(b + 1) % 4] + 1) % tones.length], s.beat * 0.9, t0 + s.beat * 3, 0.5);
      d.hitSnare(t0 + s.beat);
      d.hitSnare(t0 + s.beat * 3);
      for (let h = 0; h < 8; h++) d.hat.triggerAttackRelease('32n', t0 + h * (s.beat / 2), h % 2 ? 0.9 : 0.45);
    }
  });
  const home = voice(prog[0], 3, spec.transpose);
  const homeRoot = rootOf(prog[0], 3, spec.transpose);
  piano.triggerAttackRelease(
    home.map((n) => shift(n, 12)),
    3,
    s.finalAt,
    0.6,
  );
  chug.triggerAttackRelease([homeRoot, shift(homeRoot, 7)], 2, s.finalAt, 0.8);
  bass.triggerAttackRelease(rootOf(prog[0], 2, spec.transpose), 2.5, s.finalAt, 0.8);
  violin.triggerAttackRelease(shift(home[0], 24), 2.6, s.finalAt, 0.55);
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
  const d = drums(master);
  d.kick.volume.value = -12;
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
      for (const k of [0, 2]) d.kick.triggerAttackRelease('C1', '8n', t0 + k * s.beat, 0.8);
      for (let h = 0; h < 4; h++) d.hat.triggerAttackRelease('32n', t0 + h * s.beat + s.beat / 2, 0.35);
    }
  });
  const home = voice(prog[0], 4, spec.transpose);
  home.forEach((n, i) => piano.triggerAttackRelease(n, 3.2, s.finalAt + i * 0.04, 0.5));
  harp.triggerAttackRelease(shift(home[0], 12), 3, s.finalAt + 0.15, 0.5);
  contrabass.triggerAttackRelease(rootOf(prog[0], 2, spec.transpose), 3, s.finalAt, 0.6);
};

const COMPOSERS: Record<ToneStyle, Composer> = { acoustic, pulse, drive, lofi, nocturne };

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
      const master = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.01, release: 0.2 }).toDestination();
      await COMPOSERS[spec.style](spec, master, r);
    },
    spec.seconds + 2,
    2,
    sampleRate,
  );
  return { sampleRate, left: toBase64(buffer.getChannelData(0)), right: toBase64(buffer.getChannelData(1)) };
}

(globalThis as unknown as { renderBed: typeof renderBed }).renderBed = renderBed;
