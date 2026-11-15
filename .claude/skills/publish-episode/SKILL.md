---
name: publish-episode
description: Hand an episode to the human for approval and publish it to YouTube and TikTok through Buffer. Use only when the user asks to publish/schedule, or to set up publishing.
---

# Publish an episode

## Preconditions (enforced by the CLI)

- Stage `approved`: a **human** ran `pnpm cc approve <id> --by "<name>"` on the exact video (sha256-pinned). If not, show them the video path and ask; never run approve yourself.
- `.env` has `BUFFER_API_KEY` (the human creates it; never ask them to paste it into chat). `channel.config.json → publishing.targets` lists Buffer channel ids (get them with `pnpm -s cc publish channels`). `gh` is logged in with push access to `publishing.mediaHost.repo`. Setup details: `docs/publishing.md`.

## Steps

1. Always dry-run first and show the user the payload summary:
   `pnpm -s cc publish <id> --dry-run --mode <draft|schedule|now> [--at <ISO>]`
   (payloads are recorded in `publish.json`).
2. Only after the user explicitly confirms platforms, mode and time:
   `pnpm -s cc publish <id> --mode schedule --at 2026-11-14T17:00:00Z --actor claude`
   - This commits the video to the public `videos` branch, then creates one Buffer post per platform.
   - `draft` saves Buffer drafts for a final manual click in Buffer.
   - Partial failures are recorded per platform; retry with `--platforms <failed ones>`.
   - To move scheduled posts: `pnpm -s cc publish reschedule <id> --at <ISO> --actor claude` (recorded as a `reschedule` attempt).
   - To take still-scheduled posts out of the queue (free slots): `pnpm -s cc publish unschedule <id> --actor claude` (deletes them in Buffer, recorded as an `unschedule` attempt; the episode stays approved and can be scheduled again).
   - Queue policy: keep the **next 10 days** filled (one post per day per channel, 10-post limit); don't park far-future posts in Buffer.
3. Check the posts in the Buffer queue (<https://publish.buffer.com>), `pnpm -s cc report <id>`, and tell the user what was submitted (and what failed, verbatim).
4. Commit the updated records.

## Later: metrics

After 48 h and 7 days, ask the user for (or read) platform analytics and record them:
`pnpm -s cc metrics add <id> --platform youtube --views 1234 --likes 56 --avg-view-pct 71 --url … --source "YouTube Studio"`.
These feed the `content-strategy` skill.
