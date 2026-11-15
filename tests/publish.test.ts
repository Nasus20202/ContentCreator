import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { BufferClient, BufferError } from '../src/publish/buffer';
import { GitBranchHost, mediaName } from '../src/publish/media-host';
import {
  buildCreatePostInput,
  caption,
  platformMetadata,
  replaceVideoUrl,
  stripUrls,
  YOUTUBE_CATEGORY_SCIENCE,
} from '../src/publish/payload';
import { plan } from './fixtures';

const media = { url: 'https://github.com/o/media/releases/download/ep-1234abcd/video.mp4' };

describe('Buffer createPost inputs', () => {
  it('builds a scheduled YouTube Short with title, category and AI flag', () => {
    const input = buildCreatePostInput(plan(), { platform: 'youtube', channelId: 'yt' }, media, {
      mode: 'schedule',
      date: '2026-11-14T17:00:00Z',
      aiDisclosure: true,
    });
    expect(input).toMatchObject({
      channelId: 'yt',
      schedulingType: 'automatic',
      mode: 'customScheduled',
      dueAt: '2026-11-14T17:00:00.000Z',
      assets: [{ video: { url: media.url } }],
      metadata: {
        youtube: {
          title: 'Mars and Jupiter on Nov 16',
          privacy: 'public',
          madeForKids: false,
          categoryId: YOUTUBE_CATEGORY_SCIENCE,
          isAiGenerated: true,
        },
      },
    });
  });

  it('maps modes to Buffer share modes', () => {
    const t = { platform: 'tiktok' as const, channelId: 'tt' };
    expect(buildCreatePostInput(plan(), t, media, { mode: 'now', aiDisclosure: true }).mode).toBe('shareNow');
    expect(buildCreatePostInput(plan(), t, media, { mode: 'draft', aiDisclosure: true })).toMatchObject({
      mode: 'addToQueue',
      saveToDraft: true,
    });
    expect(() => buildCreatePostInput(plan(), t, media, { mode: 'schedule', aiDisclosure: true })).toThrow(/date/);
  });

  it('keeps the title out of the YouTube caption but leads with it elsewhere', () => {
    expect(caption(plan(), 'youtube').startsWith('Just 1.2°')).toBe(true);
    expect(caption(plan(), 'tiktok').startsWith('Mars and Jupiter')).toBe(true);
    expect(caption(plan(), 'tiktok')).toContain('#astronomy');
  });

  it('drops URLs from Instagram captions but keeps the source names', () => {
    const p = plan();
    p.post.description =
      'Body.\n\nSources:\nNASA, Sun facts: https://science.nasa.gov/sun/facts/\nhttps://x.org/a\n\nImage: NASA.';
    expect(stripUrls(p.post.description)).toBe('Body.\n\nSources:\nNASA, Sun facts\n\nImage: NASA.');
    expect(caption(p, 'instagram')).not.toMatch(/https?:/);
    expect(caption(p, 'instagram')).toContain('NASA, Sun facts');
    expect(caption(p, 'tiktok')).toContain('https://science.nasa.gov/sun/facts/');
  });

  it('respects the AI disclosure flag and title limits', () => {
    expect(platformMetadata(plan(), 'tiktok', { mode: 'now', aiDisclosure: false })).toEqual({
      tiktok: { isAiGenerated: false },
    });
    const long = plan({ post: { title: 'x'.repeat(140), description: '', hashtags: [] } });
    const yt = platformMetadata(long, 'youtube', { mode: 'now', aiDisclosure: true }).youtube as { title: string };
    expect(yt.title.length).toBeLessThanOrEqual(100);
  });
});

describe('BufferClient', () => {
  const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });

  it('sends the bearer key and returns the created post id', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(ok({ createPost: { post: { id: 'P9', dueAt: null } } })));
    const post = await new BufferClient('KEY', fetchImpl).createPost({ channelId: 'c' });
    expect(post.id).toBe('P9');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.buffer.com');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer KEY');
    expect((JSON.parse(init.body as string) as { variables: unknown }).variables).toEqual({
      input: { channelId: 'c' },
    });
  });

  it('turns MutationError, GraphQL errors and HTTP errors into BufferError', async () => {
    const mutationErr = new BufferClient('K', () => Promise.resolve(ok({ createPost: { message: 'Queue full' } })));
    await expect(mutationErr.createPost({})).rejects.toThrow(new BufferError('Queue full'));

    const gqlErr = new BufferClient('K', () =>
      Promise.resolve(new Response(JSON.stringify({ errors: [{ message: 'bad field' }] }), { status: 200 })),
    );
    await expect(gqlErr.organizations()).rejects.toThrow(/bad field/);

    const httpErr = new BufferClient('K', () => Promise.resolve(new Response('nope', { status: 401 })));
    const err = await httpErr.organizations().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BufferError);
    expect((err as BufferError).status).toBe(401);
  });

  it('lists channels of an organization', async () => {
    const c = new BufferClient('K', () =>
      Promise.resolve(ok({ channels: [{ id: 'c1', name: 'thephotonsphere', service: 'tiktok' }] })),
    );
    expect(await c.channels('org')).toEqual([{ id: 'c1', name: 'thephotonsphere', service: 'tiktok' }]);
  });
});

