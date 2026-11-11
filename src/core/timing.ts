/**
 * Pure timing helpers shared by the Node pipeline and the Remotion bundle.
 * Keep this file free of Node-only imports.
 */
import type { SceneTimeline, Sentence, TimeRef, Timeline } from './schemas';

/** Silence kept after each scene's narration before the next scene starts. */
export const SCENE_TAIL_SEC = 0.25;

export const sceneFrames = (scene: SceneTimeline, fps: number): number =>
  Math.ceil((scene.duration + SCENE_TAIL_SEC) * fps);

export function sceneStarts(timeline: Timeline, fps: number): { sceneId: string; from: number; frames: number }[] {
  let from = 0;
  return timeline.scenes.map((s) => {
    const frames = sceneFrames(s, fps);
    const r = { sceneId: s.sceneId, from, frames };
    from += frames;
    return r;
  });
}

export const totalFrames = (timeline: Timeline, fps: number): number =>
  timeline.scenes.reduce((n, s) => n + sceneFrames(s, fps), 0);

/** Resolve a TimeRef to seconds from scene start. Sentence refs past the end clamp to the last sentence. */
export function resolveTime(ref: TimeRef, sentences: Sentence[]): number {
  if (typeof ref === 'number') return ref;
  const s = sentences[Math.min(ref.sentence, sentences.length - 1)];
  if (!s) return 0;
  return Math.max(0, (ref.edge === 'end' ? s.end : s.start) + ref.offset);
}

/** Visibility 0..1 of an element shown from `from` until `to`, with short fades. */
export function windowOpacity(t: number, from: number, to: number | undefined, fade = 0.3): number {
  const fin = Math.min(1, Math.max(0, (t - from) / fade));
  const fout = to === undefined ? 1 : Math.min(1, Math.max(0, (to - t) / fade));
  return Math.min(fin, fout);
}
