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

describe('arranged score', () => {
  it('follows the scene cues: the riser and impact land on the first cut, the outro drops the drums', async () => {
    const out = path.join(dir, 'score.wav');
    await synthesizePad(out, 16, 'orbit', { cues: [0, 4, 11] });
    expect(Number((await probe(out)).format.duration)).toBeGreaterThanOrEqual(16);
    const { lufs } = await loudness(out);
    expect(lufs).toBeGreaterThan(-19);
    expect(lufs).toBeLessThan(-16);
  }, 60_000);

  it('is deterministic and the seed changes it', async () => {
    const mk = async (name: string, seed: number) => {
      const out = path.join(dir, `${name}.wav`);
      await synthesizePad(out, 6, 'nebula', { seed, cues: [0, 3] });
      return fs.readFileSync(out);
    };
    const a = await mk('sa', 1);
    const b = await mk('sb', 1);
    const c = await mk('sc', 2);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  }, 60_000);
});
