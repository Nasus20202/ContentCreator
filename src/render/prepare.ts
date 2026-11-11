/** Assemble everything the Remotion composition needs into one validated props object. */
import type { AssetRecord, Location, Plan, RenderProps, Timeline } from '../core/schemas';
import { PipelineError } from '../core/io';
import { orbitSnapshot, skySnapshot } from '../planning/astro/snapshot';

export const FPS = 30;

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

  return { plan, timeline, sky, orbits, assets: assetMap, musicFile, fps: FPS };
}
