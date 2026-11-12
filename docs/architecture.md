# Architecture

```
            Claude Code (skills in .claude/skills)
   judgement: choose · write · review · decide (logged)
                         │  runs
                         ▼
                 cc CLI (src/cli)  ── thin wrapper
                         │
              pipeline stages (src/pipeline/stages.ts)
   gating: stage order + input hashes · records · logging
      │            │             │            │             │
 planning/     voice/        render/       publish/      report/
 astro events  Kokoro TTS    Remotion +    Buffer        README +
 snapshots     timings       ffmpeg + QA   client        ledger
 factcheck                       │
 plan checks                     ▼
                         video/ (Remotion bundle, browser)
                         templates: skyView · orbit3d · factCard · scale · image · outro
```

## Modules

| Path                                                 | Responsibility                                                                                                                           | Notes                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/core/schemas.ts`                                | zod schemas for **every** file and the render props                                                                                      | Shared with `video/`; browser-safe                                 |
| `src/core/episode.ts`                                | Manifest state machine, append-only log & decisions                                                                                      | All writes go through `Episode`                                    |
| `src/core/timing.ts`                                 | Scene frame math, TimeRef resolution                                                                                                     | Shared with `video/`                                               |
| `src/core/io.ts`, `paths.ts`, `config.ts`, `time.ts` | JSON/JSONL IO with validation, hashing, paths, config, tz helpers                                                                        | `CC_EPISODES_DIR`/`CC_DOCS_DIR` override for tests                 |
| `src/planning/astro/`                                | Event detection (conjunctions, Moon passes, meteor showers, phases, oppositions, elongations, eclipses, visibility) and render snapshots | Deterministic; astronomy-engine; IMO shower table                  |
| `src/planning/factcheck/`                            | Number extraction (digits, words, ordinals, times) and fact matching                                                                     | Strict: integers exact, decimals at spoken precision               |
| `src/planning/validate-plan.ts`                      | Cross-reference checks (facts, bodies, sentence refs, assets, length)                                                                    |                                                                    |
| `src/voice/`                                         | Kokoro TTS, WAV encoding, silence trimming, word-timing estimation                                                                       | Engine behind `TtsEngine` interface                                |
| `src/render/`                                        | Props assembly, Remotion bundle/render, ffmpeg (music pad, loudness, probes), QA                                                         | Renderer behind `Renderer` interface                               |
| `src/publish/`                                       | Buffer client, media host (GitHub releases), per-platform payloads                                                                       | Publisher behind an interface; dry-run default without credentials |
| `src/assets/nasa.ts`                                 | NASA Image Library search/download with provenance                                                                                       | Rejects items flagged with third-party copyright                   |
| `src/report/`                                        | Episode README, ledger, decisions README                                                                                                 | Generated, never hand-edited                                       |
| `video/`                                             | Remotion composition `Episode` + templates                                                                                               | Pure function of `RenderProps`                                     |

## Data flow

1. `research` → `research.json`, `facts.json` (computed facts carry method + inputs).
2. Claude writes `plan.json` (scenes reference facts and sentences).
3. `plan` validates and stores `hashes.plan`; `factcheck` maps every number to a fact; Claude's review is recorded.
4. `voice` → per-scene WAVs + `timeline.json` (hash of narration only — visual edits don't force re-voicing).
5. `render` → `render-props.json` (sky/orbit snapshots computed in Node), Remotion renders in headless Chrome with SwiftShader WebGL, ffmpeg normalises loudness → `video.mp4` (sha256 recorded).
6. `qa` → technical checks + frames → Claude's visual review recorded.
7. `approve` (human) pins the video hash → `publish` uploads that exact file.

## Design choices

- **Deterministic core, judgement at the edges.** Anything computable is computed and tested; Claude does selection, writing and review, and every judgement is logged with rationale.
- **Interfaces at side-effect boundaries** (`TtsEngine`, `Renderer`, `Publisher`) so stage logic is unit-tested without models, Chrome or network.
- **Plans are declarative.** Templates + TimeRefs anchored to sentences mean re-voicing never breaks timing.
- **No GPU required.** Kokoro on CPU, WebGL via SwiftShader. A 50 s episode renders in ~3–5 min on a 12-core laptop.
