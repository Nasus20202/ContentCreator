# Setup

## Requirements

- Node.js ≥ 22 (developed on 26), npm
- `ffmpeg` and `ffprobe` on `PATH`
- ~2 GB disk for `node_modules`, the Remotion Chrome download and the Kokoro model (~90 MB, cached on first `cc voice`)
- Network on first run (Chrome headless shell, Kokoro model from Hugging Face, Google Fonts at render time, NASA API for assets)
- No GPU needed

```bash
pnpm install
pnpm check               # format, lint, typecheck, tests
pnpm cc --help
pnpm cc status
```

Optional: `cp .env.example .env` and set `BUFFER_API_KEY` (see `publishing.md`).

## Previewing an episode in Remotion Studio

```bash
pnpm studio -- --props episodes/<id>/build/render-props.json --public-dir episodes/<id>/build
```

`render-props.json` is produced by `cc render`; voice files by `cc voice`.

## Restoring a cloned episode

`build/` is not committed. To reproduce: `cc asset restore <id>` (verifies sha256), `cc voice <id>`, `cc render <id>`. `cc render` runs the restore itself and refuses to render on a hash mismatch, so the explicit restore is only needed to check assets without rendering.

## Piano samples for the music bed

The piano bed needs 38 trimmed mp3s in `assets/audio/piano/`. The renderer fetches them on first use from the FreePats Upright Piano KW bank (CC0, no attribution needed), caches the 7z archive in `.cache/piano-kw/` (gitignored), and needs the `7z` command to extract it (`apt install p7zip-full` or `brew install sevenzip`). The output is byte-identical across runs. To prepare them ahead of time, or offline after one online run: `pnpm tsx scripts/prepare-piano.ts`. TTS and rendering are deterministic in content, but the MP4 bytes (and therefore the sha256) can differ across machines/versions — re-approval is then required by design.
