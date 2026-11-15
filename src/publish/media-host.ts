/**
 * Buffer's API only accepts media by public URL, so approved videos are committed to a separate
 * public assets repository (`publishing.mediaHost.repo`, e.g. `Nasus20202/ContentCreator-assets`)
 * and served from raw.githubusercontent.com. Files are written with git plumbing into a local bare,
 * blobless cache (`.cache/media.git`, safe to delete), so neither this repository's history nor its
 * object store ever holds a video, and the working tree, index and current branch are never touched.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { PipelineError } from '../core/io';
import { episodeDir, paths, REPO_ROOT } from '../core/paths';

const run = promisify(execFile);

export interface MediaHost {
  /** Publishes the file under `name` (or reuses it) and returns its public URL. */
  host(file: string, name: string): Promise<{ url: string }>;
}

export type Exec = (cmd: string, args: string[], input?: string) => Promise<{ stdout: string }>;

const defaultExec: Exec = async (cmd, args, input) => {
  if (input === undefined) return run(cmd, args, { cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 });
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { cwd: REPO_ROOT }, (err, stdout) =>
      err ? reject(new Error(err.message)) : resolve({ stdout }),
    );
    child.stdin?.end(input);
  });
};

/**
 * Path in the assets repo: the episode's folder (`<series>/<slug>`) + video hash prefix, so a
 * re-render never overwrites and files group by series like `episodes/`.
 */
export const mediaName = (episodeId: string, sha256: string): string => {
  const rel = path.relative(paths.episodes, episodeDir(episodeId)).split(path.sep).join('/');
  return `${rel}-${sha256.slice(0, 8)}.mp4`;
};

export const mediaCacheDir = (): string => path.join(REPO_ROOT, '.cache', 'media.git');

export class GitBranchHost implements MediaHost {
  constructor(
    readonly repo: string,
    readonly branch = 'main',
    /** Push target; defaults to the assets repo over SSH. */
    readonly remote = `git@github.com:${repo}.git`,
    private readonly exec: Exec = defaultExec,
    readonly gitDir = mediaCacheDir(),
  ) {}

  url(name: string): string {
    return `https://raw.githubusercontent.com/${this.repo}/${this.branch}/${name}`;
  }

  async host(file: string, name: string): Promise<{ url: string }> {
    if (!fs.existsSync(file)) throw new PipelineError(`Video not found: ${file}`);
    const git = (args: string[], input?: string) =>
      this.exec('git', [`--git-dir=${this.gitDir}`, ...args], input).then((r) => r.stdout.trim());
    const ref = `refs/heads/${this.branch}`;
    try {
      if (!fs.existsSync(this.gitDir)) {
        // A blobless partial clone: commits and trees only, so the cache stays a few KB however many
        // videos the assets repo holds; pushing a new commit sends just the new file.
        await this.exec('git', ['init', '--bare', '--quiet', this.gitDir]);
        await git(['config', 'remote.assets.url', this.remote]);
        await git(['config', 'remote.assets.promisor', 'true']);
        await git(['config', 'remote.assets.partialclonefilter', 'blob:none']);
      }
      // the remote branch may not exist yet (first upload)
      await git(['fetch', '--quiet', '--filter=blob:none', 'assets', `+${ref}:${ref}`]).catch(() => '');
      const parent = await git(['rev-parse', '--verify', '--quiet', ref]).catch(() => '');
      if (parent && (await git(['ls-tree', parent, '--', name]))) return { url: this.url(name) };

      const blob = await git(['hash-object', '-w', file]);
      const tree = await this.putPath(git, parent ? `${parent}^{tree}` : '', name.split('/'), blob);
      const commit = await git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `media: ${name}`]);
      await git(['push', '--quiet', 'assets', `${commit}:${ref}`]);
      await git(['update-ref', ref, commit]);
    } catch (e) {
      throw new PipelineError(
        `Could not publish ${name} to ${this.repo}: ${e instanceof Error ? e.message : String(e)}`,
        `Check push access to ${this.remote}`,
      );
    }
    return { url: this.url(name) };
  }

  /** Write `blob` at `parts` inside `tree` (empty = no tree yet), creating sub-trees; returns the new tree. */
  private async putPath(
    git: (args: string[], input?: string) => Promise<string>,
    tree: string,
    parts: string[],
    blob: string,
  ): Promise<string> {
    const [head, ...rest] = parts;
    const entries = tree ? (await git(['ls-tree', tree])).split('\n').filter(Boolean) : [];
    const others = entries.filter((e) => e.split('\t')[1] !== head);
    let entry: string;
    if (rest.length === 0) entry = `100644 blob ${blob}\t${head}`;
    else {
      const sub = entries.find((e) => e.split('\t')[1] === head && e.includes(' tree '));
      const subTree = sub ? sub.split(' ')[2].split('\t')[0] : '';
      entry = `040000 tree ${await this.putPath(git, subTree, rest, blob)}\t${head}`;
    }
    // --missing: in a blobless clone the other videos in this folder are not local, and need not be
    return git(['mktree', '--missing'], [...others, entry].join('\n') + '\n');
  }
}
