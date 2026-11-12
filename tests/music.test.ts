import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loudness, probe, synthesizePad } from '../src/render/media';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bed-'));
const bed = (name: string, seconds: number, style: Parameters<typeof synthesizePad>[2] = 'piano', v = {}) => {
  const out = path.join(dir, `${name}.wav`);
  return synthesizePad(out, seconds, style, v).then(() => out);
};

describe('music bed', () => {
  it('lasts at least as long as the requested video', async () => {
    const out = await bed('len', 7);
    expect(Number((await probe(out)).format.duration)).toBeGreaterThanOrEqual(7);
  }, 60_000);

  it('is deterministic for a given seed and changes with the seed', async () => {
    const a = fs.readFileSync(await bed('a', 5, 'piano', { seed: 3 }));
    const b = fs.readFileSync(await bed('b', 5, 'piano', { seed: 3 }));
    const c = fs.readFileSync(await bed('c', 5, 'piano', { seed: 4 }));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  }, 60_000);

  it('sits at a fixed loudness, so variants are comparable', async () => {
    const out = await bed('lvl', 8, 'piano', { transpose: -2 });
    const { lufs } = await loudness(out);
    expect(lufs).toBeGreaterThan(-19);
    expect(lufs).toBeLessThan(-16);
  }, 60_000);
});
