/** Minimal PCM helpers: no dependencies, fully unit-tested. */

export function encodeWav16(samples: Float32Array, sampleRate: number): Buffer {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  return buf;
}

/** Trim near-silence at both ends, keeping a little padding so consonants are not clipped. */
export function trimSilence(
  samples: Float32Array,
  sampleRate: number,
  threshold = 0.004,
  padStartSec = 0.01,
  padEndSec = 0.02,
): Float32Array {
  let s = 0,
    e = samples.length;
  while (s < e && Math.abs(samples[s]) < threshold) s++;
  while (e > s && Math.abs(samples[e - 1]) < threshold) e--;
  return samples.slice(
    Math.max(0, s - Math.round(padStartSec * sampleRate)),
    Math.min(samples.length, e + Math.round(padEndSec * sampleRate)),
  );
}

export function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export const silence = (seconds: number, sampleRate: number): Float32Array =>
  new Float32Array(Math.round(seconds * sampleRate));
