import type { PublishRecord } from '../core/schemas';

type Target = PublishRecord['attempts'][number]['targets'][number];

/**
 * The posts currently live in the provider, per platform: the latest submitted post id, with the
 * time it is scheduled for, minus any that a later `unschedule` attempt deleted.
 */
export function livePosts(record: PublishRecord): Map<string, { target: Target; scheduledFor?: string }> {
  const live = new Map<string, { target: Target; scheduledFor?: string }>();
  for (const a of record.attempts.filter((x) => !x.dryRun)) {
    for (const t of a.targets) {
      if (t.status === 'submitted' && t.postId) live.set(t.platform, { target: t, scheduledFor: a.scheduledFor });
      else if (t.status === 'deleted') live.delete(t.platform);
    }
  }
  return live;
}
