---
name: plan-episode
description: Choose what an episode covers and write its plan.json (script, scenes, camera, labels, post copy) following the series rules and quality bar. Use after research, or whenever plan.json must be written or revised.
---

# Plan an episode

Inputs: `research.json`, `facts.json`, `series/<series>.md`, `docs/quality-bar.md`, `docs/plan-format.md` (template reference). Output: `episodes/<id>/plan.json`, validated with `pnpm -s cc plan <id>`.

## Choose

1. Rank candidates by **what a viewer would actually go outside for**, not by score alone. Reject things that are below ~15° altitude, need optics (unless said), or happen in daylight.
2. One lead event; at most two secondaries. Total narration ≈ 110–130 words (≈ 45–50 s).
3. Pick one **insight beat**: why it happens, true scale (`orbit3d`), a real photo (`image` via `cc asset search/add`), or a big number (`factCard`). It must teach something, not decorate.
4. Record it: `cc decision <id> --stage research …` (selection + rejected options) and `--stage script …` (hook + insight choice).

## Write

- **Hook (first sentence, ≤ 12 words)**: the concrete promise ("Mars and Jupiter almost touch this week."). No questions-as-clickbait, no "you won't believe".
- One idea per sentence; sentences are the timing unit (cameras/labels/chips anchor to them).
- Spell numbers the way they are spoken ("two hundred million"); keep them roundable from a fact.
- Every scene lists `factIds` covering **all** numbers and claims in its narration, chips, labels and overlays. Post copy may use any fact used in the video.
- When/where must be concrete: weekday + date, time window, plain-word direction and height.
- Post copy: title ≤ 90 chars, description states facts + data sources + "Narration uses a synthetic voice.", 4–7 hashtags.

## Stage it visually (skyView)

- `time` = the moment you tell people to look (UTC ISO). Check in `research.json` → `viewing.bestUtc`.
- Camera: start wide (fov 90–110) and end tight on the subject; never tighter than ~5° without `separation`/`moonCompare` for scale. Key times use `{ "sentence": n, "edge": "start|end", "offset": s }`.
- Labels: ≤ 3 visible; choose `side` so they don't overlap (east is left when facing south). Verify in QA frames.
- Chips: when/where the viewer must remember; ≤ 48 chars; non-overlapping windows.

## Validate

`pnpm -s cc plan <id>` → fix all ✗ errors; consider every ! warning. Then continue with the `fact-check` skill.
