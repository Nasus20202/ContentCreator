import React from 'react';
import type { SkySnapshot, SkyTarget, SkyViewParams } from '../../src/core/schemas';
import { useSceneTime } from '../scene-context';
import { SkyCanvas, type SkyOverlay } from '../sky/SkyCanvas';
import { type Cam, azAlt, camAt, midpoint } from '../sky/projection';

export function targetAzAlt(sky: SkySnapshot, target: SkyTarget): { az: number; alt: number } {
  const body = (n: string) => {
    const b = sky.bodies.find((x) => x.name === n);
    if (!b) throw new Error(`Body ${n} missing from sky snapshot`);
    return b.v;
  };
  if ('body' in target) return azAlt(body(target.body));
  if ('midpoint' in target) return azAlt(midpoint(body(target.midpoint[0]), body(target.midpoint[1])));
  if ('azAlt' in target) return { az: target.azAlt[0], alt: target.azAlt[1] };
  if (!sky.radiant) throw new Error('Radiant target without radiant in snapshot');
  return azAlt(sky.radiant);
}

/** Render-able sky with keyframed camera + overlays, all driven by plan params. */
export const SkyView: React.FC<{
  sky: SkySnapshot;
  params: Pick<SkyViewParams, 'camera'> & Partial<SkyViewParams>;
}> = ({ sky, params }) => {
  const { t, at, win } = useSceneTime();
  const keys = params.camera
    .map((k) => {
      const c = targetAzAlt(sky, k.target);
      return { t: at(k.at), cam: { az: c.az + k.dAz, alt: c.alt + k.dAlt, fov: k.fov } satisfies Cam };
    })
    .sort((a, b) => a.t - b.t);
  const cam = camAt(t, keys);

  const overlay: SkyOverlay = {
    labels: (params.labels ?? []).map((l) => ({
      body: l.body,
      text: l.text,
      sub: l.sub,
      side: l.side,
      opacity: win(l.from, l.to),
    })),
    starLabels: (params.starLabels ?? []).map((s) => ({ name: s.name, opacity: win(s.from, s.to) })),
    separation: params.separation && {
      ...params.separation,
      opacity: win(params.separation.from, params.separation.to),
    },
    moonCompare: params.moonCompare && {
      ...params.moonCompare,
      opacity: win(params.moonCompare.from, params.moonCompare.to),
    },
    constellation: params.constellation && {
      ...params.constellation,
      opacity: win(params.constellation.from, params.constellation.to),
    },
    meteors: params.meteors && {
      perSecond: params.meteors.perSecond,
      opacity: win(params.meteors.from, params.meteors.to),
      startSec: at(params.meteors.from),
    },
    showRadiant: params.meteors ? win(params.meteors.from, params.meteors.to) : 0,
    twilight: params.twilight ?? 0.3,
    lineOpacity: params.constellationLines ?? 0.08,
  };
  return <SkyCanvas sky={sky} cam={cam} overlay={overlay} />;
};

export const SkyViewScene: React.FC<{ sceneId: string; params: SkyViewParams }> = ({ sceneId, params }) => {
  const { props } = useSceneTime();
  const sky = props.sky[sceneId];
  if (!sky) throw new Error(`No sky snapshot for scene ${sceneId}`);
  return <SkyView sky={sky} params={params} />;
};
