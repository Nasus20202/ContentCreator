/**
 * Builds Buffer `createPost` inputs per platform from the plan.
 * Field names follow Buffer's GraphQL schema (CreatePostInput, PostInputMetaData).
 */
import type { Plan, Platform } from '../core/schemas';

export interface PostOptions {
  mode: 'now' | 'schedule' | 'draft';
  /** Required for mode=schedule (ISO 8601). */
  date?: string;
  aiDisclosure: boolean;
}

/** YouTube category "Science & Technology". */
export const YOUTUBE_CATEGORY_SCIENCE = '28';

export function caption(plan: Plan, platform: Platform): string {
  const tags = plan.post.hashtags.join(' ');
  // YouTube shows the title separately; the others lead with it
  const head = platform === 'youtube' ? '' : `${plan.post.title}\n\n`;
  return `${head}${plan.post.description}\n\n${tags}`.trim();
}

export function platformMetadata(plan: Plan, platform: Platform, opts: PostOptions): Record<string, unknown> {
  switch (platform) {
    case 'youtube':
      return {
        youtube: {
          title: plan.post.title.slice(0, 100),
          privacy: 'public',
          madeForKids: false,
          notifySubscribers: true,
          categoryId: YOUTUBE_CATEGORY_SCIENCE,
          isAiGenerated: opts.aiDisclosure,
        },
      };
    case 'tiktok':
      return { tiktok: { isAiGenerated: opts.aiDisclosure } };
    case 'instagram':
      return { instagram: { type: 'reel', shouldShareToFeed: true, isAiGenerated: opts.aiDisclosure } };
    case 'facebook':
      return { facebook: { type: 'reel' } };
  }
}

function modeFields(opts: PostOptions): Record<string, unknown> {
  switch (opts.mode) {
    case 'now':
      return { mode: 'shareNow' };
    case 'schedule':
      if (!opts.date) throw new Error('mode=schedule requires a date');
      return { mode: 'customScheduled', dueAt: new Date(opts.date).toISOString() };
    case 'draft':
      return { mode: 'addToQueue', saveToDraft: true };
  }
}

export function buildCreatePostInput(
  plan: Plan,
  target: { platform: Platform; channelId: string },
  media: { url: string },
  opts: PostOptions,
): Record<string, unknown> {
  return {
    channelId: target.channelId,
    text: caption(plan, target.platform),
    schedulingType: 'automatic',
    ...modeFields(opts),
    // the script and post copy are written by Claude
    aiAssisted: true,
    assets: [{ video: { url: media.url, metadata: { thumbnailOffset: 1000 } } }],
    metadata: platformMetadata(plan, target.platform, opts),
  };
}

/**
 * Repoint an existing Buffer post at a different hosted video. `editPost` replaces the whole post,
 * so the caller must resend the original payload with only the media URL changed.
 */
export function replaceVideoUrl(payload: Record<string, unknown>, url: string): Record<string, unknown> {
  const assets = Array.isArray(payload.assets) ? (payload.assets as unknown[]) : [];
  return {
    ...payload,
    assets: assets.map((a) => {
      const item = (a ?? {}) as Record<string, unknown>;
      const video = item.video as Record<string, unknown> | undefined;
      return video ? { ...item, video: { ...video, url } } : item;
    }),
  };
}
