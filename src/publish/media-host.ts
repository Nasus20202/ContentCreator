/**
 * Buffer's API only accepts media by public URL, so approved videos are committed to an orphan branch
 * (default `videos`) of this public repository and served from raw.githubusercontent.com.
 * The branch shares no history with main; files are written with git plumbing, so the working tree,
 * index and current branch are never touched.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { PipelineError } from '../core/io';
import { REPO_ROOT } from '../core/paths';

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

/** File name on the media branch: episode id + video hash prefix, so a re-render never overwrites. */
export const mediaName = (episodeId: string, sha256: string) => `${episodeId}-${sha256.slice(0, 8)}.mp4`;

export class GitBranchHost implements MediaHost {
  constructor(
    readonly repo: string,
    readonly branch = 'videos',
    readonly remote = 'origin',
    private readonly exec: Exec = defaultExec,
  ) {}

  url(name: string): string {
    return `https://raw.githubusercontent.com/${this.repo}/${this.branch}/${name}`;
  }

  async host(file: string, name: string): Promise<{ url: string }> {
    if (!fs.existsSync(file)) throw new PipelineError(`Video not found: ${file}`);
    const git = (args: string[], input?: string) => this.exec('git', args, input).then((r) => r.stdout.trim());
    const ref = `refs/remotes/${this.remote}/${this.branch}`;
    try {
      // the remote branch may not exist yet (first upload)
      await git(['fetch', this.remote, `+refs/heads/${this.branch}:${ref}`]).catch(() => '');
      const parent = await git(['rev-parse', '--verify', '--quiet', ref]).catch(() => '');
      const entries = parent ? (await git(['ls-tree', parent])).split('\n').filter(Boolean) : [];
      if (entries.some((e) => e.endsWith(`\t${name}`))) return { url: this.url(name) };

      const blob = await git(['hash-object', '-w', file]);
      const tree = await git(['mktree'], [...entries, `100644 blob ${blob}\t${name}`].join('\n') + '\n');
      const commit = await git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `media: ${name}`]);
      await git(['push', this.remote, `${commit}:refs/heads/${this.branch}`]);
      await git(['update-ref', ref, commit]);
    } catch (e) {
      throw new PipelineError(
        `Could not publish ${name} to the ${this.branch} branch: ${e instanceof Error ? e.message : String(e)}`,
        `Check push access to ${this.remote} (${this.repo})`,
      );
    }
    return { url: this.url(name) };
  }
}
