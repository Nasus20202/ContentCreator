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

Music beds are composed with Tone.js + tonal and rendered offline in headless Chromium (set `CHROMIUM_PATH` if it is not at `/usr/bin/chromium-browser`, `/usr/bin/chromium` or `/usr/bin/google-chrome`). Recorded instrument samples (tonejs-instruments, CC BY 3.0, pinned commit in `assets/audio/tonejs-instruments.json`) are fetched on first use into `assets/audio/tonejs-instruments/` (gitignored). Beds are reproducible to float precision (~-140 dB between runs). TTS and rendering are deterministic in content, but the MP4 bytes (and therefore the sha256) can differ across machines/versions — re-approval is then required by design.
