import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute repository root, derived from this file's location. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const paths = {
  root: REPO_ROOT,
  /** Overridable so tests can work in a temp dir. */
  get episodes(): string {
    return process.env.CC_EPISODES_DIR ?? path.join(REPO_ROOT, 'episodes');
  },
  get docs(): string {
    return process.env.CC_DOCS_DIR ?? path.join(REPO_ROOT, 'docs');
  },
  series: path.join(REPO_ROOT, 'series'),
  catalog: path.join(REPO_ROOT, 'assets', 'catalog'),
  channelConfig: path.join(REPO_ROOT, 'channel.config.json'),
  videoEntry: path.join(REPO_ROOT, 'video', 'index.tsx'),
};

/** Files inside one episode directory. Committed files are the audit trail; `build/` is gitignored. */
export function episodePaths(episodeId: string) {
  const dir = path.join(paths.episodes, episodeId);
  const build = path.join(dir, 'build');
  return {
    dir,
    manifest: path.join(dir, 'episode.json'),
    research: path.join(dir, 'research.json'),
    facts: path.join(dir, 'facts.json'),
    plan: path.join(dir, 'plan.json'),
    factcheck: path.join(dir, 'factcheck.json'),
    timeline: path.join(dir, 'timeline.json'),
    assets: path.join(dir, 'assets.json'),
    render: path.join(dir, 'render.json'),
    qa: path.join(dir, 'qa.json'),
    publish: path.join(dir, 'publish.json'),
    metrics: path.join(dir, 'metrics.jsonl'),
    log: path.join(dir, 'log.jsonl'),
    decisions: path.join(dir, 'decisions.jsonl'),
    readme: path.join(dir, 'README.md'),
    build,
    voiceDir: path.join(build, 'voice'),
    assetDir: path.join(build, 'assets'),
    renderProps: path.join(build, 'render-props.json'),
    video: path.join(build, 'video.mp4'),
    qaDir: path.join(build, 'qa'),
  };
}

export type EpisodePaths = ReturnType<typeof episodePaths>;
