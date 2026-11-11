# ContentCreator — operating manual for Claude

This repo is a short-form video channel run from Claude Code. You (Claude) plan, write, fact-check and review episodes; the `cc` CLI does everything deterministic (astronomy, TTS, rendering, QA, publishing) and **records every step**. A human approves before anything is published.

Read before working: `docs/quality-bar.md` (non-negotiable), the series file in `series/`, and `docs/plan-format.md` when writing a plan.

## Golden rules

1. **Never invent facts.** Every number a viewer hears or reads must come from `facts.json` (computed by the pipeline, or added with `cc fact add` citing a URL). `cc factcheck` enforces numbers; you enforce meaning.
2. **Record decisions.** Any editorial choice (which events, hook, angle, rejected options, rewording after review) → `cc decision <episode> …` with rationale and alternatives. Channel-level choices → `cc decision --channel …`. If it isn't recorded, it didn't happen.
3. **Never skip gates or edit records by hand.** Don't edit `episode.json`, `*.jsonl`, `factcheck.json`, `qa.json`, `render.json`, `publish.json`, or generated READMEs. Change inputs (`plan.json`, facts via CLI) and re-run stages.
4. **Never approve or publish on your own.** `cc approve` is the human's step (`autoApprove` is false). Real publishing (`cc publish` without `--dry-run`) only when the user explicitly asks in this conversation.
5. **Real imagery only.** Use computed sky/orbits or `cc asset` (NASA, with credits). No AI-generated images unless the user explicitly asks; they must then be recorded with `aiGenerated: true`.
6. **Look at what you made.** After `cc qa`, open the review frames with the Read tool and check them against `qa-review` before recording a verdict.

## Pipeline at a glance

```
episode new → research → plan.json (you) → plan → factcheck (+ your review) → voice → render → qa (+ your review) → approve (human) → publish → metrics
```

`pnpm cc status <episode>` always prints the next step. Everything is run as `pnpm -s cc <command>`.

## Skills (in `.claude/skills/`)

| Skill              | Use when                                                                            |
| ------------------ | ----------------------------------------------------------------------------------- |
| `produce-episode`  | "make this week's episode", end-to-end run                                          |
| `plan-episode`     | choosing events and writing `plan.json`                                             |
| `fact-check`       | semantic review after `cc factcheck` passes                                         |
| `qa-review`        | inspecting rendered frames before `cc qa --review`                                  |
| `publish-episode`  | approval hand-off and Postiz publishing                                             |
| `operate-postiz`   | the self-hosted Postiz stack in `infra/postiz` (up/down, health, backups, upgrades) |
| `content-strategy` | "what should we make?", metrics review, new series ideas                            |
| `new-series`       | adding a series or a scene template                                                 |

## Engineering conventions

- TypeScript strict, ESM, extensionless imports. Node pipeline in `src/`, Remotion bundle in `video/`; `src/core/schemas.ts` and `src/core/timing.ts` are shared and must stay browser-safe.
- Schemas (zod) are the single source of truth for every file format. Change the schema first.
- Before committing: `pnpm check` (prettier, eslint, tsc, vitest). Add tests for new logic in `tests/`.
- Dependencies: Renovate (`renovate.json`, preset `github>Nasus20202/renovate`). Remotion packages share one exact version; TypeScript stays < 6.1 until typescript-eslint supports 7.
- CI (`.github/workflows/ci.yml`): format, lint, typecheck, tests (+coverage), Remotion bundle, record validation (`cc validate`), compose config.
- Commit episode records (everything in `episodes/<id>/` except `build/`). Conventional commit messages.
