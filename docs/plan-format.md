# plan.json reference

Authoritative definition: `Plan` in `src/core/schemas.ts`. Worked example: `episodes/sky-this-week-2026-11-16-eu-central/plan.json`.

```jsonc
{
  "episodeId": "sky-this-week-2026-11-16-eu-central",  // must equal the folder name
  "series": "sky-this-week",
  "title": "internal working title",
  "badge": "Sky this week · Nov 16–22",                 // pill at the top after the first scene (≤ 40)
  "location": { … },                                    // copy from episode.json for sky series
  "voice": { "id": "af_heart", "speed": 1.05 },         // Kokoro voice id
  "music": { "enabled": true, "volume": 0.15, "style": "ambient" },
  "scenes": [ /* ≥ 2, last should be an outro */ ],
  "post": { "title": "≤ 90 chars", "description": "…", "hashtags": ["#astronomy"] }
}
```

## Common scene fields

| Field       | Meaning                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `id`        | unique, kebab-case                                                                                |
| `template`  | `skyView` · `orbit3d` · `factCard` · `scale` · `compare` · `journey` · `laps` · `image` · `outro` |
| `narration` | array of sentences (the timing unit)                                                              |
| `factIds`   | facts backing **every** claim in narration + on-screen text of this scene                         |
| `chips`     | `[{ text ≤ 48, from, to? }]` accent-coloured info pills under the badge                           |
| `title`     | `{ kicker, title, from, to? }` large centred overlay (hook)                                       |
| `captions`  | default `true`                                                                                    |

**TimeRef** (`from`, `to`, `at`, …): seconds from scene start, or `{ "sentence": 1, "edge": "start" | "end", "offset": -0.4 }`.

**Chips share one row.** Every chip in a scene draws at the same height, so two visible at once overlap and the text garbles. Sequence them: give every chip except the last an explicit `to`, and start the next chip at or after it. `cc plan` rejects a non-final chip without `to`; `cc render` resolves the windows against the narration and fails with the two texts and times if they still collide.

## `skyView` — the computed night sky

| Param                | Meaning                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `time`               | UTC instant drawn (the moment you tell people to look)                                                                                                                                                 |
| `bodies`             | `Mercury` … `Neptune`, `Moon` to compute and draw                                                                                                                                                      |
| `radiant`            | `{ ra, dec }` J2000 degrees, for meteor showers                                                                                                                                                        |
| `camera`             | keyframes `[{ at, target, fov, dAz?, dAlt? }]`; target = `{ body }` · `{ midpoint: [a, b] }` · `{ azAlt: [az, alt] }` · `{ radiant: true }`; fov = horizontal degrees (zoom interpolates in log space) |
| `labels`             | `[{ body, text, sub?, side: left/right, from, to? }]`                                                                                                                                                  |
| `starLabels`         | `[{ name, from }]` — names from `NAMED_STARS` in `src/planning/astro/snapshot.ts`                                                                                                                      |
| `separation`         | `{ a, b, text, from, to? }` bracket with angle text                                                                                                                                                    |
| `moonCompare`        | `{ a, b, count, from, to? }` dashed full-Moon discs for scale                                                                                                                                          |
| `constellation`      | `{ id, label, from }` highlight lines (`Leo`, `Ori`, … d3-celestial ids)                                                                                                                               |
| `meteors`            | `{ perSecond, from, to? }` streaks from the radiant                                                                                                                                                    |
| `twilight`           | 0–1 glow toward the Sun's azimuth                                                                                                                                                                      |
| `constellationLines` | 0–1 base opacity of all constellation lines                                                                                                                                                            |

## `orbit3d` — why things line up (three.js)

`{ time, bodies: ["Earth", …], lineOfSight?: { to, through? }, revealAt, distancesAt? }` — opens on Earth's viewpoint along the line of sight, swings to a top-down view at `revealAt`, shows computed distances from `distancesAt`.

## `factCard`

`{ value ≤ 16 chars, label ≤ 60, sourceLine? ≤ 80 }` — one big number. Must be backed by the scene's facts.

## `scale`

`{ total, totalLabel ≤ 40, markers: [{ at, label ≤ 40 }] (1–4) }` — a vertical distance bar from 0 to `total`, with markers placed linearly. Every marker label and the far-end label must be backed by a fact.

## `compare`

`{ heading? ≤ 50, scale: "linear" | "log", bars: [{ label ≤ 40, value ≥ 1, display ≤ 20 }] (2–3), note? ≤ 80 }` — horizontal bars in one unit. `value` sets the length; `display` is the printed number. Each bar's display and label must be backed by a fact. Prefer `linear` even when values differ by orders of magnitude: the short bar becomes a glowing sliver, which is usually the point. Use `log` only when the small values must be compared with each other, and say so in `note`.

## `journey` — a trip with clocks

`{ traveller: "light" | "ship", stops: [{ name ≤ 30, at, kind, sub? ≤ 30, arrive? ≤ 24 }] (2–4), path: [stop indices] (2–4), start: TimeRef, travel: seconds, clocks: [{ label ≤ 20, from, to, unit: "min" | "s" | "years" }] (0–2) }` — stops are drawn to scale along a vertical track (`at` in one unit; kinds: sun, earth, mars, jupiter, star, blackhole, galaxy, point). The traveller follows `path` (e.g. `[0, 1, 0]` there and back): light at constant speed, a ship accelerating and braking. Clocks count from `from` to `to` while it travels and are printed by `src/core/clock.ts` (8.3333 min → "8 min 20 s", 5000000 years → "5 million yrs"). Stop names/subs/arrival badges and the clocks' end readings (and non-zero start readings) are fact-checked; readings in between are animation. No chips (the clocks use that space).

## `laps` — circling a body

`{ body: "earth" | "moon", assetId?, disc: { size, cx, cy }, laps, label ≤ 40, note? ≤ 50, start: TimeRef, over: seconds }` — something circling the body in slow motion with a counter up to `laps` (e.g. light: 7.5 times around Earth every second). With `assetId`, the body is a real photo cropped to its disc (`disc` = disc diameter as a fraction of the image width and its centre) and the credit is printed. Say it is slowed down in `note`.

## `image` — real imagery

`{ assetId, zoom: [from, to], focus: [x, y] }` — asset added with `cc asset add`; credit line rendered automatically.

## `outro`

`{ kicker, cta (newlines allowed), footnote?, sky?: { time, bodies, camera } }`.
