/**
 * Music beds composed with Tone.js (synths, samplers, effects) and tonal (harmony), rendered offline
 * in a headless browser by `render.ts`. Browser-only module: it is bundled with esbuild and exposes
 * `window.renderBed`.
 *
 * Every style follows the episode's scene cues: a lighter hook, the full groove in the body, a
 * thinner outro, and the home chord ringing out at the end. Seeded, so a plan always renders the
 * same bed.
 */
import * as Tone from 'tone';
import { Chord, Note } from 'tonal';

export const TONE_STYLES = ['pulse', 'telemetry', 'lab', 'acoustic', 'lofi'] as const;
export type ToneStyle = (typeof TONE_STYLES)[number];

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
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** Chord symbols → note names voiced upward from `octave`, transposed by semitones. */
function voice(symbol: string, octave: number, transpose: number): string[] {
  const c = Chord.get(symbol);
  const root = `${c.tonic ?? 'C'}${octave}`;
  return c.intervals.map((iv) => tr(Note.transpose(root, iv), transpose));
}
const shift = (n: string, semis: number): string => Note.fromMidi((Note.midi(n) ?? 60) + semis);
const tr = (n: string, t: number): string => shift(n, t);

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

/** Bus that ducks on every kick (sidechain feel). */
function pumpBus(dest: Tone.InputNode, kicks: number[], depth: number): Tone.Gain {
  const g = new Tone.Gain(1).connect(dest);
  for (const k of kicks) {
    g.gain.setValueAtTime(1 - depth, k);
    g.gain.linearRampToValueAtTime(1, k + 0.22);
  }
  return g;
}

function drums(master: Tone.InputNode) {
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
    volume: -6,
  }).connect(master);
  const snareVerb = new Tone.Reverb({ decay: 1.2, wet: 0.25 }).connect(master);
  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
    volume: -14,
  }).chain(new Tone.Filter(1800, 'bandpass'), snareVerb);
  const hat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.035, sustain: 0 },
    volume: -24,
  }).chain(new Tone.Filter(8000, 'highpass'), master);
  return { kick, snare, hat };
}

type Composer = (spec: BedSpec, master: Tone.ToneAudioNode) => Promise<void>;

// ------------------------------------------------------------------ styles

/** Cosmic Top 5: bright electronic. Supersaw stabs, plucky arp, four-on-the-floor, sidechain. */
const pulse: Composer = async (spec, master) => {
  const bpm = 120;
  const s = sections(spec, bpm);
  const r = rng(spec.seed);
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
  for (let b = 0, t0 = 0; t0 < s.finalAt - 1e-6; b++, t0 = b * s.bar) {
    const sym = prog[b % prog.length];
    const notes = voice(sym, 4, spec.transpose);
    const body = t0 >= s.hookEnd && t0 < s.outroStart;
    chords.triggerAttackRelease(notes, s.beat * 0.9, t0, 0.8);
    if (body) chords.triggerAttackRelease(notes, s.beat * 0.5, t0 + s.beat * 2.5, 0.6);
    const root = tr(`${Chord.get(sym).tonic}2`, spec.transpose);
    for (let e = 0; e < 8; e++)
      bass.triggerAttackRelease(e % 2 ? shift(root, 12) : root, s.beat * 0.4, t0 + e * (s.beat / 2), 0.9);
    const arp = [...notes, ...notes.map((n) => shift(n, 12))];
    for (let q = 0; q < 16; q++) {
      if (!body && q % 2) continue;
      const n = arp[(q * 3 + (b % 2)) % arp.length];
      pluck.triggerAttackRelease(shift(n, 12), '32n', t0 + q * (s.beat / 4) + (r() - 0.5) * 0.006, 0.5 + 0.3 * r());
    }
    if (body) {
      d.snare.triggerAttackRelease('16n', t0 + s.beat);
      d.snare.triggerAttackRelease('16n', t0 + s.beat * 3);
      for (let h = 0; h < 4; h++) d.hat.triggerAttackRelease('32n', t0 + h * s.beat + s.beat / 2);
    }
  }
  chords.triggerAttackRelease(voice(prog[0], 4, spec.transpose), 2.6, s.finalAt, 0.8);
  bass.triggerAttackRelease(tr(`${Chord.get(prog[0]).tonic}2`, spec.transpose), 2.4, s.finalAt);
};

