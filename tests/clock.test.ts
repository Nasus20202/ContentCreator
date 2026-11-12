import { describe, expect, it } from 'vitest';
import { formatClock } from '../src/core/clock';
import { Scene } from '../src/core/schemas';
import { sceneTexts } from '../src/planning/factcheck/factcheck';

describe('formatClock', () => {
  it('prints minutes with seconds, rounding 59.9 s up to the next minute', () => {
    expect(formatClock(8.3333, 'min')).toBe('8 min 20 s');
    expect(formatClock(43, 'min')).toBe('43 min');
    expect(formatClock(7.999, 'min')).toBe('8 min');
  });
  it('prints years with separators and millions in words', () => {
    expect(formatClock(26000, 'years')).toBe('26,000 yrs');
    expect(formatClock(5_000_000, 'years')).toBe('5 million yrs');
    expect(formatClock(2_500_000, 'years')).toBe('2.5 million yrs');
    expect(formatClock(13_200_000_000, 'years')).toBe('13.2 billion yrs');
    expect(formatClock(4_000_000_000, 'years')).toBe('4 billion yrs');
  });
});

describe('journey fact-check texts', () => {
  const scene = Scene.parse({
    id: 'trip',
    template: 'journey',
    narration: ['Light leaves the Sun.'],
    params: {
      traveller: 'light',
      stops: [
        { name: 'Sun', at: 0, kind: 'sun' },
        { name: 'Earth', at: 1, kind: 'earth', sub: '150 million km', arrive: '8 min 20 s' },
      ],
      path: [0, 1],
      clocks: [
        { label: 'Light', from: 0, to: 8.3333, unit: 'min' },
        { label: 'Later', from: 8.3333, to: 43, unit: 'min' },
      ],
    },
  });
  const texts = sceneTexts(scene).map((t) => t.text);
  it('checks stop labels and clock end readings, and a zero start makes no claim', () => {
    expect(texts).toContain('Earth 150 million km 8 min 20 s');
    expect(texts).toContain('Light 8 min 20 s');
    expect(texts).toContain('Later 8 min 20 s 43 min');
  });
});
