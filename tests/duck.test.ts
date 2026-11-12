import { describe, expect, it } from 'vitest';
import { musicDuck, speechWindows, DUCK_DEPTH } from '../video/duck';
import type { RenderProps } from '../src/core/schemas';

const fps = 30;
const timeline = (scenes: { duration: number; sentences: [number, number][] }[]) =>
  ({
    scenes: scenes.map((s, i) => ({
      sceneId: `s${i}`,
      audioFile: '',
      duration: s.duration,
      sentences: s.sentences.map(([start, end]) => ({ text: '', start, end, words: [] })),
    })),
  }) as unknown as RenderProps['timeline'];

describe('bed ducking', () => {
  it('keeps one speech island across a short scene-change gap', () => {
    // Scene 1 ends at 3.25 s; scene 2 starts at 3.55 s (0.3 s gap).
    const t = timeline([
      { duration: 3.5, sentences: [[0.15, 3.25]] },
      { duration: 3, sentences: [[0.15, 2.5]] },
    ]);
    expect(speechWindows(t, fps)).toHaveLength(1);
  });

  it('keeps separate islands for a real pause', () => {
    const t = timeline([
      {
        duration: 8,
        sentences: [
          [0.1, 2],
          [5, 7],
        ],
      },
    ]);
    expect(speechWindows(t, fps)).toHaveLength(2);
  });

  it('does not dip during a scene change', () => {
    const t = timeline([
      { duration: 3.5, sentences: [[0.15, 3.25]] },
      { duration: 3, sentences: [[0.15, 2.5]] },
    ]);
    const w = speechWindows(t, fps);
    const boundary = Math.round(3.4 * fps);
    expect(musicDuck(boundary, w, fps)).toBeCloseTo(DUCK_DEPTH, 2);
  });

  it('returns to full level in a real pause', () => {
    const t = timeline([
      {
        duration: 8,
        sentences: [
          [0.1, 2],
          [5, 7],
        ],
      },
    ]);
    const w = speechWindows(t, fps);
    expect(musicDuck(Math.round(3.5 * fps), w, fps)).toBe(1);
  });
});
