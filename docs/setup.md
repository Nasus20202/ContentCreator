# Setup

## Requirements

- Node.js ≥ 22 (developed on 26), npm
- `ffmpeg` and `ffprobe` on `PATH`
- ~2 GB disk for `node_modules`, the Remotion Chrome download and the Kokoro model (~90 MB, cached on first `cc voice`)
- Network on first run (Chrome headless shell, Kokoro model from Hugging Face, Google Fonts at render time, NASA API for assets)
- No GPU needed
- Docker with Compose v2 for the self-hosted Postiz stack (`infra/postiz`, ~2–3 GB RAM incl. Elasticsearch)

```bash
pnpm install
pnpm check               # format, lint, typecheck, tests
pnpm cc --help
pnpm cc status
```

Optional: `cp .env.example .env` and fill in the Postiz values (see `publishing.md`).

## Previewing an episode in Remotion Studio

```bash
pnpm studio -- --props episodes/<id>/build/render-props.json --public-dir episodes/<id>/build
```

`render-props.json` is produced by `cc render`; voice files by `cc voice`.

## Restoring a cloned episode

`build/` is not committed. To reproduce: `cc asset restore <id>` (verifies sha256), `cc voice <id>`, `cc render <id>`. TTS and rendering are deterministic in content, but the MP4 bytes (and therefore the sha256) can differ across machines/versions — re-approval is then required by design.
