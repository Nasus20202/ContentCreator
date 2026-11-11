---
name: operate-postiz
description: Run and maintain the self-hosted Postiz stack in infra/postiz (docker compose) — start/stop, health, logs, backups, upgrades, connecting platform apps, and wiring the API key into the pipeline. Use for anything about Postiz infrastructure or when publishing fails at the Postiz level.
---

# Operate the self-hosted Postiz stack

Everything lives in `infra/postiz/` and is driven by `infra/postiz/postiz.sh` (npm scripts `postiz:*`). Secrets are in `infra/postiz/.env` (gitignored, mode 600) — never print them, commit them, or paste them into logs/decisions.

## Commands

| Task                                 | Command                                                             |
| ------------------------------------ | ------------------------------------------------------------------- |
| First-time setup (generates secrets) | `pnpm postiz:init`                                                  |
| Start / update to pinned images      | `pnpm postiz:up` (waits until healthy, up to 5 min)                 |
| Health                               | `pnpm postiz:status`                                                |
| Logs                                 | `pnpm postiz:logs` or `infra/postiz/postiz.sh logs temporal`        |
| Stop                                 | `pnpm postiz:down` (volumes are kept)                               |
| DB backup                            | `pnpm postiz:backup` → `infra/postiz/backups/*.sql.gz` (gitignored) |
| Validate compose                     | `infra/postiz/postiz.sh config`                                     |

## First-time bring-up (with the user)

1. `pnpm postiz:init` then `pnpm postiz:up`.
2. The **user** opens `MAIN_URL` (default http://localhost:4007), registers the admin account, and creates an API key (Settings → Public API). Do not create accounts or choose passwords on their behalf.
3. Set `DISABLE_REGISTRATION=true` in `infra/postiz/.env`, `pnpm postiz:up` again.
4. Repo `.env`: `POSTIZ_BASE_URL=<NEXT_PUBLIC_BACKEND_URL>/public/v1` (default `http://localhost:4007/api/public/v1`) and `POSTIZ_API_KEY=<key>` (the user pastes it).
5. Platform apps: OAuth callbacks need a **public HTTPS URL**. Put a reverse proxy (Caddy/Traefik/nginx) in front, set `MAIN_URL`, `FRONTEND_URL`, `NEXT_PUBLIC_BACKEND_URL` to it, add the provider client ids/secrets to `infra/postiz/.env`, restart, then the user connects channels in the Postiz UI. Per-platform requirements and audit caveats: `docs/publishing.md`.
6. `pnpm -s cc publish channels` → copy integration ids into `channel.config.json → publishing.targets`.
7. Record the setup as a channel decision (no secrets): `cc decision --channel --stage infra …`.

## Upgrades

Renovate opens grouped "postiz stack" PRs (never automerged). Before merging: read the Postiz release notes, `pnpm postiz:backup`, then `pnpm postiz:up` and check `postiz:status` + `cc publish channels`. Temporal/Elasticsearch versions follow upstream `postiz-docker-compose`; bump them only together with Postiz.

## Troubleshooting

- `cc publish channels` 404 → wrong `POSTIZ_BASE_URL` prefix (`/api/public/v1` for the official image).
- 401 → API key wrong/rotated.
- Postiz container unhealthy → `postiz.sh logs postiz`; usually Temporal not ready (`postiz.sh logs temporal`) or DB credentials changed after first init (volumes keep the old password).
