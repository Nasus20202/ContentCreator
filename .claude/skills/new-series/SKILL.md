---
name: new-series
description: Add a new series (e.g. science news, space missions explained) or a new scene template to the pipeline. Use when strategy calls for a format the current series/templates don't cover.
---

# Add a series or template

## New series (no code needed if existing templates fit)

1. Create `series/<id>.md` modelled on `series/sky-this-week.md`: promise to the viewer, beat structure with templates, selection rules, writing rules, visual rules, hashtags.
2. Research path:
   - **Computed** (like the sky): add a generator in `src/planning/<domain>/` that returns `{ events, facts }`, a `cc research <domain>` command, and tests with a known date.
   - **Sourced** (news/science): research on the web; add every claim with `cc fact add <id> --url … --title … --publisher … --statement … --values …`. Primary sources only (agency/paper/press release), not aggregators. Images via `cc asset search` / `cc asset add` (NASA library; credits are recorded and shown).
3. Episodes without a location/window: `cc episode new --series <id> --id <series>-<yyyy-mm-dd>-<slug>`.
4. Record the decision: `cc decision --channel --stage strategy …`.

## New scene template

1. Schema: add `XParams` and a union member in `src/core/schemas.ts` (`Scene` discriminated union).
2. Validation: cross-reference checks in `src/planning/validate-plan.ts`; texts the viewer sees in `sceneTexts()` (`src/planning/factcheck/factcheck.ts`) so they are fact-checked.
3. Render data (if it needs computation): build it in `src/render/prepare.ts` into `RenderProps`.
4. Component: `video/scenes/XScene.tsx`, use `useSceneTime()` for TimeRefs; register in `video/Episode.tsx` `Template`.
5. Document params in `docs/plan-format.md`; add tests; `pnpm check`.
