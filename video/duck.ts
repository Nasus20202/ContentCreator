import { sceneStarts } from '../src/core/timing';
import type { RenderProps } from '../src/core/schemas';

/**
 * The bed is lifted above its plan level, so it stays audible in the pauses between sentences; then
 * narration pulls it down to DUCK_DEPTH of that lifted level. Without the lift the bed fell to
 * ~−33 dBFS in every pause, next to speech at ~−18 dBFS, and read as the music stopping.
 */
export const BED_LIFT = 2.2;
export const DUCK_DEPTH = 0.5;
export const DUCK_RAMP_SEC = 0.6;
/**
 * Sentences closer together than this are one speech island. Scene boundaries have ~0.3 s gaps;
 * ducking each sentence separately meant the 0.6 s ramps overlapped and the bed dipped at every
 * scene change. Treating the gap as speech keeps the bed steady across the cut.
 */
export const MERGE_GAP_SEC = 1.0;

/** Frame ranges [from, to) of narration, with nearby sentences merged into one window. */
export function speechWindows(timeline: RenderProps['timeline'], fps: number): [number, number][] {
  const raw: [number, number][] = [];
  const starts = sceneStarts(timeline, fps);
  timeline.scenes.forEach((scene, i) => {
    for (const sen of scene.sentences) {
      raw.push([starts[i].from + Math.round(sen.start * fps), starts[i].from + Math.round(sen.end * fps)]);
    }
  });
  const gap = MERGE_GAP_SEC * fps;
  const out: [number, number][] = [];
  for (const [a, b] of raw) {
    const last = out[out.length - 1];
    if (last && a - last[1] < gap) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** Bed gain multiplier at a frame: ramps down into each speech window and back up after it. */
export function musicDuck(frame: number, windows: [number, number][], fps: number): number {
  const ramp = DUCK_RAMP_SEC * fps;
  let w = 0;
  for (const [a, b] of windows) {
    const up = Math.min(1, Math.max(0, (frame - (a - ramp)) / ramp));
    const down = Math.min(1, Math.max(0, (b + ramp - frame) / ramp));
    w = Math.max(w, Math.min(up, down));
  }
  return 1 - (1 - DUCK_DEPTH) * w;
}
