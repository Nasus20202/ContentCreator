# Publishing via self-hosted Postiz

The pipeline publishes through the **public API of your own Postiz instance**, which runs from this repo (`infra/postiz/`, docker compose; skill `operate-postiz`). Postiz holds the platform OAuth connections; the pipeline only stores integration ids and never sees platform tokens.

## 0. Run Postiz

```bash
pnpm postiz:init    # infra/postiz/.env with generated secrets (gitignored)
pnpm postiz:up      # postiz + postgres + redis + temporal (+ elasticsearch), waits until healthy
pnpm postiz:status
```

Open `MAIN_URL` (default http://localhost:4007), register the admin user, create an API key, then set `DISABLE_REGISTRATION=true` and `pnpm postiz:up` again. Platform OAuth callbacks need a public HTTPS URL: put a reverse proxy in front and set `MAIN_URL` / `FRONTEND_URL` / `NEXT_PUBLIC_BACKEND_URL` accordingly, and add provider credentials (`YOUTUBE_CLIENT_ID`, `TIKTOK_CLIENT_ID`, `FACEBOOK_APP_ID`, …) to `infra/postiz/.env`.

## 1. Configure the repo

```bash
cp .env.example .env
# POSTIZ_BASE_URL = your instance's public API root, no trailing slash
# POSTIZ_API_KEY  = Postiz → Settings → Public API
pnpm cc publish channels          # lists integrations: identifier, id, name
```

Put the ids into `channel.config.json`:

```json
"publishing": {
  "defaultMode": "draft",
  "aiDisclosure": true,
  "targets": [
    { "platform": "youtube",   "integrationId": "…", "enabled": true },
    { "platform": "tiktok",    "integrationId": "…", "enabled": true },
    { "platform": "instagram", "integrationId": "…", "enabled": true },
    { "platform": "facebook",  "integrationId": "…", "enabled": false }
  ]
}
```

The public API root is `NEXT_PUBLIC_BACKEND_URL` + `/public/v1` — with the bundled compose: `http://localhost:4007/api/public/v1`.

## 2. Platform apps (self-hosted = your own developer apps)

Self-hosting means each platform connection uses **your** developer app, configured in `infra/postiz/.env`. Each platform gates video publishing differently:

| Platform      | What you need                                                                                                      | Gotchas                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **YouTube**   | Google Cloud project, YouTube Data API v3, OAuth client (Postiz callback URL)                                      | Unverified apps: uploads may be forced **private** until Google's audit; default quota ≈ 10,000 units/day (an upload costs ~1,600 → ~6 uploads/day)     |
| **TikTok**    | TikTok for Developers app with **Content Posting API** (Direct Post)                                               | Until the app passes TikTok's audit, posts are restricted to **private (SELF_ONLY)** visibility. `privacy_level: PUBLIC_TO_EVERYONE` fails before audit |
| **Instagram** | Meta app, Instagram **Business/Creator** account linked to a Facebook Page, `instagram_content_publish` permission | Needs Meta App Review for production; Reels are published as video posts                                                                                |
| **Facebook**  | Same Meta app, Page permissions (`pages_manage_posts`)                                                             | Posts go to a Page, not a personal profile                                                                                                              |

Until audits pass, use `--mode draft` (default): Postiz creates drafts and you click publish in its UI, or post manually from the rendered file.

## 3. Publishing an episode

```bash
pnpm cc publish <id> --dry-run                       # always first: builds + records payloads
pnpm cc publish <id> --mode draft                    # drafts in Postiz
pnpm cc publish <id> --mode schedule --at 2026-11-12T17:00:00Z
pnpm cc publish <id> --platforms tiktok --mode now   # retry one platform
```

What the pipeline sends (see `src/publish/payload.ts`):

- One upload (`POST /upload`) of `build/video.mp4`, then one `POST /posts` **per platform** so a failure on one doesn't block others.
- YouTube: `title`, `type: public`, `selfDeclaredMadeForKids: no`, tags from hashtags.
- TikTok: `DIRECT_POST`, public, duet off, stitch on, comments on, `video_made_with_ai` = `aiDisclosure`.
- Instagram: `post_type: post`. Facebook: defaults.
- Caption: title (except YouTube) + description + hashtags. Descriptions include the synthetic-voice disclosure line.

Every attempt — including dry runs and the exact payloads — is recorded in `publish.json` and the episode README.

## 4. Metrics

Metrics are currently recorded explicitly (source noted per snapshot). Postiz v2.25 also exposes `GET /public/v1/analytics/post/:postId` — automating `cc metrics` from it is a planned follow-up once real posts exist to validate the response shape.

```bash
pnpm cc metrics add <id> --platform youtube --views 5400 --likes 310 --avg-view-pct 74 --source "YouTube Studio 7d"
```
