import type { Sentence } from '../core/schemas';

/**
 * Kokoro does not return word timestamps, so word times are estimated by distributing the
 * sentence duration proportionally to word length, with extra weight for punctuation pauses.
 * Good enough for highlighted captions; documented as a known limitation (see docs/pipeline.md).
 */
export function estimateWordTimings(text: string, start: number, duration: number): Sentence {
  const words = text.split(/\s+/).filter(Boolean);
  const weights = words.map((w) => w.replace(/[^\p{L}\p{N}']/gu, '').length + 2 + (/[.,;:!?]$/.test(w) ? 3 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return {
    text,
    start: r(start),
    end: r(start + duration),
    words: words.map((w, i) => {
      const s = start + (acc / total) * duration;
      acc += weights[i];
      return { w, start: r(s), end: r(start + (acc / total) * duration) };
    }),
  };
}

/** Split a sentence's words into caption chunks: at most `max` words, breaking after punctuation. */
export function captionChunks<T extends { w: string }>(words: T[], max = 4): T[][] {
  const chunks: T[][] = [];
  let cur: T[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= max || /[.,!?;:]$/.test(w.w)) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}
