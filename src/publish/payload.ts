/**
 * Builds Postiz `POST /posts` payloads per platform from the plan.
 * Platform-specific settings follow the Postiz provider docs (public-api/providers/*).
 */
import type { Plan, Platform } from '../core/schemas';
import type { PostizMedia } from './postiz';

export interface PostOptions {
  mode: 'now' | 'schedule' | 'draft';
  /** Required for mode=schedule. */
  date?: string;
  aiDisclosure: boolean;
}

export function caption(plan: Plan, platform: Platform): string {
  const tags = plan.post.hashtags.join(' ');
  // YouTube shows title separately; the others lead with it
  const head = platform === 'youtube' ? '' : `${plan.post.title}\n\n`;
  return `${head}${plan.post.description}\n\n${tags}`.trim();
}

export function platformSettings(plan: Plan, platform: Platform, opts: PostOptions): Record<string, unknown> {
  switch (platform) {
    case 'youtube':
      return {
        __type: 'youtube',
        title: plan.post.title.slice(0, 100),
        type: 'public',
        selfDeclaredMadeForKids: 'no',
        tags: plan.post.hashtags.map((h) => ({ value: h.slice(1), label: h.slice(1) })),
      };
    case 'tiktok':
      return {
        __type: 'tiktok',
        title: plan.post.title.slice(0, 90),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        duet: false,
        stitch: true,
        comment: true,
        autoAddMusic: 'no',
        brand_content_toggle: false,
        brand_organic_toggle: false,
        video_made_with_ai: opts.aiDisclosure,
        content_posting_method: 'DIRECT_POST',
      };
    case 'instagram':
      return { __type: 'instagram', post_type: 'post' };
    case 'facebook':
      return { __type: 'facebook' };
  }
}

export function buildPostPayload(
  plan: Plan,
  targets: { platform: Platform; integrationId: string }[],
  media: PostizMedia,
  opts: PostOptions,
): Record<string, unknown> {
  if (opts.mode === 'schedule' && !opts.date) throw new Error('mode=schedule requires a date');
  return {
    type: opts.mode,
    date: opts.date ?? new Date().toISOString(),
    shortLink: false,
    tags: [],
    posts: targets.map((t) => ({
      integration: { id: t.integrationId },
      value: [{ content: caption(plan, t.platform), image: [{ id: media.id, path: media.path }] }],
      settings: platformSettings(plan, t.platform, opts),
    })),
  };
}
