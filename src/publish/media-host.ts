/**
 * Buffer's API only accepts media by public URL, so approved videos are hosted as
 * GitHub release assets in a public media repository (channel.config.json → publishing.mediaHost).
 * The video is public from upload time; that is fine because it is already approved for publishing.
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { PipelineError } from '../core/io';

const run = promisify(execFile);

export interface MediaHost {
  /** Uploads (or reuses) the file and returns its public URL. */
  host(file: string, tag: string): Promise<{ url: string }>;
}

export type Exec = (cmd: string, args: string[]) => Promise<{ stdout: string }>;

export const releaseTag = (episodeId: string, sha256: string) => `${episodeId}-${sha256.slice(0, 8)}`;

export class GitHubReleaseHost implements MediaHost {
  constructor(
    readonly repo: string,
    private readonly exec: Exec = (cmd, args) => run(cmd, args),
  ) {}

  async host(file: string, tag: string): Promise<{ url: string }> {
    const name = path.basename(file);
    const url = `https://github.com/${this.repo}/releases/download/${tag}/${name}`;
    const exists = await this.exec('gh', ['release', 'view', tag, '--repo', this.repo, '--json', 'assets']).then(
      (r) => (JSON.parse(r.stdout) as { assets: { name: string }[] }).assets.some((a) => a.name === name),
      () => undefined,
    );
    if (exists) return { url };
    try {
      if (exists === undefined) {
        await this.exec('gh', ['release', 'create', tag, file, '--repo', this.repo, '--title', tag, '--notes', '']);
      } else {
        await this.exec('gh', ['release', 'upload', tag, file, '--repo', this.repo]);
      }
    } catch (e) {
      throw new PipelineError(
        `Could not upload ${name} to github.com/${this.repo}: ${e instanceof Error ? e.message : String(e)}`,
        'Check `gh auth status` and that the media repo exists and is public',
      );
    }
    return { url };
  }
}
