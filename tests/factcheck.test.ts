import { describe, expect, it } from 'vitest';
import { factcheckPlan, findBackingFact, sceneTexts } from '../src/planning/factcheck/factcheck';
import { validatePlan } from '../src/planning/validate-plan';
import { facts, plan } from './fixtures';

describe('factcheckPlan', () => {
  it('passes when every number is backed by a scene fact', () => {
    const r = factcheckPlan(plan(), facts);
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.claims.find((c) => c.raw === 'two hundred million')?.matchedFact).toBe('dist');
  });

  it('flags a number that no fact on the scene supports', () => {
    const p = plan();
    p.scenes[0].narration[0] = 'On November sixteenth they are three degrees apart.';
    const r = factcheckPlan(p, facts);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/"three" \(3\)/);
  });

  it('does not let a scene borrow facts it does not cite', () => {
    const p = plan();
    p.scenes[0].narration.push('Expect fifteen meteors an hour.');
    expect(factcheckPlan(p, facts).ok).toBe(false);
    p.scenes[0].factIds.push('zhr');
    expect(factcheckPlan(p, facts).ok).toBe(true);
  });

  it('checks on-screen text and post copy too', () => {
    const p = plan();
    p.scenes[0].chips = [{ text: 'MON NOV 17', from: 0 }];
    expect(factcheckPlan(p, facts).problems.some((x) => x.includes('chips[0]'))).toBe(true);
    const q = plan({ post: { title: 'On Nov 18', description: '', hashtags: [] } });
    expect(factcheckPlan(q, facts).problems.some((x) => x.includes('post.title'))).toBe(true);
  });

  it('reports unknown fact ids', () => {
    const p = plan();
    p.scenes[0].factIds.push('nope');
    expect(factcheckPlan(p, facts).problems).toContain('conj: references unknown fact "nope"');
  });

  it('prefers explicit values over numbers inside statements', () => {
    expect(findBackingFact(15, facts)?.id).toBe('zhr');
  });

  it('collects label, separation and chip texts', () => {
    const where = sceneTexts(plan().scenes[0]).map((t) => t.where);
    expect(where).toEqual(expect.arrayContaining(['narration[0]', 'chips[0]', 'labels[0]', 'separation']));
  });
});

describe('validatePlan', () => {
  it('accepts the fixture', () => {
    expect(validatePlan(plan(), facts).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('catches broken cross-references', () => {
    const p = plan();
    const s = p.scenes[0];
    if (s.template !== 'skyView') throw new Error('fixture');
    s.params.labels.push({
      body: 'Saturn',
      text: 'Saturn',
      side: 'right',
      from: { sentence: 5, edge: 'start', offset: 0 },
    });
    s.params.meteors = { perSecond: 1, from: 0 };
    s.factIds.push('missing');
    const msgs = validatePlan(p, facts).map((i) => i.message);
    expect(msgs).toEqual(
      expect.arrayContaining([
        'unknown fact "missing"',
        'label references "Saturn" which is not in params.bodies',
        'time reference to sentence 5, but scene has 2 sentences',
        'meteors need params.radiant',
      ]),
    );
  });

  it('rejects narration that cannot fit in a short', () => {
    const p = plan();
    p.scenes[0].narration = [Array.from({ length: 200 }, () => 'word').join(' ')];
    expect(validatePlan(p, facts).some((i) => i.level === 'error' && i.where === 'plan')).toBe(true);
  });

  it('requires Earth in orbit scenes and known assets in image scenes', () => {
    const p = plan();
    p.scenes.splice(1, 0, {
      id: 'orbit',
      template: 'orbit3d',
      narration: ['Look.'],
      factIds: [],
      chips: [],
      captions: true,
      params: { time: '2026-11-16T03:00:00.000Z', bodies: ['Mars', 'Jupiter'], revealAt: 0 },
    });
    p.scenes.splice(1, 0, {
      id: 'img',
      template: 'image',
      narration: ['Look.'],
      factIds: [],
      chips: [],
      captions: true,
      params: { assetId: 'x', zoom: [1, 1.1], focus: [0.5, 0.5], fit: 'cover' },
    });
    const msgs = validatePlan(p, facts).map((i) => i.message);
    expect(msgs).toContain('orbit3d must include Earth (the viewpoint)');
    expect(msgs.some((m) => m.startsWith('unknown asset "x"'))).toBe(true);
  });
});
