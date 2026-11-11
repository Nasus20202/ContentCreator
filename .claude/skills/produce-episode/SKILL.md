---
name: produce-episode
description: Produce a channel episode end-to-end (research → plan → fact-check → voice → render → QA → hand-off for approval). Use when the user asks to make, produce, or prepare an episode, e.g. "make next week's Sky This Week".
---

# Produce an episode

Drive the pipeline stage by stage. After every command, read its output; on failure, fix the **input** (plan, facts) and re-run — never edit records by hand. `pnpm -s cc status <id>` tells you the next step at any time.

## 1. Create

- Pick the series (default `sky-this-week`) and, for weekly series, the **Monday** of the target week (normally next week). Location: `channel.config.json` → `defaultLocation` unless the user names one.
- `pnpm -s cc episode new --series sky-this-week --week YYYY-MM-DD --location eu-central --actor claude`

## 2. Research

- Sky series: `pnpm -s cc research sky <id>` → `research.json` + `facts.json`.
- Other series: research on the web, then add each claim you will use with `cc fact add <id> --id … --statement … --url … --title … --values …` (see `new-series` skill).
- Inspect: `pnpm -s cc show <id>` and `pnpm -s cc fact list <id>`.

## 3. Plan (skill: `plan-episode`)

- Record the event selection **before** writing: `cc decision <id> --stage research --decision … --rationale … --alternatives "a|b"`.
- Write `episodes/<id>/plan.json`, then `pnpm -s cc plan <id>` until it reports `plan accepted`.

## 4. Fact-check (skill: `fact-check`)

- `pnpm -s cc factcheck <id>` — fix every ✗ by rewording or citing a fact; never by adding a fact you did not verify.
- Do the semantic review, then `cc factcheck <id> --review pass --actor claude --notes "<what you verified>"`.

## 5. Voice and render

- `pnpm -s cc voice <id>` (Kokoro, CPU, ~1–2 min). Total must stay under ~55 s; if longer, cut words and go back to step 3.
- `pnpm -s cc render <id>` (CPU, ~3–5 min). Run it in the background if possible.

## 6. QA (skill: `qa-review`)

- `pnpm -s cc qa <id>`, then **Read every frame** in `episodes/<id>/build/qa/`.
- Fix problems in the plan (labels, camera, chips) → re-run `plan` → `factcheck` → (`voice` only if narration changed) → `render` → `qa`.
- When clean: `cc qa <id> --review pass --actor claude --notes "<what you checked>"`.

## 7. Hand off

- `pnpm -s cc report <id>`.
- Tell the user: the video path (`episodes/<id>/build/video.mp4`), the script, the decisions you made, anything you are unsure about, and the approval command they run themselves:
  `pnpm cc approve <id> --by "<their name>"`.
- Commit the episode records (not `build/`) with a conventional message, e.g. `feat(episode): sky-this-week 2026-11-16 eu-central`, if the user wants commits.

Do **not** approve or publish yourself. Publishing is the `publish-episode` skill, and only on explicit request.
