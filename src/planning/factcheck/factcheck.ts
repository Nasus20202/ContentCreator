/**
 * Automated fact-check: every number a viewer hears or reads must be backed by a fact
 * referenced from the same scene. Semantic correctness is reviewed separately by Claude
 * (and recorded), because a regex cannot tell "east" from "west".
 */
import type { Fact, Plan, Scene } from '../../core/schemas';
import { formatClock } from '../../core/clock';
import { extractNumbers, matchesValue, type NumberMention } from './numbers';

export interface ClaimCheck {
  sceneId: string;
  where: string;
  text: string;
  number: number;
  raw: string;
  matchedFact?: string;
}

export interface FactcheckResult {
  ok: boolean;
  claims: ClaimCheck[];
  problems: string[];
}

/** Every piece of text a scene puts in front of the viewer, with where it comes from. */
export function sceneTexts(scene: Scene): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = scene.narration.map((text, i) => ({ where: `narration[${i}]`, text }));
  scene.chips.forEach((c, i) => out.push({ where: `chips[${i}]`, text: c.text }));
  if (scene.title) out.push({ where: 'title', text: `${scene.title.kicker} ${scene.title.title}` });
  switch (scene.template) {
    case 'skyView': {
      const p = scene.params;
      p.labels.forEach((l, i) => out.push({ where: `labels[${i}]`, text: [l.text, l.sub].filter(Boolean).join(' ') }));
      if (p.separation) out.push({ where: 'separation', text: p.separation.text });
      break;
    }
    case 'image':
      if (scene.params.marker) out.push({ where: 'marker', text: scene.params.marker.label });
      break;
    case 'factCard':
      out.push({ where: 'factCard', text: `${scene.params.value} ${scene.params.label}` });
      break;
    case 'compare':
      if (scene.params.heading) out.push({ where: 'heading', text: scene.params.heading });
      scene.params.bars.forEach((b, i) => out.push({ where: `bars[${i}]`, text: `${b.display} ${b.label}` }));
      if (scene.params.note) out.push({ where: 'note', text: scene.params.note });
      break;
    case 'scale':
      out.push({ where: 'scale', text: scene.params.totalLabel });
      scene.params.markers.forEach((m, i) => out.push({ where: `markers[${i}]`, text: m.label }));
      break;
    case 'journey':
      scene.params.stops.forEach((st, i) =>
        out.push({ where: `stops[${i}]`, text: [st.name, st.sub, st.arrive].filter(Boolean).join(' ') }),
      );
      // A clock that starts at zero makes no claim; its start reading is only checked when it is not 0.
      scene.params.clocks.forEach((c, i) =>
        out.push({
          where: `clocks[${i}]`,
          text: [
            c.label,
            c.from > 0 ? formatClock(c.from, c.unit, c.decimals) : '',
            formatClock(c.to, c.unit, c.decimals),
          ]
            .filter(Boolean)
            .join(' '),
        }),
      );
      if (scene.params.backdrop) out.push({ where: 'backdrop', text: scene.params.backdrop.label });
      break;
    case 'laps':
      out.push({
        where: 'laps',
        text: [String(scene.params.laps), scene.params.label, scene.params.note].filter(Boolean).join(' '),
      });
      break;
    case 'outro':
      out.push({
        where: 'outro',
        text: [scene.params.kicker, scene.params.cta, scene.params.footnote].filter(Boolean).join(' '),
      });
      break;
    default:
      break;
  }
  return out;
}

/**
 * Find the fact that backs a number. Preference order keeps attribution honest:
 * exact explicit value → exact number in the statement → approximate value → approximate statement number.
 */
export function findBackingFact(n: number | NumberMention, facts: Fact[]): Fact | undefined {
  const m: NumberMention = typeof n === 'number' ? { raw: String(n), value: n, kind: 'number' } : n;
  const statementNums = new Map(
    facts.map((f) => [
      f.id,
      extractNumbers(f.statement)
        .filter((x) => x.kind === m.kind)
        .map((x) => x.value),
    ]),
  );
  // explicit values are plain numbers; clock times can only be backed by times written in statements
  const values = (f: Fact) => (m.kind === 'number' ? f.values : []);
  const passes: ((f: Fact) => boolean)[] = [
    (f) => values(f).includes(m.value),
    (f) => statementNums.get(f.id)!.includes(m.value),
    (f) => values(f).some((v) => matchesValue(m.value, v)),
    (f) => m.kind === 'number' && statementNums.get(f.id)!.some((v) => matchesValue(m.value, v)),
  ];
  for (const p of passes) {
    const hit = facts.find(p);
    if (hit) return hit;
  }
  return undefined;
}

export function factcheckPlan(plan: Plan, facts: Fact[]): FactcheckResult {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const claims: ClaimCheck[] = [];
  const problems: string[] = [];

  for (const scene of plan.scenes) {
    for (const id of scene.factIds) {
      if (!byId.has(id)) problems.push(`${scene.id}: references unknown fact "${id}"`);
    }
    const sceneFacts = scene.factIds.map((id) => byId.get(id)).filter((f): f is Fact => !!f);
    for (const { where, text } of sceneTexts(scene)) {
      for (const m of extractNumbers(text)) {
        const hit = findBackingFact(m, sceneFacts);
        claims.push({ sceneId: scene.id, where, text, number: m.value, raw: m.raw, matchedFact: hit?.id });
        if (!hit)
          problems.push(
            `${scene.id}.${where}: "${m.raw}" (${m.value}) is not backed by any fact on this scene — "${text}"`,
          );
      }
    }
  }

  // post copy may quote any fact used somewhere in the video
  const usedFacts = [...new Set(plan.scenes.flatMap((s) => s.factIds))]
    .map((id) => byId.get(id))
    .filter((f): f is Fact => !!f);
  for (const [where, text] of [
    ['title', plan.post.title],
    ['description', plan.post.description],
  ] as const) {
    for (const m of extractNumbers(text)) {
      const hit = findBackingFact(m, usedFacts);
      claims.push({ sceneId: 'post', where, text, number: m.value, raw: m.raw, matchedFact: hit?.id });
      if (!hit) problems.push(`post.${where}: "${m.raw}" (${m.value}) is not backed by any fact used in the video`);
    }
  }
  return { ok: problems.length === 0, claims, problems };
}
