import { createContext, useContext } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { RenderProps, SceneTimeline, TimeRef } from '../src/core/schemas';
import { resolveTime, windowOpacity } from '../src/core/timing';

export interface SceneCtx {
  timeline: SceneTimeline;
  props: RenderProps;
  durationSec: number;
}

export const SceneContext = createContext<SceneCtx | null>(null);

/** Current scene time plus helpers that resolve plan TimeRefs against this scene's sentences. */
export function useSceneTime() {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error('useSceneTime outside a scene');
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const at = (ref: TimeRef) => resolveTime(ref, ctx.timeline.sentences);
  const win = (from: TimeRef, to?: TimeRef) => windowOpacity(t, at(from), to === undefined ? undefined : at(to));
  return { t, fps, frame, at, win, ...ctx };
}