/** Mission Control: dark synthwave. Gated arp with filter sweep, warm pad, steady backbeat. */
const telemetry: Composer = async (spec, master) => {
  const bpm = 96;
  const s = sections(spec, bpm);
  const prog = ['Dm', 'Bb', 'F', 'C'];
  const kicks: number[] = [];
  for (let t = 0; t < s.finalAt; t += s.beat * 2) kicks.push(t);
  const verb = await reverb(3.5, 0.32);
  verb.connect(master);
  const bus = pumpBus(verb, kicks, 0.4);
  const chorus = new Tone.Chorus(0.6, 3.5, 0.6).start().connect(bus);
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 40 },
    envelope: { attack: 0.8, decay: 0.5, sustain: 0.8, release: 1.6 },
    volume: -24,
  }).chain(new Tone.Filter(1100, 'lowpass'), chorus);
  const arpFilter = new Tone.Filter(900, 'lowpass', -24);
  arpFilter.frequency.setValueAtTime(700, 0);
  arpFilter.frequency.linearRampToValueAtTime(3200, s.outroStart);
  arpFilter.frequency.linearRampToValueAtTime(900, s.finalAt);
  const arp = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 4, type: 'lowpass' },
    filterEnvelope: { attack: 0.002, decay: 0.12, sustain: 0.1, baseFrequency: 400, octaves: 3 },
    envelope: { attack: 0.002, decay: 0.12, sustain: 0.1, release: 0.05 },
    volume: -16,
  }).chain(arpFilter, new Tone.FeedbackDelay('8n.', 0.3), bus);
  const bass = new Tone.MonoSynth({
    oscillator: { type: 'square' },
    filter: { Q: 1, type: 'lowpass', frequency: 300 },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.1 },
    volume: -14,
  }).connect(bus);
  const d = drums(master);
  for (const k of kicks) if (k >= s.hookEnd * 0.5) d.kick.triggerAttackRelease('C1', '8n', k);
  for (let b = 0, t0 = 0; t0 < s.finalAt - 1e-6; b++, t0 = b * s.bar) {
    const sym = prog[b % prog.length];
    const notes = voice(sym, 3, spec.transpose);
    pad.triggerAttackRelease(
      notes.map((n) => shift(n, 12)),
      s.bar * 0.98,
      t0,
      0.6,
    );
    const root = tr(`${Chord.get(sym).tonic}2`, spec.transpose);
    for (let e = 0; e < 8; e++) bass.triggerAttackRelease(root, s.beat * 0.45, t0 + e * (s.beat / 2), 0.8);
    const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
    const pool = [...notes, ...notes.map((n) => shift(n, 12))];
    for (let q = 0; q < 16; q++)
      arp.triggerAttackRelease(shift(pool[pattern[q % 8] + (q >= 8 ? 3 : 0)], 12), '32n', t0 + q * (s.beat / 4), 0.7);
    if (t0 >= s.hookEnd && t0 < s.outroStart) {
      d.snare.triggerAttackRelease('16n', t0 + s.beat);
      d.snare.triggerAttackRelease('16n', t0 + s.beat * 3);
      for (let h = 0; h < 8; h++) d.hat.triggerAttackRelease('32n', t0 + h * (s.beat / 2), h % 2 ? 0.9 : 0.5);
    }
  }
  pad.triggerAttackRelease(voice(prog[0], 4, spec.transpose), 3, s.finalAt, 0.7);
  bass.triggerAttackRelease(tr('D2', spec.transpose), 2.5, s.finalAt);
};

