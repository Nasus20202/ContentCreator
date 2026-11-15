import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { renderScore, SCORE_STYLES, type PianoNote } from '../src/render/score';

/** A deterministic stand-in piano (no sample files), so the arrangement itself is pinned. */
function fakePiano(midi: number): PianoNote {
  const n = 4000;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    left[i] = Math.sin(i * 0.01 * (1 + (midi % 12) / 12)) * Math.exp(-i / 1500);
    right[i] = left[i] * 0.9;
  }
  return { left, right, ratio: 1 + (midi % 3) * 0.01 };
}

const hash = (a: Float32Array, b: Float32Array) =>
  crypto.createHash('sha256').update(Buffer.from(a.buffer)).update(Buffer.from(b.buffer)).digest('hex').slice(0, 16);

describe('original score beds stay bit-exact', () => {
  it.each(SCORE_STYLES)('%s', (style) => {
    const [l, r] = renderScore({
      style,
      seconds: 20,
      sampleRate: 22050,
      seed: 1,
      transpose: 0,
      cues: [0, 4, 9, 16],
      piano: fakePiano,
    });
    expect(hash(l, r)).toMatchSnapshot();
  });
});
