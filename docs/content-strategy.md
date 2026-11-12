# Content strategy

Living document, owned by the `content-strategy` skill. Decisions themselves are logged in `docs/decisions/` — this file holds the current thesis and how we'll know if it's wrong.

## Current thesis (2026-11-11)

**Series #1: Sky This Week** — a weekly, location-specific, _computed_ guide to what's worth seeing in the night sky, as a 40–55 s vertical video on YouTube Shorts, TikTok, Instagram Reels and Facebook.

Why this and not "space facts":

1. **Defensible quality.** Positions, times and separations are computed (astronomy-engine) for a named location and fact-checked; the generic space-shorts niche is saturated with unsourced, AI-imagery content that can't compete on correctness.
2. **Natural novelty.** The sky changes every week, so episodes differ in substance — the opposite of the repetitive, templated content YouTube's July 2026 clarification of its _inauthentic content_ policy targets ([Tubefilter](https://www.tubefilter.com/2026/07/13/youtube-inauthentic-content-monetization-policy-update/), [Metricool](https://metricool.com/youtube-ai-content-rules-monetization/)). That clarification evaluates channels holistically and does not ban AI-assisted production with original input.
3. **Monetisation beyond Shorts ads.** Shorts RPM is low in every niche; estimates for education Shorts range roughly $0.04–1.44 per 1,000 views and are not measured for space specifically ([AIR 274-channel analysis](https://air.io/air-data-findings/what-is-youtube-shorts-rpm-in-your-niche-in-2026)). Long-form Education & Science has the highest median RPM (~$10) in AIR's 300-channel dataset ([AIR](https://air.io/en/air-data-findings/which-youtube-niche-makes-the-most-money-in-2026-ranked-by-real-rpm-and-cpm)). Weekly sky guides attract sponsors — Astronomy.com's "The Sky This Week" is Celestron-sponsored ([Astronomy.com](https://www.astronomy.com/tags/sky-this-week/)). So: Shorts as the audience funnel; revenue from long-form compilations, sponsors and gear affiliates later.
4. **Calendar tailwinds.** Big, searchable events (e.g. the total solar eclipse of 2 Aug 2027 across Spain/North Africa) give the channel natural peaks if it is established beforehand.

## Calendar reality (scan of 2026-11-12)

What the event engine actually finds for `eu-central` (score ≥ 40, moon phases and planet-visibility noise removed). "Nothing" weeks are the important part:

| Window       | What there is to stand an episode on                                                            | Plan                                                 |
| ------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Nov 16–22    | Mars–Jupiter 1.2° (84), Leonids (41)                                                            | episode 1 (scheduled)                                |
| Nov 23–29    | **nothing**                                                                                     | skip the weekly, or run an evergreen explainer       |
| Nov 30–Dec 6 | Moon–Jupiter 1.9° (56), Moon–Mars 3.7° (49)                                                     | weekly, only if episode 1 performed                  |
| Dec 7–13     | **Geminids (85, dark: new Moon 9 Dec)**                                                         | special, publish Thu 10 Dec + "tonight" short 13 Dec |
| Dec 21–27    | **full Moon 24 Dec, 356,729 km — closest of 2026, 7.8 % wider than mean, 65° high at midnight** | special, publish 22–23 Dec                           |
| Dec 28–Jan 3 | **Quadrantids (63, near-new Moon), peak night 3–4 Jan**                                         | special, publish 31 Dec                              |
| Jan 4–Feb 7  | Moon–planet passes only                                                                         | every other week + explainers in the gaps            |
| Feb 8–21     | Jupiter opposition (60), Mars opposition (80), penumbral lunar eclipse (75)                     | "planet month" episode; say the penumbral is subtle  |
| Mar–Jul 2027 | **only Moon–planet passes**                                                                     | do not force a weekly; Sky School / eclipse build-up |
| Aug 2 2027   | partial solar eclipse, 41.6 % in central Europe (95); total in Spain/Egypt                      | biggest search event of the next 12 months           |

Two engine notes from the same scan:

- `meteorShowers()` calls `SearchSunLongitude(…, 9)`, which searches only 9 days ahead. Fine for a 7-day episode, but a 30-day window (e.g. a month-ahead long-form) **misses** the Geminids and Perseids. Loop 7-day windows or pass the window length before relying on long research windows.
- The heuristic scores every penumbral lunar eclipse 75. Penumbral eclipses are barely visible; judge the score, never publish it.

## KPIs and decision rules

| Metric                            | Source             | Target after 8 episodes | If missed                                |
| --------------------------------- | ------------------ | ----------------------- | ---------------------------------------- |
| Average view % (Shorts)           | YouTube Studio     | ≥ 65 %                  | Tighten hook/length; test 35 s cut       |
| Views per episode (all platforms) | `metrics.jsonl`    | growing week over week  | Test posting day/time, regional variants |
| Follows per 1k views              | platform analytics | ≥ 3                     | Strengthen "next week" promise           |
| Corrections needed after publish  | episode records    | 0                       | Review fact-check procedure              |

Review cadence: after every 4 published episodes (`content-strategy` skill), and immediately if a correction is needed.

## Experiments backlog (ranked, 2026-11-12)

1. **Event specials inside Sky This Week** — Geminids (publish 10 Dec), Christmas Eve full Moon (22 Dec), Quadrantids (31 Dec), February planet week. Hypothesis: a named, dated event beats a themed week on views and shares. Stop after 3 if views < 1.5× the median weekly episode.
2. **Sky School — evergreen explainers** built from `orbit3d` + `factCard` (50–60 s): "why eclipses are rare", "why the Moon's distance changes", "how many meteors you'll really see from a city". Hypothesis: search demand accumulates after the first 48 h and fills the Mar–Jul 2027 desert. Stop after 3 if 30-day views < median weekly or average view % < 50 %.
3. **"Tonight" reminder short** (20 s, one event, published the day before): test with the Geminids on 13 Dec. Hypothesis: date-urgent posts lift follows per 1k views. Stop if it cannibalises the special.
4. **Regional variants** — `us-east` first, 3 weeks, same events with local times. Hypothesis: doubles reach at near-zero marginal cost. Stop if variant views < 40 % of the main episode.
5. **Long-form "month ahead"** (8–12 min, 16:9): December pilot (Geminids + Christmas Moon + Quadrantids + January preview). Needs a 16:9 composition and scene layouts — the renderer is 1080×1920 only today, so this is a code project, not a reuse. Hypothesis: long-form RPM ≥ 5× Shorts. Stop if retention < 30 % or RPM < $3.
6. **Eclipse 2027 track** — monthly from May 2027: what central Europe sees (41.6 % partial), where totality is (Spain, Egypt), eye safety, real eclipse imagery with credits. Biggest calendar peak; too early to start now.
7. **"Space, verified" news** — deferred until the sourced-facts workflow has run end to end; speed-sensitive and competes with established space media on their strongest ground.
8. **Polish-language channel** — blocked: Kokoro ships en/es/fr/hi/it/ja/pt/zh voices, so this needs a different TTS engine or a human voice, plus a second review loop.

## Open questions

- Which platform responds best to this format? (no data yet)
- Does a human voice outperform Kokoro meaningfully? (A/B once baseline exists)
- Do named-event specials generalise, or is only a meteor shower strong enough to carry one?
- Does the "closest full Moon of the year" angle outperform event angles (conjunctions, parallax)?

## Changelog

- 2026-11-11 — Initial thesis, KPIs, experiments (Claude; see channel decisions of the same date).
- 2026-11-12 — Calendar scan of Nov 2026–Sep 2027: weekly cadence has holes (Nov 23, most of Mar–Jul 2027) and three peaks (Geminids, Christmas Moon, February planet week). Ranked the experiments backlog, added Sky School and the long-form pilot, noted two engine limits. No new series yet.
