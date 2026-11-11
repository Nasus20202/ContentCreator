/**
 * Structural validation beyond the zod schema: cross-references between scenes, facts,
 * assets and template parameters. Catches plans that would render wrong rather than crash.
 */
import type { AssetRecord, Fact, Plan, Scene, TimeRef } from '../core/schemas';

export interface PlanIssue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

const NARRATION_WORDS_PER_SEC = 2.6;
const MAX_SECONDS = 59;

function sentenceRefs(t: TimeRef | undefined): number[] {
  return t !== undefined && typeof t === 'object' ? [t.sentence] : [];
}

function timeRefsOf(scene: Scene): TimeRef[] {
  const refs: (TimeRef | undefined)[] = [];
  scene.chips.forEach((c) => refs.push(c.from, c.to));
  if (scene.title) refs.push(scene.title.from, scene.title.to);
  if (scene.template === 'skyView') {
    const p = scene.params;
    p.camera.forEach((k) => refs.push(k.at));
    p.labels.forEach((l) => refs.push(l.from, l.to));
    p.starLabels.forEach((l) => refs.push(l.from, l.to));
    if (p.separation) refs.push(p.separation.from, p.separation.to);
    if (p.moonCompare) refs.push(p.moonCompare.from, p.moonCompare.to);
    if (p.constellation) refs.push(p.constellation.from, p.constellation.to);
    if (p.meteors) refs.push(p.meteors.from, p.meteors.to);
  }
  if (scene.template === 'orbit3d') refs.push(scene.params.revealAt, scene.params.distancesAt);
  return refs.filter((r): r is TimeRef => r !== undefined);
}

export function validatePlan(plan: Plan, facts: Fact[], assets: AssetRecord[] = []): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ level: 'warning', where, message });
  const factIds = new Set(facts.map((f) => f.id));

  const ids = new Set<string>();
  for (const s of plan.scenes) {
    if (ids.has(s.id)) err(s.id, 'duplicate scene id');
    ids.add(s.id);

    for (const f of s.factIds) if (!factIds.has(f)) err(s.id, `unknown fact "${f}"`);
    for (const r of timeRefsOf(s).flatMap(sentenceRefs)) {
      if (r >= s.narration.length)
        err(s.id, `time reference to sentence ${r}, but scene has ${s.narration.length} sentences`);
    }

    if (s.template === 'skyView') {
      const p = s.params;
      const bodies = new Set(p.bodies);
      const need = (b: string, what: string) => {
        if (!bodies.has(b)) err(s.id, `${what} references "${b}" which is not in params.bodies`);
      };
      p.labels.forEach((l) => need(l.body, 'label'));
      if (p.separation) [p.separation.a, p.separation.b].forEach((b) => need(b, 'separation'));
      if (p.moonCompare) [p.moonCompare.a, p.moonCompare.b].forEach((b) => need(b, 'moonCompare'));
      for (const k of p.camera) {
        if ('body' in k.target) need(k.target.body, 'camera');
        if ('midpoint' in k.target) k.target.midpoint.forEach((b) => need(b, 'camera'));
        if ('radiant' in k.target && !p.radiant) err(s.id, 'camera targets radiant but params.radiant is missing');
      }
      if (p.meteors && !p.radiant) err(s.id, 'meteors need params.radiant');
    }
    if (s.template === 'orbit3d') {
      const b = new Set<string>(s.params.bodies);
      if (!b.has('Earth')) err(s.id, 'orbit3d must include Earth (the viewpoint)');
      if (s.params.lineOfSight && !b.has(s.params.lineOfSight.to)) err(s.id, 'lineOfSight.to not in bodies');
    }
    if (s.template === 'image') {
      const a = assets.find((x) => x.id === s.params.assetId);
      if (!a) err(s.id, `unknown asset "${s.params.assetId}" (add it with: cc asset add)`);
      else if (a.aiGenerated)
        warn(s.id, `asset "${a.id}" is AI-generated; channel policy prefers real imagery and requires disclosure`);
    }

    const words = s.narration.join(' ').split(/\s+/).length;
    if (words / NARRATION_WORDS_PER_SEC < 2.5) warn(s.id, 'very short scene (<2.5 s of narration)');
  }

  const words = plan.scenes
    .flatMap((s) => s.narration)
    .join(' ')
    .split(/\s+/).length;
  const estimate = words / NARRATION_WORDS_PER_SEC;
  if (estimate > MAX_SECONDS)
    err('plan', `narration ≈ ${Math.round(estimate)} s; shorts must stay under ${MAX_SECONDS} s`);

  const first = plan.scenes[0];
  if (first.narration[0].split(/\s+/).length > 14)
    warn(first.id, 'hook sentence is long; the first line should land in under ~3 s');
  if (plan.scenes[plan.scenes.length - 1].template !== 'outro') warn('plan', 'last scene is not an outro');

  return issues;
}
