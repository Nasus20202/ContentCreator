/**
 * Integrity check over all committed records (run in CI):
 * every file parses against its schema, stage claims are consistent with the records,
 * and generated reports match what the records would produce.
 */
import fs from 'node:fs';
import { Episode, stageIndex } from '../core/episode';
import { readJson, readJsonl } from '../core/io';
import { paths } from '../core/paths';
import {
  AssetsFile,
  FactsFile,
  MetricSnapshot,
  Plan,
  PublishRecord,
  QaRecord,
  RenderRecord,
  ResearchFile,
  Timeline,
  type Stage,
} from '../core/schemas';
import { planHash } from '../pipeline/stages';
import { channelDecisions } from '../core/channel-log';
import { episodeReport } from './report';

export function validateRecords(): string[] {
  const problems: string[] = [];
  try {
    channelDecisions();
  } catch (e) {
    problems.push(`docs/decisions/decisions.jsonl: ${String(e)}`);
  }

  for (const id of Episode.list(paths.episodes)) {
    const at = (f: string) => `${id}/${f}`;
    let ep: Episode;
    try {
      ep = Episode.load(id);
      ep.logs();
      ep.decisions();
    } catch (e) {
      problems.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const p = ep.paths;
    const files: [string, () => unknown][] = [
      [p.research, () => readJson(p.research, ResearchFile)],
      [p.facts, () => readJson(p.facts, FactsFile)],
      [p.plan, () => readJson(p.plan, Plan)],
      [p.timeline, () => readJson(p.timeline, Timeline)],
      [p.assets, () => readJson(p.assets, AssetsFile)],
      [p.render, () => readJson(p.render, RenderRecord)],
      [p.qa, () => readJson(p.qa, QaRecord)],
      [p.publish, () => readJson(p.publish, PublishRecord)],
      [p.metrics, () => readJsonl(p.metrics, MetricSnapshot)],
    ];
    for (const [file, parse] of files) {
      if (!fs.existsSync(file)) continue;
      try {
        parse();
      } catch (e) {
        problems.push(e instanceof Error ? e.message : String(e));
      }
    }

    const reached = (s: Stage) => stageIndex(ep.stage) >= stageIndex(s);
    const require = (s: Stage, file: string, name: string) => {
      if (reached(s) && !fs.existsSync(file)) problems.push(`${at(name)} missing but stage is "${ep.stage}"`);
    };
    require('researched', p.facts, 'facts.json');
    require('planned', p.plan, 'plan.json');
    require('factchecked', p.factcheck, 'factcheck.json');
    require('voiced', p.timeline, 'timeline.json');
    require('rendered', p.render, 'render.json');
    require('qa-passed', p.qa, 'qa.json');

    if (reached('planned') && fs.existsSync(p.plan)) {
      const h = planHash(readJson(p.plan, Plan));
      if (ep.manifest.hashes.plan !== h) problems.push(`${at('plan.json')} was edited after validation (run cc plan)`);
    }
    if (reached('rendered') && fs.existsSync(p.render) && fs.existsSync(p.plan)) {
      if (readJson(p.render, RenderRecord).planHash !== planHash(readJson(p.plan, Plan))) {
        problems.push(`${at('render.json')} was rendered from a different plan`);
      }
    }
    if (reached('approved') && !ep.manifest.approvals.length)
      problems.push(`${at('episode.json')} approved without an approval record`);

    if (!fs.existsSync(p.readme) || fs.readFileSync(p.readme, 'utf8') !== episodeReport(ep)) {
      problems.push(`${at('README.md')} is out of date (run: pnpm cc report)`);
    }
  }
  return problems;
}