describe('GitBranchHost', () => {
  const video = path.join(os.tmpdir(), 'cc-media-test.mp4');
  fs.writeFileSync(video, 'x');
  const gitDir = path.join(os.tmpdir(), 'cc-media-test.git');

  it('commits the file into nested folders of the assets repo with plumbing and returns the raw URL', async () => {
    const calls: string[][] = [];
    let trees = 0;
    const exec = (_cmd: string, args: string[]) => {
      calls.push(args);
      const sub = args[0] === 'init' ? 'init' : args[1];
      if (sub === 'rev-parse') return Promise.reject(new Error('no branch yet'));
      const out: Record<string, string> = { 'hash-object': 'BLOB', 'commit-tree': 'COMMIT' };
      if (sub === 'mktree') return Promise.resolve({ stdout: `TREE${++trees}` });
      return Promise.resolve({ stdout: out[sub] ?? '' });
    };
    const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-media-')) + '/cache.git'; // not created yet
    const host = new GitBranchHost('o/assets', 'main', 'git@github.com:o/assets.git', exec, fresh);
    const res = await host.host(video, 'sky-school/moon-drift-1234abcd.mp4');
    expect(res.url).toBe('https://raw.githubusercontent.com/o/assets/main/sky-school/moon-drift-1234abcd.mp4');
    expect(calls[0]).toEqual(['init', '--bare', '--quiet', fresh]);
    // blobless partial clone: the cache never downloads existing videos
    expect(calls.filter((c) => c[1] === 'config').map((c) => c.slice(2))).toEqual([
      ['remote.assets.url', 'git@github.com:o/assets.git'],
      ['remote.assets.promisor', 'true'],
      ['remote.assets.partialclonefilter', 'blob:none'],
    ]);
    expect(calls.find((c) => c[1] === 'fetch')).toContain('--filter=blob:none');
    const git = calls.filter((c) => c[0] === `--git-dir=${fresh}` && c[1] !== 'config').map((c) => c[1]);
    expect(git).toEqual(['fetch', 'rev-parse', 'hash-object', 'mktree', 'mktree', 'commit-tree', 'push', 'update-ref']);
    expect(calls.find((c) => c[1] === 'commit-tree')).not.toContain('-p'); // first upload: root commit
    expect(calls.find((c) => c[1] === 'push')).toEqual([
      `--git-dir=${fresh}`,
      'push',
      '--quiet',
      'assets',
      'COMMIT:refs/heads/main',
    ]);
  });

  it('reuses a file that is already in the repo', async () => {
    fs.mkdirSync(gitDir, { recursive: true });
    const exec = vi.fn((_cmd: string, args: string[]) =>
      Promise.resolve({
        stdout: args[1] === 'rev-parse' ? 'PARENT' : args[1] === 'ls-tree' ? '100644 blob B\tsky-school/ep-1.mp4' : '',
      }),
    );
    await new GitBranchHost('o/assets', 'main', 'r', exec, gitDir).host(video, 'sky-school/ep-1.mp4');
    expect(exec.mock.calls.map((c) => c[1][1])).toEqual(['fetch', 'rev-parse', 'ls-tree']);
  });

  it('names media by the episode folder and video hash', () => {
    expect(mediaName('sky-school-moon-drift', 'abcdef0123456789')).toBe('sky-school/moon-drift-abcdef01.mp4');
    expect(mediaName('unknown-ep', 'abcdef0123456789')).toBe('unknown-ep-abcdef01.mp4');
  });
});

describe('replaceVideoUrl', () => {
  it('repoints the video asset and leaves the rest of the payload alone', () => {
    const payload = buildCreatePostInput(plan(), { platform: 'youtube', channelId: 'yt' }, media, {
      mode: 'schedule',
      date: '2026-11-14T17:00:00Z',
      aiDisclosure: true,
    });
    const next = replaceVideoUrl(payload, 'https://example.test/new.mp4');
    expect(next.assets).toEqual([
      { video: { url: 'https://example.test/new.mp4', metadata: { thumbnailOffset: 1000 } } },
    ]);
    expect(next.text).toBe(payload.text);
    expect(next.metadata).toEqual(payload.metadata);
  });

  it('keeps assets without a video untouched', () => {
    expect(replaceVideoUrl({ assets: [{ image: { url: 'a.jpg' } }] }, 'x.mp4').assets).toEqual([
      { image: { url: 'a.jpg' } },
    ]);
  });
});
