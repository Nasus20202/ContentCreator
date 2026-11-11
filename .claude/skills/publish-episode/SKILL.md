---
name: publish-episode
description: Hand an episode to the human for approval and publish it to YouTube/TikTok/Instagram/Facebook through the self-hosted Postiz instance. Use only when the user asks to publish/schedule, or to set up publishing.
---

# Publish an episode

## Preconditions (enforced by the CLI)

- Stage `approved`: a **human** ran `pnpm cc approve <id> --by "<name>"` on the exact video (sha256-pinned). If not, show them the video path and ask; never run approve yourself.
- `.env` has `POSTIZ_BASE_URL` and `POSTIZ_API_KEY`; `channel.config.json → publishing.targets` lists the Postiz integration ids (get them with `pnpm -s cc publish channels`). Setup details: `docs/publishing.md`.

## Steps

1. Always dry-run first and show the user the payload summary:
   `pnpm -s cc publish <id> --dry-run --mode <draft|schedule|now> [--at <ISO>]`
   (payloads are recorded in `publish.json`).
2. Only after the user explicitly confirms platforms, mode and time:
   `pnpm -s cc publish <id> --mode schedule --at 2026-11-12T17:00:00Z --actor claude`
   - `draft` (default) creates drafts in Postiz for a final manual click.
   - Partial failures are recorded per platform; retry with `--platforms <failed ones>`.
3. `pnpm -s cc report <id>` and tell the user what was submitted (and what failed, verbatim).
4. Commit the updated records.

## Later: metrics

After 48 h and 7 days, ask the user for (or read) platform analytics and record them:
`pnpm -s cc metrics add <id> --platform youtube --views 1234 --likes 56 --avg-view-pct 71 --url … --source "YouTube Studio"`.
These feed the `content-strategy` skill.
