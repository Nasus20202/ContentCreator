/**
 * Narration → per-scene WAV files + timeline.json, using Kokoro-82M locally on CPU.
 * The model is downloaded once from Hugging Face and cached by transformers.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Plan, Timeline } from '../core/schemas';
import { hashData } from '../core/io';
import { concat, encodeWav16, silence, trimSilence } from './audio';
import { estimateWordTimings } from './timing';

export const TTS_ENGINE = 'kokoro-82M-v1.0-onnx-q8';
const SENTENCE_GAP_SEC = 0.28;
const LEAD_IN_SEC = 0.15;

export interface TtsEngine {
  generate(text: string, voice: string, speed: number): Promise<{ audio: Float32Array; sampleRate: number }>;
}

export async function loadKokoro(): Promise<TtsEngine> {
  const { KokoroTTS } = await import('kokoro-js');
  const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
  return {
    async generate(text, voice, speed) {
      // kokoro-js types the voice as a literal union; channel config is validated upstream
      const out = await tts.generate(text, { voice: voice as never, speed });
      return { audio: out.audio, sampleRate: out.sampling_rate };
    },
  };
}

/** Voice depends only on the spoken words and voice settings — camera or label edits must not invalidate it. */
export const narrationHash = (plan: Plan): string =>
  hashData({ voice: plan.voice, scenes: plan.scenes.map((s) => [s.id, s.narration]) });

export async function synthesizePlan(
  plan: Plan,
  outDir: string,
  engine: TtsEngine,
  onScene?: (id: string, sec: number) => void,
): Promise<Timeline> {
  fs.mkdirSync(outDir, { recursive: true });
  const scenes: Timeline['scenes'] = [];
  for (const scene of plan.scenes) {
    const parts: Float32Array[] = [];
    const sentences: Timeline['scenes'][number]['sentences'] = [];
    let sampleRate = 24000;
    let t = LEAD_IN_SEC;
    parts.push(silence(LEAD_IN_SEC, sampleRate));
    for (const line of scene.narration) {
      const res = await engine.generate(line, plan.voice.id, plan.voice.speed);
      sampleRate = res.sampleRate;
      const seg = trimSilence(res.audio, sampleRate);
      const dur = seg.length / sampleRate;
      sentences.push(estimateWordTimings(line, t, dur));
      parts.push(seg, silence(SENTENCE_GAP_SEC, sampleRate));
      t += dur + SENTENCE_GAP_SEC;
    }
    const audio = concat(parts);
    const file = `voice/${scene.id}.wav`;
    fs.writeFileSync(path.join(outDir, `${scene.id}.wav`), encodeWav16(audio, sampleRate));
    const duration = Math.round((audio.length / sampleRate) * 1000) / 1000;
    scenes.push({ sceneId: scene.id, audioFile: file, duration, sentences });
    onScene?.(scene.id, duration);
  }
  return {
    engine: TTS_ENGINE,
    voice: plan.voice.id,
    narrationHash: narrationHash(plan),
    timing: 'estimated-proportional',
    scenes,
  };
}