/** Weird Physics: playful xylophone over a bouncy electric bass and light percussion. */
const lab: Composer = async (spec, master) => {
  const bpm = 112;
  const s = sections(spec, bpm);
  const r = rng(spec.seed);
  const prog = ['C', 'Am', 'Dm7', 'G7'];
  const verb = await reverb(1.6, 0.2);
  verb.connect(master);
  const xylo = sampler(spec, 'xylophone', { release: 0.6, volume: -8 }).connect(verb);
  const harp = sampler(spec, 'harp', { release: 1.5, volume: -14 }).connect(verb);
  const bass = sampler(spec, 'bass-electric', { release: 0.3, volume: -6 }).connect(verb);
  const d = drums(master);
  d.kick.volume.value = -10;
  await Tone.loaded();
  const motif = [
    [0, 2, 4, 2, 5, 4, 2, 1],
    [4, 2, 0, 2, 4, 5, 6, 4],
  ][spec.seed % 2];
  for (let b = 0, t0 = 0; t0 < s.finalAt - 1e-6; b++, t0 = b * s.bar) {
    const sym = prog[b % prog.length];
    const notes = voice(sym, 4, spec.transpose);
    const body = t0 >= s.hookEnd && t0 < s.outroStart;
    harp.triggerAttackRelease(notes, s.bar, t0, 0.5);
    const root = tr(`${Chord.get(sym).tonic}2`, spec.transpose);
    const walk = [root, shift(root, 7), shift(root, 12), shift(root, 7)];
    for (let e = 0; e < 4; e++) bass.triggerAttackRelease(walk[e], s.beat * 0.6, t0 + e * s.beat, 0.8);
    const scale = [...notes, ...notes.map((n) => shift(n, 12))].map((n) => shift(n, 12));
    for (let q = 0; q < 8; q++) {
      if (!body && q % 2) continue;
      const swing = q % 2 ? s.beat * 0.08 : 0;
      xylo.triggerAttackRelease(
        scale[motif[q] % scale.length],
        '8n',
        t0 + q * (s.beat / 2) + swing + (r() - 0.5) * 0.008,
        0.6 + 0.3 * r(),
      );
    }
    if (body) {
      d.kick.triggerAttackRelease('C1', '8n', t0);
      d.kick.triggerAttackRelease('C1', '8n', t0 + s.beat * 2.5);
      for (let h = 0; h < 8; h++)
        d.hat.triggerAttackRelease('32n', t0 + h * (s.beat / 2) + (h % 2 ? s.beat * 0.08 : 0), h % 2 ? 1 : 0.5);
    }
  }
  harp.triggerAttackRelease(voice(prog[0], 4, spec.transpose), 3, s.finalAt, 0.7);
  xylo.triggerAttackRelease(tr('C6', spec.transpose), 1.5, s.finalAt + 0.05, 0.6);
};

/** One Shot: fingerpicked acoustic guitar (Travis pattern), harp shimmer, soft violin line. No drums. */
const acoustic: Composer = async (spec, master) => {
  const bpm = 78;
  const s = sections(spec, bpm);
  const r = rng(spec.seed);
  const prog = ['D', 'A', 'Bm', 'G'];
  const verb = await reverb(3.2, 0.3);
  verb.connect(master);
  const guitar = sampler(spec, 'guitar-acoustic', { release: 1.6, volume: -4 }).connect(verb);
  const harp = sampler(spec, 'harp', { release: 2, volume: -18 }).connect(verb);
  const violin = sampler(spec, 'violin', { attack: 0.4, release: 1.5, volume: -22 }).connect(verb);
  await Tone.loaded();
  for (let b = 0, t0 = 0; t0 < s.finalAt - 1e-6; b++, t0 = b * s.bar) {
    const sym = prog[b % prog.length];
    const tonic = Chord.get(sym).tonic ?? 'D';
    const tri = voice(sym, 3, spec.transpose);
    const bassA = tr(`${tonic}2`, spec.transpose);
    const bassB = shift(bassA, 7);
    const treble = [shift(tri[1], 12), shift(tri[2], 12), shift(tri[0], 12)];
    for (let e = 0; e < 8; e++) {
      const t = t0 + e * (s.beat / 2) + (r() - 0.5) * 0.012;
      const v = 0.55 + 0.25 * r();
      if (e % 2 === 0) guitar.triggerAttackRelease(e % 4 === 0 ? bassA : bassB, s.beat * 1.6, t, v + 0.1);
      else guitar.triggerAttackRelease(treble[(e >> 1) % 3], s.beat * 1.2, t, v);
    }
    if (t0 >= s.hookEnd && t0 < s.outroStart) {
      if (b % 2 === 1) violin.triggerAttackRelease(shift(tri[2], 12), s.bar * 0.95, t0, 0.5);
      harp.triggerAttackRelease(shift(tri[0], 24), s.beat, t0 + s.beat * 3.5, 0.45);
    }
  }
  const home = voice(prog[0], 3, spec.transpose);
  home.forEach((n, i) => guitar.triggerAttackRelease(n, 3, s.finalAt + i * 0.035, 0.7));
  guitar.triggerAttackRelease(tr('D2', spec.transpose), 3, s.finalAt, 0.75);
  harp.triggerAttackRelease(shift(home[0], 24), 2.5, s.finalAt + 0.2, 0.5);
};

