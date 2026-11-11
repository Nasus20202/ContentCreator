# Content strategy

Living document, owned by the `content-strategy` skill. Decisions themselves are logged in `docs/decisions/` — this file holds the current thesis and how we'll know if it's wrong.

## Current thesis (2026-11-11)

**Series #1: Sky This Week** — a weekly, location-specific, _computed_ guide to what's worth seeing in the night sky, as a 40–55 s vertical video on YouTube Shorts, TikTok, Instagram Reels and Facebook.

Why this and not "space facts":

1. **Defensible quality.** Positions, times and separations are computed (astronomy-engine) for a named location and fact-checked; the generic space-shorts niche is saturated with unsourced, AI-imagery content that can't compete on correctness.
2. **Natural novelty.** The sky changes every week, so episodes differ in substance — the opposite of the repetitive, templated content YouTube's July 2026 clarification of its _inauthentic content_ policy targets ([Tubefilter](https://www.tubefilter.com/2026/07/13/youtube-inauthentic-content-monetization-policy-update/), [Metricool](https://metricool.com/youtube-ai-content-rules-monetization/)). That clarification evaluates channels holistically and does not ban AI-assisted production with original input.
3. **Monetisation beyond Shorts ads.** Shorts RPM is low in every niche; estimates for education Shorts range roughly $0.04–1.44 per 1,000 views and are not measured for space specifically ([AIR 274-channel analysis](https://air.io/air-data-findings/what-is-youtube-shorts-rpm-in-your-niche-in-2026)). Long-form Education & Science has the highest median RPM (~$10) in AIR's 300-channel dataset ([AIR](https://air.io/en/air-data-findings/which-youtube-niche-makes-the-most-money-in-2026-ranked-by-real-rpm-and-cpm)). Weekly sky guides attract sponsors — Astronomy.com's "The Sky This Week" is Celestron-sponsored ([Astronomy.com](https://www.astronomy.com/tags/sky-this-week/)). So: Shorts as the audience funnel; revenue from long-form compilations, sponsors and gear affiliates later.
4. **Calendar tailwinds.** Big, searchable events (e.g. the total solar eclipse of 2 Aug 2027 across Spain/North Africa) give the channel natural peaks if it is established beforehand.

## KPIs and decision rules

| Metric                            | Source             | Target after 8 episodes | If missed                                |
| --------------------------------- | ------------------ | ----------------------- | ---------------------------------------- |
| Average view % (Shorts)           | YouTube Studio     | ≥ 65 %                  | Tighten hook/length; test 35 s cut       |
| Views per episode (all platforms) | `metrics.jsonl`    | growing week over week  | Test posting day/time, regional variants |
| Follows per 1k views              | platform analytics | ≥ 3                     | Strengthen "next week" promise           |
| Corrections needed after publish  | episode records    | 0                       | Review fact-check procedure              |

Review cadence: after every 4 published episodes (`content-strategy` skill), and immediately if a correction is needed.

## Experiments backlog

1. **Regional variants** of the same week (`us-east`, `uk`) — same events, localised times; hypothesis: doubles reach at near-zero marginal cost. Stop if variants cannibalise (views/variant < 40 % of main).
2. **"Tonight" event shorts** on high-score nights (conjunctions < 1°, eclipses, meteor peaks with a dark sky) published the day before.
3. **Second series candidate: "Space, verified"** — weekly science/space news in 45 s, sourced facts only (agency/paper/press release), NASA/ESA imagery with credits. Needs the sourced-facts workflow exercised end to end first.
4. **Long-form monthly compilation** (8–10 min, reuse scenes) to test long-form RPM.

## Open questions

- Which platform responds best to this format? (no data yet)
- Does a human voice outperform Kokoro meaningfully? (A/B once baseline exists)
- Is Polish-language output worth a separate channel? (low competition, lower RPM)

## Changelog

- 2026-11-11 — Initial thesis, KPIs, experiments (Claude; see channel decisions of the same date).
