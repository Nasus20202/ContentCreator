# Series: Sky This Week

**id:** `sky-this-week` · **format:** vertical short, 40–55 s · **cadence:** weekly, published Wed/Thu for the following Mon–Sun · **research:** `cc research sky`

## Promise to the viewer

> "In under a minute: the 2–3 things actually worth stepping outside for this week — when, where to look, and one thing you didn't know about them."

Every claim is computed for a named location, every number is fact-checked, and nothing is shown that the viewer cannot actually see (no fake nebula glamour shots over a real-sky segment).

## Episode structure

| Beat         | Seconds  | Template                                     | Purpose                                                                             |
| ------------ | -------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Hook         | 0–5      | `skyView` (wide → zoom) + `title` overlay    | Lead with the single most striking event, as a promise ("two planets almost touch") |
| Main event   | 5–20     | `skyView` (zoom, labels, separation / chips) | When (day + time), where (direction + height), what it looks like                   |
| Insight      | 20–27    | `orbit3d` / `factCard` / `image`             | The "huh" moment: why it happens, true scale, real photo                            |
| Event 2 (+3) | 27–45    | `skyView`                                    | Secondary events, faster                                                            |
| Outro        | last 4–5 | `outro`                                      | Location disclaimer + follow CTA                                                    |

## Event selection (Claude decides, and logs why)

1. Start from `research.json`, highest `score` first, but **judge** — the score is a heuristic.
2. Must be visible to the naked eye (or say "binoculars") from the episode location, in darkness.
3. Prefer: conjunctions < 3°, meteor showers with a dark sky, bright planet + Moon pairings, eclipses (always lead), oppositions of Mars/Jupiter/Saturn.
4. Max 3 events. A short with one great event beats one with five mediocre ones.
5. Record the selection with `cc decision <id> --stage research …` including rejected candidates.

## Writing rules (in addition to docs/quality-bar.md)

- Say the day **and** the time window: "before dawn on Monday", "after 11 p.m.".
- Directions in plain words ("high in the south-east"), never azimuth numbers.
- Brightness in plain words ("the brightest point in that part of the sky"), never magnitudes.
- Meteor rates: always "around"/"up to", and never quote ZHR as what people will see under city skies.
- Solar events: the script **must** include eye-safety guidance.
- The outro footnote names the location the positions were computed for.

## Visual rules

- Sky scenes are computed for the episode's `time` and location — choose `time` as the moment you tell people to look.
- Never zoom tighter than ~5° fov without a scale reference (`separation` and/or `moonCompare`).
- Labels: max 3 on screen at once. Put left/right so they do not collide (check the review frames).
- Chips are for **when/where** facts the viewer must remember (max 48 chars).

## Hashtags baseline

`#astronomy #stargazing #nightsky #space` + 1–3 event-specific (e.g. `#leonids`, `#jupiter`).
