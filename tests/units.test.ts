import { describe, expect, it } from 'vitest';
import { hashData, stableStringify } from '../src/core/io';
import { resolveTime, sceneStarts, totalFrames, windowOpacity } from '../src/core/timing';
import type { Timeline } from '../src/core/schemas';
import { parseEbur128 } from '../src/render/media';
import { concat, encodeWav16, trimSilence } from '../src/voice/audio';
import { captionChunks, estimateWordTimings } from '../src/voice/timing';
import { pickRendition } from '../src/assets/nasa';

describe('io', () => {
  it('stableStringify ignores key order and undefined', () => {
    expect(stableStringify({ b: 1, a: [2, { d: undefined, c: 3 }] })).toBe('{"a":[2,{"c":3}],"b":1}');
    expect(hashData({ a: 1, b: 2 })).toBe(hashData({ b: 2, a: 1 }));
    expect(hashData({ a: 1 })).not.toBe(hashData({ a: 2 }));
  });
});

describe('timing', () => {
  const timeline: Timeline = {
    engine: 'x',
    voice: 'v',
    narrationHash: 'h',
    timing: 'estimated-proportional',
    scenes: [
      {
        sceneId: 'a',
        audioFile: 'voice/a.wav',
        duration: 2,
        sentences: [
          { text: 's', start: 0.15, end: 1.0, words: [] },
          { text: 't', start: 1.3, end: 1.9, words: [] },
        ],
      },
      { sceneId: 'b', audioFile: 'voice/b.wav', duration: 1, sentences: [] },
    ],
  };

  it('lays scenes out back to back with a tail', () => {
    expect(sceneStarts(timeline, 30)).toEqual([
      { sceneId: 'a', from: 0, frames: 68 },
      { sceneId: 'b', from: 68, frames: 38 },
    ]);
    expect(totalFrames(timeline, 30)).toBe(106);
  });

  it('resolves sentence-anchored time refs', () => {
    const s = timeline.scenes[0].sentences;
    expect(resolveTime(2, s)).toBe(2);
    expect(resolveTime({ sentence: 1, edge: 'start', offset: 0 }, s)).toBe(1.3);
    expect(resolveTime({ sentence: 0, edge: 'end', offset: -0.5 }, s)).toBe(0.5);
    expect(resolveTime({ sentence: 9, edge: 'end', offset: 0 }, s)).toBe(1.9);
  });

  it('fades windows in and out', () => {
    expect(windowOpacity(0, 1, undefined)).toBe(0);
    expect(windowOpacity(1.15, 1, undefined)).toBeCloseTo(0.5);
    expect(windowOpacity(5, 1, 3)).toBe(0);
  });
});

describe('voice helpers', () => {
  it('estimates word timings that cover the sentence', () => {
    const s = estimateWordTimings('Look high in the south-east.', 1, 2);
    expect(s.words[0].start).toBe(1);
    expect(s.words[s.words.length - 1].end).toBe(3);
    for (let i = 1; i < s.words.length; i++) expect(s.words[i].start).toBeCloseTo(s.words[i - 1].end, 3);
  });

  it('chunks captions at punctuation and size', () => {
    const w = 'One two three four five. Six'.split(' ').map((x) => ({ w: x }));
    expect(captionChunks(w).map((c) => c.map((x) => x.w).join(' '))).toEqual(['One two three four', 'five.', 'Six']);
  });

  it('encodes a valid 16-bit mono WAV', () => {
    const buf = encodeWav16(new Float32Array([0, 1, -1, 2]), 24000);
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buf.readUInt32LE(24)).toBe(24000);
    expect(buf.readInt16LE(46)).toBe(32767);
    expect(buf.readInt16LE(50)).toBe(32767); // clipped
  });

  it('trims silence but keeps padding', () => {
    const s = concat([new Float32Array(1000), new Float32Array([0.5, 0.5]), new Float32Array(1000)]);
    const t = trimSilence(s, 1000, 0.004, 0.01, 0.02);
    expect(t.length).toBe(2 + 10 + 20);
  });
});

describe('media parsing', () => {
  it('reads integrated loudness and true peak from ebur128 summary', () => {
    const out =
      'frame...\n[Parsed_ebur128_0] Summary:\n\n  Integrated loudness:\n    I:         -14.1 LUFS\n\n  True peak:\n    Peak:       -1.6 dBFS\n';
    expect(parseEbur128(out)).toEqual({ lufs: -14.1, truePeak: -1.6 });
  });
});

describe('nasa', () => {
  it('prefers the large JPEG rendition over orig/medium', () => {
    expect(pickRendition(['a~orig.tif', 'a~orig.jpg', 'a~large.jpg', 'a~medium.jpg', 'meta.json'])).toBe('a~large.jpg');
    expect(pickRendition(['a~orig.jpg', 'a~small.jpg'])).toBe('a~orig.jpg');
    expect(pickRendition(['x.json'])).toBeUndefined();
  });
});
