/**
 * Pure timing helpers shared by the Node pipeline and the Remotion bundle.
 * Keep this file free of Node-only imports.
 */
import type { SceneTimeline, Sentence, TimeRef, Timeline } from './schemas';

/** Silence kept after each scene's narration before the next scene starts. */
export const SCENE_TAIL_SEC = 0.25;

/**
 * The last scene holds longer after its final word, so the video ends on the call to action and the
 * closing chord instead of cutting off mid-breath.
 */
export const END_HOLD_SEC = 1.6;

export const sceneFrames = (scene: SceneTimeline, fps: number, last = false): number =>
  Math.ceil((scene.duration + SCENE_TAIL_SEC + (last ? END_HOLD_SEC : 0)) * fps);

export function sceneStarts(timeline: Timeline, fps: number): { sceneId: string; from: number; frames: number }[] {
  let from = 0;
  return timeline.scenes.map((s, i) => {
    const frames = sceneFrames(s, fps, i === timeline.scenes.length - 1);
    const r = { sceneId: s.sceneId, from, frames };
    from += frames;
    return r;
  });
}

export const totalFrames = (timeline: Timeline, fps: number): number =>
  timeline.scenes.reduce((n, s, i) => n + sceneFrames(s, fps, i === timeline.scenes.length - 1), 0);

/** Resolve a TimeRef to seconds from scene start. Sentence refs past the end clamp to the last sentence. */
export function resolveTime(ref: TimeRef, sentences: Sentence[]): number {
  if (typeof ref === 'number') return ref;
  const s = sentences[Math.min(ref.sentence, sentences.length - 1)];
  if (!s) return 0;
  const edge = ref.edge ?? 'start';
  const offset = ref.offset ?? 0;
  return Math.max(0, (edge === 'end' ? s.end : s.start) + offset);
}

/** Visibility 0..1 of an element shown from `from` until `to`, with short fades. */
export function windowOpacity(t: number, from: number, to: number | undefined, fade = 0.3): number {
  const fin = Math.min(1, Math.max(0, (t - from) / fade));
  const fout = to === undefined ? 1 : Math.min(1, Math.max(0, (to - t) / fade));
  return Math.min(fin, fout);
}
