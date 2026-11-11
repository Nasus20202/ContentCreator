# Pipeline stages

| #   | Stage reached | Command                                                              | Who               | Gate / check                                                |
| --- | ------------- | -------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------- |
| 0   | `created`     | `cc episode new --series … [--week YYYY-MM-DD --location …]`         | Claude            | series exists                                               |
| 1   | `researched`  | `cc research sky <id>` / `cc fact add <id> …`                        | pipeline / Claude | —                                                           |
| 2   | `planned`     | Claude writes `plan.json`; `cc plan <id>`                            | Claude            | schema + cross-references; stores `hashes.plan`             |
| 3   | `factchecked` | `cc factcheck <id>` then `cc factcheck <id> --review pass --notes …` | pipeline + Claude | every number backed; plan unchanged; review by claude/human |
| 4   | `voiced`      | `cc voice <id>`                                                      | pipeline          | plan unchanged since fact-check                             |
| 5   | `rendered`    | `cc render <id>`                                                     | pipeline          | narration hash matches timeline                             |
| 6   | `qa-passed`   | `cc qa <id>` then `cc qa <id> --review pass --notes …`               | pipeline + Claude | all automated checks ✓; render matches plan                 |
| 7   | `approved`    | `cc approve <id> --by "<name>"`                                      | **human**         | video sha256 pinned                                         |
| 8   | `published`   | `cc publish <id> [--dry-run] [--mode …]`                             | Claude on request | video equals approved file                                  |

Editing `plan.json` after stage 2 and re-running `cc plan` moves the episode back to `planned` (logged as `stage.regress`); every later stage must be re-run. Visual-only edits keep the existing voice (narration hash unchanged) but still require fact-check review, render and QA.

## Timing model

- Narration is split into **sentences**; each is synthesised separately, trimmed, and joined with 0.28 s gaps (0.15 s lead-in).
- Scene length = narration + 0.25 s tail. Scenes cross-fade in over 8 frames.
- Plans reference time as seconds from scene start or `{ "sentence": n, "edge": "start" | "end", "offset": s }`.

## Known limitations (honest list)

- **Word timings are estimated** (proportional to word length) because Kokoro returns no timestamps. Captions are sentence-accurate and usually word-close; a forced-alignment pass (e.g. whisper) is the planned fix.
- **Music** is a locally synthesised ambient pad (license-free, but plain). Swap `synthesizePad` for licensed tracks if desired, and record their licenses as assets.
- **Fonts** are fetched from Google Fonts at render time (network needed).
- **Meteor shower peaks** use IMO solar longitudes via astronomy-engine's apparent solar longitude; expect ±~half a day versus IMO's published times. Scripts say "around the peak".
- **Sky rendering** is stereographic with a stylised horizon; no atmospheric refraction or light pollution model.
- **Platform publishing** depends on each platform's app audit status (see `docs/publishing.md`).
