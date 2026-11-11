import { describe, expect, it, vi } from 'vitest';
import { buildPostPayload, caption, platformSettings } from '../src/publish/payload';
import { PostizClient, PostizError } from '../src/publish/postiz';
import { plan } from './fixtures';

const media = { id: 'm1', path: 'https://postiz.local/uploads/v.mp4' };

describe('payloads', () => {
  it('builds one Postiz post per target with platform settings', () => {
    const p = buildPostPayload(
      plan(),
      [
        { platform: 'youtube', integrationId: 'yt' },
        { platform: 'tiktok', integrationId: 'tt' },
      ],
      media,
      { mode: 'draft', aiDisclosure: true },
    );
    const posts = p.posts as {
      integration: { id: string };
      settings: Record<string, unknown>;
      value: { image: unknown[] }[];
    }[];
    expect(p.type).toBe('draft');
    expect(posts.map((x) => x.integration.id)).toEqual(['yt', 'tt']);
    expect(posts[0].settings).toMatchObject({ __type: 'youtube', type: 'public', selfDeclaredMadeForKids: 'no' });
    expect(posts[1].settings).toMatchObject({
      __type: 'tiktok',
      video_made_with_ai: true,
      content_posting_method: 'DIRECT_POST',
    });
    expect(posts[0].value[0].image).toEqual([media]);
  });

  it('requires a date for scheduled posts', () => {
    expect(() => buildPostPayload(plan(), [], media, { mode: 'schedule', aiDisclosure: true })).toThrow(/date/);
  });

  it('keeps the title out of the YouTube caption but leads with it elsewhere', () => {
    expect(caption(plan(), 'youtube').startsWith('Just 1.2°')).toBe(true);
    expect(caption(plan(), 'instagram').startsWith('Mars and Jupiter')).toBe(true);
    expect(caption(plan(), 'tiktok')).toContain('#astronomy');
  });

  it('respects the AI disclosure flag and title limits', () => {
    expect(platformSettings(plan(), 'tiktok', { mode: 'now', aiDisclosure: false }).video_made_with_ai).toBe(false);
    const long = plan({ post: { title: 'x'.repeat(90), description: '', hashtags: [] } });
    expect(
      String(platformSettings(long, 'youtube', { mode: 'now', aiDisclosure: true }).title).length,
    ).toBeLessThanOrEqual(100);
  });
});

describe('PostizClient', () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it('sends the API key and parses integrations', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok([{ id: 'i1', name: 'Chan', identifier: 'youtube' }]));
    const c = new PostizClient('https://p.local/api/public/v1', 'KEY', fetchImpl);
    expect(await c.listIntegrations()).toEqual([{ id: 'i1', name: 'Chan', identifier: 'youtube' }]);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://p.local/api/public/v1/integrations');
    expect((init.headers as Record<string, string>).Authorization).toBe('KEY');
  });

  it('posts JSON with a content type', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok([{ postId: 'p1' }]));
    await new PostizClient('https://p', 'K', fetchImpl).createPost({ a: 1 });
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('surfaces HTTP errors with status and body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('nope', { status: 401 }));
    const err = await new PostizClient('https://p', 'K', fetchImpl).listIntegrations().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PostizError);
    expect((err as PostizError).status).toBe(401);
    expect((err as PostizError).body).toBe('nope');
  });
});
