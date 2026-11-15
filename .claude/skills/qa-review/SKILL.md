---
name: qa-review
description: Visually review a rendered episode via the frames extracted by `cc qa` and record the verdict. Use after every render, before asking the human for approval.
---

# Visual QA review

`pnpm -s cc qa <id>` runs technical checks (resolution, codec, duration ≤ 60 s, loudness ≈ -14 LUFS, true peak, black gaps) and extracts one frame per sentence plus each scene's last frame into the episode's `build/qa/` (`episodes/<series>/<slug>/build/qa/`). Any ✗ there must be fixed first.

## Look at every frame (Read tool) and check

- **Legibility**: captions fully visible, not covering the subject; nothing important in the top ~170 px or bottom ~420 px (platform UI).
- **Collisions**: labels, chips, separation text, title overlay and captions do not overlap each other; labels are not cut off at the frame edge.
- **Correctness of what is shown**: the labelled object is the one the narration talks about; the direction (compass letters on the horizon) matches the script; the Moon's phase looks right for the date.
- **Composition**: subject is visible and reasonably centred at the moment it is named; zoomed shots have a scale reference; the ground/horizon renders cleanly (no artefacts, wedges, or empty black regions).
- **Pacing**: each chip appears while the matching sentence is spoken; scene ends are not frozen too long.
- **Credits**: every `image` scene shows its credit line.
- **Cover** (`cover.jpg`, `cover-grid.jpg` = the 3:4 crop Instagram/TikTok profile grids show): the opening image and the title read clearly inside the crop, no captions or credit, nothing cut off; it should not look like the neighbouring episodes in the queue (different image or colour). Fix with the hook's image/title or `post.coverAt`.

## Then

- Problems → fix `plan.json` (camera keys, label sides, chip windows), re-run `plan` → `factcheck` (+ review) → `render` → `qa`. Record notable fixes with `cc decision <id> --stage visuals …`.
- Clean → `pnpm -s cc qa <id> --review pass --actor claude --notes "<what you checked, frame by frame highlights>"`.
- If you can't judge something from stills (motion, audio), say so explicitly in the notes and in your hand-off to the human.
