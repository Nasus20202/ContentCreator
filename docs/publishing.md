# Publishing

Approved episodes are published through **[Buffer](https://buffer.com)** (free plan: up to 3 channels) with its
public GraphQL API (`src/publish/buffer.ts`). Channels: **YouTube** (Photon Sphere, `@thephotonsphere`) and
**TikTok** (`@thephotonsphere`). Meta is not connected (see `docs/decisions/`).

Why Buffer and not the self-hosted Postiz we started with: Buffer's YouTube and TikTok apps are already audited, so
posts go out **public** from day one. With our own Postiz app, YouTube and TikTok keep API uploads private until
their audits pass, and TikTok additionally needs a public HTTPS domain. The Postiz stack was removed (it is in git
history if we ever need it).

## How a publish works

```
cc publish <id> --mode schedule --at <ISO>
  1. checks: stage approved, current video sha256 == approved sha256, targets configured
  2. hosts the video: commits `<episode>-<sha8>.mp4` to the orphan `videos` branch of this public repo
     (git plumbing; working tree untouched) → https://raw.githubusercontent.com/<repo>/videos/<file>
     (Buffer only accepts media by public URL; re-runs reuse the file)
  3. one Buffer createPost per platform (a failure on one does not block the others)
  4. records everything in episodes/<id>/publish.json (payloads, media URL, Buffer post ids, errors)
```

Per-platform input (`src/publish/payload.ts`):

| Platform | Buffer metadata                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| YouTube  | `title` (≤100), `privacy: public`, `madeForKids: false`, `categoryId: 28` (Science & Technology), `isAiGenerated` (config flag) |
| TikTok   | `isAiGenerated`; caption = title + description + hashtags                                                                       |

Modes: `now` → `shareNow`, `schedule` → `customScheduled` + `dueAt`, `draft` → saved as a Buffer draft (nothing is
published until someone schedules it in Buffer).

## Setup (once)

1. The human creates the Buffer account and connects the YouTube and TikTok channels in Buffer (OAuth).
2. The human creates an API key at <https://publish.buffer.com/settings/api> and puts it in `.env` as
   `BUFFER_API_KEY` (never commit it, never paste it into chat or records).
3. Media: this repository (public), orphan branch `videos` (`channel.config.json → publishing.mediaHost`).
   Needs push access to `origin`. Clone `main` with `git clone --single-branch` to skip the videos.
4. `pnpm -s cc publish channels` → copy the YouTube and TikTok channel ids into
   `channel.config.json → publishing.targets` (`{ "platform": "youtube", "channelId": "…" }`).

## Limits and caveats

- Free plan: 3 channels, a limited queue per channel. "Queue limit reached" comes back as a per-platform failure.
- Videos are public on GitHub from upload time (they are approved for publishing anyway). Don't rewrite the `videos`
  branch before posts have gone out: Buffer fetches the URL at publish time.
- The branch grows ~11 MB per episode (git keeps every file). Fine for a long while; if it gets big, squash the
  branch to only recent files after their posts are published.
- Buffer's API keys have no scopes: a leaked key can publish. Rotate it in Buffer settings if in doubt.
- Metrics: Buffer exposes post metrics in its API (`Post.metrics`); until that is wired up, record metrics with
  `cc metrics add`.
