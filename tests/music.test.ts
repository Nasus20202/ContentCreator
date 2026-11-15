import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { instrumentManifest } from '../src/assets/instruments';
import { bedFor, bedPeak, fitChannel, loudness, probe, SERIES_BED, synthesizePad } from '../src/render/media';
import { renderToneBed } from '../src/render/tone/render';
import { PIANO_STYLES } from '../src/render/piano-loop';
import { SCORE_STYLES, scoreEvents } from '../src/render/score';
import { isToneStyle, KAWAI, STYLE_INSTRUMENTS, TONE_STYLES } from '../src/render/tone/styles';
import { pianoFiles } from '../src/assets/piano';

const hasBrowser = ['CHROMIUM_PATH', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome']
  .map((p) => (p === 'CHROMIUM_PATH' ? process.env.CHROMIUM_PATH : p))
  .some((p) => !!p && fs.existsSync(p));

describe('music styles', () => {
  it('every series bed is a real style', () => {
    const real = [...TONE_STYLES, ...PIANO_STYLES, ...SCORE_STYLES];
    for (const style of Object.values(SERIES_BED)) expect(real).toContain(style);
    expect(bedFor('unknown-series')).toBe('nocturne');
  });

  it('pads a bed that is one sample short instead of muting it', () => {
    // (1082/30 + 2) * 44100 rounds up to one sample more than the renderer returns.
    const n = Math.ceil((1082 / 30 + 2) * 44100);
    const short = new Float32Array(n - 1).fill(0.5);
    const fitted = fitChannel(short, n);
    expect(fitted.length).toBe(n);
    expect(fitted[n - 1]).toBe(0);
    expect(bedPeak(fitted, fitted)).toBeCloseTo(0.5);
    expect(fitChannel(short, n - 1)).toBe(short);
  });

  it('refuses a silent or NaN bed', () => {
    expect(() => bedPeak(new Float32Array(10), new Float32Array(10))).toThrow(/silent/);
    expect(() => bedPeak(new Float32Array([NaN, 1]), new Float32Array(2))).toThrow(/silent/);
  });

  it('only loads instruments that are in the pinned sample manifest (or the Kawai bank)', () => {
    const m = instrumentManifest();
    expect(m.commit).toMatch(/^[0-9a-f]{40}$/);
    for (const insts of Object.values(STYLE_INSTRUMENTS)) {
      for (const i of insts) {
        if (i === KAWAI) continue;
        expect(m.instruments[i]?.length ?? 0).toBeGreaterThan(0);
      }
    }
    // The Tone.js ports of the original beds play the Kawai soft layer from assets/audio/piano.
    const soft = pianoFiles().filter((f) => f.layer === 4);
    expect(soft.length).toBe(19);
  });

  it('the Tone.js ports play the same arrangement as the original beds', () => {
    for (const style of SCORE_STYLES) {
      expect(isToneStyle(`${style}-tone`)).toBe(true);
      expect(STYLE_INSTRUMENTS[`${style}-tone`]).toEqual([KAWAI]);
      const arr = scoreEvents({ style, seconds: 20, seed: 1, transpose: 0, cues: [0, 4, 9, 16] });
      expect(arr.events.filter((e) => e.type === 'piano').length).toBeGreaterThan(50);
      expect(arr.events.some((e) => e.type === 'kick')).toBe(true);
    }
  });
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bed-'));

describe.skipIf(!hasBrowser)('music bed (Tone.js in headless Chromium)', () => {
  it('lasts as long as the video, sits at a fixed loudness and follows the cues', async () => {
    const out = path.join(dir, 'pulse.wav');
    await synthesizePad(out, 10, 'pulse', { cues: [0, 3, 7] });
    expect(Number((await probe(out)).format.duration)).toBeGreaterThanOrEqual(10);
    const { lufs } = await loudness(out);
    expect(lufs).toBeGreaterThan(-19);
    expect(lufs).toBeLessThan(-16);
  }, 120_000);

  it('is reproducible for a given seed (to float noise) and changes with the seed', async () => {
    // Chromium's audio graph can differ in the last float bits between runs (~-140 dB), so compare
    // the difference energy rather than bytes.
    const diffDb = (x: Float32Array, y: Float32Array) => {
      let d = 0;
      let sig = 0;
      for (let i = 0; i < Math.min(x.length, y.length); i++) {
        d += (x[i] - y[i]) ** 2;
        sig += x[i] ** 2;
      }
      return 10 * Math.log10(d / sig);
    };
    const a = await renderToneBed('pulse', 5, { seed: 1, cues: [0, 2] });
    const b = await renderToneBed('pulse', 5, { seed: 1, cues: [0, 2] });
    const c = await renderToneBed('pulse', 5, { seed: 2, cues: [0, 2] });
    expect(diffDb(a.left, b.left)).toBeLessThan(-100);
    expect(diffDb(a.left, c.left)).toBeGreaterThan(-20);
  }, 180_000);
});
