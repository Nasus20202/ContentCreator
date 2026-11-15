import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Episode } from '../src/core/episode';
import { readJson, writeJson } from '../src/core/io';
import { episodeDir, paths } from '../src/core/paths';
import { Manifest, Plan } from '../src/core/schemas';
import * as stages from '../src/pipeline/stages';
import { plan, tempWorkspace } from './fixtures';

describe('episode layout and naming', () => {
  let ws: ReturnType<typeof tempWorkspace>;
  beforeEach(() => (ws = tempWorkspace()));
  afterEach(() => ws.cleanup());

  it('groups episodes by series folder and lists them by id', () => {
    expect(episodeDir('sky-school-moon-drift')).toBe(path.join(paths.episodes, 'sky-school', 'moon-drift'));
    expect(episodeDir('sky-this-week-2026-11-16-eu-central')).toBe(
      path.join(paths.episodes, 'sky-this-week', '2026-11-16-eu-central'),
    );
    expect(episodeDir('no-such-series-x')).toBe(path.join(paths.episodes, 'no-such-series-x'));
    stages.createEpisode({ series: 'sky-school', id: 'sky-school-moon-drift', actor: 'claude' });
    expect(fs.existsSync(path.join(paths.episodes, 'sky-school', 'moon-drift', 'episode.json'))).toBe(true);
    expect(Episode.list(paths.episodes)).toEqual(['sky-school-moon-drift']);
  });

  it('builds ids with dates only for date-bound content', () => {
    expect(stages.episodeId({ series: 'sky-school', slug: 'moon-drift' })).toBe('sky-school-moon-drift');
    expect(stages.episodeId({ series: 'mission-control', slug: 'starship-catch', date: '2026-11-14' })).toBe(
      'mission-control-2026-11-14-starship-catch',
    );
    expect(stages.episodeId({ series: 'sky-this-week', week: '2026-11-16', location: 'eu-central' })).toBe(
      'sky-this-week-2026-11-16-eu-central',
    );
    expect(() => stages.episodeId({ series: 'sky-school' })).toThrow(/--slug/);
  });

  it('renames an episode, moves it, re-signs the plan hash and logs the move', () => {
    const ep = stages.createEpisode({ series: 'sky-school', id: 'sky-school-2026-11-19-moon-drift', actor: 'claude' });
    writeJson(ep.paths.plan, plan({ episodeId: ep.id, series: 'sky-school' }));
    const before = stages.planHash(readJson(ep.paths.plan, Plan));
    writeJson(ep.paths.manifest, { ...readJson(ep.paths.manifest, Manifest), hashes: { plan: before } });
    writeJson(ep.paths.factcheck, { planHash: before, automated: {}, review: null });

    const moved = stages.renameEpisode(ep.id, 'sky-school-moon-drift', 'claude');
    expect(fs.existsSync(ep.paths.dir)).toBe(false);
    expect(moved.paths.dir).toBe(path.join(paths.episodes, 'sky-school', 'moon-drift'));
    const after = stages.planHash(readJson(moved.paths.plan, Plan));
    expect(after).not.toBe(before);
    expect(moved.manifest.id).toBe('sky-school-moon-drift');
    expect(moved.manifest.hashes.plan).toBe(after);
    expect((JSON.parse(fs.readFileSync(moved.paths.factcheck, 'utf8')) as { planHash: string }).planHash).toBe(after);
    expect(moved.logs().at(-1)).toMatchObject({ action: 'episode.rename', details: { from: ep.id, to: moved.id } });
    expect(() => stages.renameEpisode('sky-school-moon-drift', 'one-shot-x', 'claude')).toThrow(/series/);
    expect(() => stages.renameEpisode('sky-school-moon-drift', 'sky-school-moon-drift', 'claude')).toThrow(/in place/);
  });

  it('moves a legacy flat episode folder into its series folder, keeping the id', () => {
    const flat = path.join(paths.episodes, 'one-shot-earth-smiled');
    fs.mkdirSync(flat, { recursive: true });
    writeJson(
      path.join(flat, 'episode.json'),
      Manifest.parse({
        id: 'one-shot-earth-smiled',
        series: 'one-shot',
        stage: 'created',
        createdAt: new Date().toISOString(),
      }),
    );
    expect(episodeDir('one-shot-earth-smiled')).toBe(flat);
    expect(Episode.list(paths.episodes)).toEqual(['one-shot-earth-smiled']);
    const moved = stages.renameEpisode('one-shot-earth-smiled', 'one-shot-earth-smiled', 'claude');
    expect(moved.paths.dir).toBe(path.join(paths.episodes, 'one-shot', 'earth-smiled'));
    expect(fs.existsSync(flat)).toBe(false);
  });
});
