/** Assemble everything the Remotion composition needs into one validated props object. */
import type { AssetRecord, Location, Plan, RenderProps, Timeline } from '../core/schemas';
import { PipelineError } from '../core/io';
import { resolveTime } from '../core/timing';
import { orbitSnapshot, skySnapshot } from '../planning/astro/snapshot';
import { accentFor } from './palette';

export const FPS = 30;

/**
 * Chips share one row near the top of the frame, so two visible at the same time render on top of
 * each other and the text becomes unreadable. Only the resolved timeline can tell whether windows
 * collide, which is why this lives here and not in plan validation.
 */
function assertChipsDoNotOverlap(plan: Plan, timeline: Timeline): void {
  plan.scenes.forEach((scene, i) => {
    if (scene.chips.length < 2) return;
    const sentences = timeline.scenes[i]?.sentences ?? [];
    const sceneEnd = timeline.scenes[i]?.duration ?? Number.POSITIVE_INFINITY;
    const windows = scene.chips
      .map((c, k) => ({
        k,
        text: c.text,
        from: resolveTime(c.from, sentences),
        to: c.to === undefined ? sceneEnd : resolveTime(c.to, sentences),
      }))
      .sort((a, b) => a.from - b.from);
    for (let k = 0; k + 1 < windows.length; k++) {
      const a = windows[k];
      const b = windows[k + 1];
      if (b.from < a.to - 1e-6) {
        throw new PipelineError(
          `Chips overlap in scene "${scene.id}"`,
          `chips[${a.k}] "${a.text}" is on screen until ${a.to.toFixed(2)} s, ` +
            `but chips[${b.k}] "${b.text}" starts at ${b.from.toFixed(2)} s. ` +
            `Give the first chip a \`to\` and start the next one at or after it.`,
        );
      }
    }
  });
}

export function buildRenderProps(
  plan: Plan,
  timeline: Timeline,
  location: Location | undefined,
  assets: AssetRecord[],
  musicFile?: string,
): RenderProps {
  const ids = timeline.scenes.map((s) => s.sceneId).join(',');
  if (ids !== plan.scenes.map((s) => s.id).join(',')) {
    throw new PipelineError('Timeline scenes do not match the plan', 'Re-run: cc voice <episode>');
  }
  assertChipsDoNotOverlap(plan, timeline);

  const sky: RenderProps['sky'] = {};
  const orbits: RenderProps['orbits'] = {};
  const needLoc = (): Location => {
    if (!location) throw new PipelineError('Sky scenes need a location on the episode');
    return location;
  };

  for (const s of plan.scenes) {
    if (s.template === 'skyView') sky[s.id] = skySnapshot(needLoc(), s.params.time, s.params.bodies, s.params.radiant);
    if (s.template === 'outro' && s.params.sky)
      sky[s.id] = skySnapshot(needLoc(), s.params.sky.time, s.params.sky.bodies);
    if (s.template === 'orbit3d') orbits[s.id] = orbitSnapshot(s.params.time, s.params.bodies);
  }

  const assetMap: RenderProps['assets'] = {};
  for (const a of assets) assetMap[a.id] = { file: a.file, credit: `${a.source.credit} · ${a.source.license}` };

  return { plan, timeline, sky, orbits, assets: assetMap, musicFile, accent: accentFor(plan.series), fps: FPS };
}
