# ContentCreator

A short-form video channel operated from **Claude Code**: Claude researches, writes, fact-checks and reviews; a deterministic TypeScript pipeline computes the facts, voices, renders, QA-checks and publishes — and records every step and decision so each video is fully traceable.

First series: **Sky This Week** — a weekly, location-specific guide to what's worth seeing in the night sky, computed from ephemerides (not made up), rendered as a 1080×1920 short.

## How it works

```
cc episode new → cc research sky → plan.json (Claude) → cc plan → cc factcheck (+ Claude review)
   → cc voice (Kokoro, local) → cc render (Remotion + three.js) → cc qa (+ Claude visual review)
   → cc approve (human) → cc publish (self-hosted Postiz) → cc metrics add
```

- **Facts are computed or cited.** `astronomy-engine` computes events and geometry for a named location; other claims need a URL. Every number in narration, on screen and in the post copy must map to a fact (`cc factcheck`).
- **Real visuals.** Computed star field (5,000 stars, constellations), planets with correct phases and separations, a three.js orbit view, NASA imagery with credits. No AI images by default.
- **Gates and hashes.** Stages refuse to run on stale inputs; approval pins the video's sha256; publishing only ships the approved file.
- **Full audit trail.** Per-episode log, decisions with rationale, fact-check and QA reviews, publish payloads, metrics → generated `episodes/<id>/README.md` and `docs/ledger.md`.

## Quick start

```bash
pnpm install
pnpm check                      # prettier + eslint + tsc + vitest
pnpm cc status               # episodes and their next step
```

Then, in Claude Code: _"Produce next week's Sky This Week episode"_ (skill `produce-episode`).

## Repository map

| Path                        | What                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLAUDE.md`                 | Operating rules for Claude                                                                                                                                                                                                                                                                                                                                         |
| `.claude/skills/`           | `produce-episode`, `plan-episode`, `fact-check`, `qa-review`, `publish-episode`, `operate-postiz`, `content-strategy`, `new-series`                                                                                                                                                                                                                                |
| `.github/`, `renovate.json` | CI (format, lint, types, tests, bundle, records, compose) and Renovate                                                                                                                                                                                                                                                                                             |
| `docs/`                     | [architecture](docs/architecture.md) · [pipeline](docs/pipeline.md) · [plan format](docs/plan-format.md) · [quality bar](docs/quality-bar.md) · [traceability](docs/traceability.md) · [publishing](docs/publishing.md) · [content strategy](docs/content-strategy.md) · [setup](docs/setup.md) · [decisions](docs/decisions/README.md) · [ledger](docs/ledger.md) |
| `series/`                   | Series definitions (format, rules)                                                                                                                                                                                                                                                                                                                                 |
| `infra/postiz/`             | Self-hosted Postiz (docker compose + `postiz.sh`), operated via `pnpm postiz:*`                                                                                                                                                                                                                                                                                    |
| `episodes/<id>/`            | One folder per episode: inputs, records, generated README (`build/` is gitignored)                                                                                                                                                                                                                                                                                 |
| `src/`                      | Pipeline (Node): core, planning, voice, render, publish, report, CLI                                                                                                                                                                                                                                                                                               |
| `video/`                    | Remotion composition and scene templates                                                                                                                                                                                                                                                                                                                           |
| `tests/`                    | Vitest suites                                                                                                                                                                                                                                                                                                                                                      |
| `assets/catalog/`           | Star and constellation catalogs (d3-celestial, BSD-3-Clause)                                                                                                                                                                                                                                                                                                       |

## Credits

Star/constellation data: [d3-celestial](https://github.com/ofrohn/d3-celestial) (BSD-3-Clause). Ephemerides: [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT). Meteor shower parameters: [International Meteor Organization](https://www.imo.net/resources/calendar/). TTS: [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0). Rendering: [Remotion](https://www.remotion.dev) — check Remotion's license terms for commercial use by companies.