/** Wrong About Space: lo-fi electric piano (FM), swung boom-bap, warm bass, tape wobble and crackle. */
const lofi: Composer = async (spec, master) => {
  const bpm = 82;
  const s = sections(spec, bpm);
  const r = rng(spec.seed);
  const prog = ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'];
  const verb = await reverb(2.4, 0.22);
  const tape = new Tone.Vibrato(0.6, 0.08).connect(new Tone.Filter(3800, 'lowpass').connect(verb));
  verb.connect(master);
  const keys = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3,
    modulationIndex: 8,
    oscillator: { type: 'sine' },
    modulation: { type: 'sine' },
    envelope: { attack: 0.005, decay: 1.6, sustain: 0.25, release: 1.2 },
    modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0.1, release: 0.5 },
    volume: -14,
  }).connect(tape);
  const bass = sampler(spec, 'bass-electric', { release: 0.4, volume: -8 }).connect(verb);
  const crackle = new Tone.Noise({ type: 'brown', volume: -56 }).chain(new Tone.Filter(2500, 'highpass'), master);
  crackle.start(0).stop(s.finalAt + 2.5);
  const d = drums(master);
  d.kick.volume.value = -8;
  await Tone.loaded();
  const swing = s.beat * 0.1;
  for (let b = 0, t0 = 0; t0 < s.finalAt - 1e-6; b++, t0 = b * s.bar) {
    const sym = prog[b % prog.length];
    const notes = voice(sym, 3, spec.transpose).map((n) => shift(n, 12));
    const body = t0 >= s.hookEnd && t0 < s.outroStart;
    keys.triggerAttackRelease(notes, s.beat * 1.5, t0 + 0.01, 0.6);
    keys.triggerAttackRelease(notes, s.beat * 0.8, t0 + s.beat * 2.5 + swing, 0.45);
    if (body && b % 2 === 1)
      keys.triggerAttackRelease(shift(notes[notes.length - 1], 12), s.beat, t0 + s.beat * 3.5 + swing, 0.4);
    const root = tr(`${Chord.get(sym).tonic}2`, spec.transpose);
    bass.triggerAttackRelease(root, s.beat * 1.4, t0, 0.8);
    bass.triggerAttackRelease(shift(root, 7), s.beat * 0.6, t0 + s.beat * 2.5 + swing, 0.6);
    if (t0 >= s.hookEnd * 0.5) {
      d.kick.triggerAttackRelease('C1', '8n', t0);
      d.kick.triggerAttackRelease('C1', '8n', t0 + s.beat * 1.75 + swing * 0.5);
      if (body) d.kick.triggerAttackRelease('C1', '8n', t0 + s.beat * 2.5 + swing);
    }
    if (body) {
      d.snare.triggerAttackRelease('16n', t0 + s.beat, 0.7);
      d.snare.triggerAttackRelease('16n', t0 + s.beat * 3, 0.7);
      for (let h = 0; h < 8; h++)
        d.hat.triggerAttackRelease(
          '32n',
          t0 + h * (s.beat / 2) + (h % 2 ? swing : 0),
          (h % 2 ? 0.8 : 0.45) * (0.85 + 0.3 * r()),
        );
    }
  }
  keys.triggerAttackRelease(
    voice(prog[0], 3, spec.transpose).map((n) => shift(n, 12)),
    3,
    s.finalAt,
    0.6,
  );
  bass.triggerAttackRelease(tr('F2', spec.transpose), 2.5, s.finalAt, 0.8);
};

const COMPOSERS: Record<ToneStyle, Composer> = { pulse, telemetry, lab, acoustic, lofi };

function toBase64(a: Float32Array): string {
  const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function renderBed(spec: BedSpec): Promise<{ sampleRate: number; left: string; right: string }> {
  const sampleRate = 44100;
  const buffer = await Tone.Offline(
    async () => {
      const master = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.01, release: 0.2 }).toDestination();
      await COMPOSERS[spec.style](spec, master);
    },
    spec.seconds + 2,
    2,
    sampleRate,
  );
  return { sampleRate, left: toBase64(buffer.getChannelData(0)), right: toBase64(buffer.getChannelData(1)) };
}

(globalThis as unknown as { renderBed: typeof renderBed }).renderBed = renderBed;
