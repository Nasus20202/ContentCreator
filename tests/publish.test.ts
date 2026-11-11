import { describe, expect, it, vi } from 'vitest';
import { BufferClient, BufferError } from '../src/publish/buffer';
import { GitHubReleaseHost, releaseTag } from '../src/publish/media-host';
import { buildCreatePostInput, caption, platformMetadata, YOUTUBE_CATEGORY_SCIENCE } from '../src/publish/payload';
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

describe('GitHubReleaseHost', () => {
  it('creates a release when missing and returns the public download URL', async () => {
    const calls: string[][] = [];
    const exec = (cmd: string, args: string[]) => {
      calls.push([cmd, ...args]);
      return args[1] === 'view' ? Promise.reject(new Error('release not found')) : Promise.resolve({ stdout: '' });
    };
    const res = await new GitHubReleaseHost('o/media', exec).host('/x/build/video.mp4', 'ep-1234abcd');
    expect(res.url).toBe('https://github.com/o/media/releases/download/ep-1234abcd/video.mp4');
    expect(calls[1].slice(0, 4)).toEqual(['gh', 'release', 'create', 'ep-1234abcd']);
  });

  it('reuses an existing asset without uploading again', async () => {
    const exec = vi.fn(() => Promise.resolve({ stdout: JSON.stringify({ assets: [{ name: 'video.mp4' }] }) }));
    await new GitHubReleaseHost('o/media', exec).host('/x/video.mp4', 't');
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('tags releases by episode and video hash', () => {
    expect(releaseTag('ep', 'abcdef0123456789')).toBe('ep-abcdef01');
  });
});
