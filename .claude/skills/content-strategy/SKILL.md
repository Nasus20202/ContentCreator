---
name: content-strategy
description: Analyse what the channel should make — review recorded metrics, research the market (niches, formats, platform policy, RPM), and decide on series, formats and cadence, logging every decision. Use for "what topics would get views?", "how are we doing?", "should we start a new series?", or monthly reviews.
---

# Content strategy review

Goal: decisions grounded in evidence, recorded so they can be audited later. Read `docs/content-strategy.md` first — it holds the current thesis, KPIs and open questions.

## 1. Gather evidence

- **Our numbers**: `docs/ledger.md` and each episode's `metrics.jsonl`. Compare by series, topic, hook type, length, posting day. Note sample sizes — with < 8 episodes, call conclusions provisional.
- **Market**: web search for current data (niche RPM/CPM, Shorts vs long-form earnings, platform policy changes on AI/"inauthentic" content, competitor formats, upcoming events with search demand — eclipses, missions, launches). Prefer primary sources and datasets over blog listicles; note dates.
- **Calendar**: upcoming sky/space events (run `cc research sky` on future weeks with a throwaway id if useful, or check event lists) — big events justify special episodes.

## 2. Evaluate options against the quality bar

For each candidate series/format score: viewer value (would someone act on/share it?), defensibility (can we be _more correct_ than competitors — data, computation, primary sources?), production fit (existing templates? sourced-facts workflow?), monetisation path (ads, sponsors, affiliates, long-form funnel), policy risk (repetitive/mass-produced? sensitive topics?).

## 3. Decide and record

- One `cc decision --channel --stage strategy …` per decision, with rationale, alternatives and `--inputs` listing URLs/files used.
- Update `docs/content-strategy.md` (thesis, KPIs, experiments, next review date). Keep a dated changelog section at the bottom.
- If a new series is chosen → `new-series` skill.

## Rules

- Do not chase a trend that requires inventing facts or AI imagery of real things.
- Prefer experiments with a stated hypothesis and a stop condition ("3 episodes; continue if avg view % > 60").
- Report to the user in plain language: what the data says, what you recommend, what you are unsure about.
