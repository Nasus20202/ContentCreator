---
name: fact-check
description: Semantic fact-check of an episode plan after the automated `cc factcheck` passes — verify meaning (dates, directions, times of day, wording precision), not just numbers, then record the review. Use whenever an episode reaches the factcheck step.
---

# Semantic fact-check

The automated check proves every **number** maps to a fact. It cannot tell "south-east" from "south-west", "before dawn" from "after sunset", or "peaks on the night of" from "peaks during the day". You do that.

## Procedure

1. `pnpm -s cc factcheck <id>` must print `automated fact-check passed`.
2. For **every sentence, chip, label, overlay and the post copy**, open the cited facts (`cc fact list <id> --grep …`) and verify:
   - **Date & weekday** match the fact, in the episode's local time zone.
   - **Time of day** wording ("before dawn", "after dark", "after midnight") is consistent with the fact's local time and the Sun being down.
   - **Direction & height** match `viewing.direction` / altitude ("high" ≳ 40°, "low" ≲ 15°).
   - **Precision**: rounding is honest ("just over one degree" for 1.19°; never "one degree" for 1.6°). Rates stated as "up to"/"around" when they are ideal-condition figures (ZHR).
   - **Comparatives** ("brightest", "four times farther") are backed by the numbers.
   - **Visual claims** in the scene params (`time`, bodies shown) match what the narration says to look at.
   - Sourced (url) facts: re-open the URL if anything is surprising; the fact must say what you claim.
3. If anything is wrong or overstated: fix `plan.json`, re-run `cc plan` and `cc factcheck`, and record why with `cc decision <id> --stage factcheck …`.
4. Record the review — notes must list what you actually verified:
   `pnpm -s cc factcheck <id> --review pass --actor claude --notes "…"`
   Use `--review fail` (with notes) if you stop without fixing.
