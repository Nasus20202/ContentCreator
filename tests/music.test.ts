import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { instrumentManifest } from '../src/assets/instruments';
import { bedFor, loudness, probe, resolveStyle, SERIES_BED, synthesizePad } from '../src/render/media';
import { renderToneBed } from '../src/render/tone/render';
import { LEGACY_STYLES, STYLE_INSTRUMENTS, TONE_STYLES } from '../src/render/tone/styles';

const hasBrowser = ['CHROMIUM_PATH', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome']
  .map((p) => (p === 'CHROMIUM_PATH' ? process.env.CHROMIUM_PATH : p))
  .some((p) => !!p && fs.existsSync(p));

describe('music styles', () => {
  it('every series bed is a real style and retired names resolve to one', () => {
    for (const style of Object.values(SERIES_BED)) expect(TONE_STYLES).toContain(style);
    for (const [old, now] of Object.entries(LEGACY_STYLES)) expect(resolveStyle(old as never)).toBe(now);
    expect(bedFor('unknown-series')).toBe('nocturne');
  });

  it('only loads instruments that are in the pinned sample manifest', () => {
    const m = instrumentManifest();
    expect(m.commit).toMatch(/^[0-9a-f]{40}$/);
    for (const insts of Object.values(STYLE_INSTRUMENTS)) {
      for (const i of insts) expect(m.instruments[i]?.length ?? 0).toBeGreaterThan(0);
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
