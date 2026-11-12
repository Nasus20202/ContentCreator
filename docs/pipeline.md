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

## Look per series

The accent colour comes from the series, not the template: `src/render/palette.ts` maps `sky-this-week` to amber, `sky-tonight` to coral and `sky-school` to cyan. It reaches the composition as `props.accent` and every template reads it through `useAccent()` (canvas code takes it as an argument), so caption highlights, chips, badges, fact-card numbers, the radiant marker and the outro kicker all change together. Add a series → add an entry there; missing series fall back to amber.

## Timing model

- Narration is split into **sentences**; each is synthesised separately, trimmed, and joined with 0.28 s gaps (0.15 s lead-in).
- Scene length = narration + 0.25 s tail. Scenes cross-fade in over 8 frames.
- Plans reference time as seconds from scene start or `{ "sentence": n, "edge": "start" | "end", "offset": s }`.

## Known limitations (honest list)

- **Word timings are estimated** (proportional to word length) because Kokoro returns no timestamps. Captions are sentence-accurate and usually word-close; a forced-alignment pass (e.g. whisper) is the planned fix.
- **Music** is a locally synthesised, license-free bed with a sampled piano (FreePats Upright Piano KW, CC0). The default beds are **arranged** (`src/render/score.ts`): a seeded chord progression, piano arpeggio and motif, soft kick and shaker with sidechain, sub bass and reverb, laid out on the episode's scene cuts: a lighter groove under the hook, the full groove in the body, a quiet riser into each cut, a soft impact after the hook, drums out for the outro, and a final home chord. Per series: `orbit` (Sky This Week, 92 bpm), `nebula` (Sky School, 78 bpm), `meteor` (Sky Tonight, 104 bpm). The original slow loops (`piano`, `piano-pulse`, `piano-air`) remain selectable with `music.style`. Optional `music.seed` (progression, arpeggio and motif choice, humanisation) and `music.transpose` give variants. Beds are deterministic and loudness-matched (-17.8 LUFS); in the mix they sit at `music.volume` in the pauses and drop to half under narration. Audition: `pnpm tsx scripts/music-ab.ts` and `pnpm tsx scripts/music-variants.ts`.
- **Branding**: the Photon Sphere mark (`video/brand/mark.png`, rendered from the `Mark` still) sits in the series badge from the end of the hook, with a progress hairline, and the outro carries a brand lockup. Preview any frame without a full render: `pnpm tsx scripts/preview-stills.ts <outDir> <episode>:s0,s1,12.5` (`s<i>` = middle of scene i, `e<i>` = 1.2 s in, or seconds).
- **Fonts** are fetched from Google Fonts at render time (network needed).
- **Meteor shower peaks** use IMO solar longitudes via astronomy-engine's apparent solar longitude; expect ±~half a day versus IMO's published times. Scripts say "around the peak".
- **Sky rendering** is stereographic with a stylised horizon; no atmospheric refraction or light pollution model.
- **Platform publishing** depends on each platform's app audit status (see `docs/publishing.md`).
