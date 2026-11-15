# TODO

Open chores and hand-offs that aren't recorded by the pipeline itself. **Agents: read this at the start of a
session and update it before you finish** (tick what you did, add what is now pending, with dates). Episode state
lives in the records (`pnpm -s cc status`); this file is for what a human or the next session must not forget.

## Needs the owner

- [ ] **Approve the Starship catch re-render (real Flight 15 footage) before Sun 15 Nov 17:00 UTC.** The Buffer post
      still points at the old photo version. Owner: watch `episodes/mission-control/2026-11-14-starship-catch/build/video.mp4`,
      then `pnpm -s cc approve mission-control-2026-11-14-starship-catch --by "<name>"`. Agent then:
      `pnpm -s cc publish reschedule mission-control-2026-11-14-starship-catch --replace-video`.
      (Its posts currently carry the approved photo version, re-hosted in the assets repo.)
- [ ] **ISS gravity re-render (music fixed): record QA and approve before Sun 22 Nov.** The QA verdict could not be
      recorded by Claude (permission classifier). Owner: `pnpm -s cc qa wrong-about-space-iss-gravity --review pass --actor human --notes "…"`,
      then `pnpm -s cc approve wrong-about-space-iss-gravity --by "<name>"`. Agent then:
      `pnpm -s cc publish reschedule wrong-about-space-iss-gravity --replace-video`.

## Publishing queue (Buffer: 10 scheduled posts per channel; keep the next 10 days filled)

- [ ] **Fill 25 Nov onward** as slots free up (one video a day, 17:00 UTC; weekday rotation in the series files).
      Sky This Week Nov 30 goes on **Fri 27 Nov**.
- [ ] **Approved, waiting for a slot:** Sky School Planet Ages, Proxima travel, Voyager light-day, Twin paradox, Light
      travel; Geminids radiant (Mon 7 Dec), Sky This Week Dec 14 (Fri 11 Dec), Sky Tonight Geminids (Sun 13 Dec
      15:00 UTC), Sky This Week Dec 21 (Fri 18 Dec), Sky This Week Jan 4 (Fri 1 Jan), Mars opposition (Mon 15 Feb).
- [ ] **Next production batch** (weekly): the week after 24 Nov. New episodes use `cc episode new --slug …`
      (`--date` only for date-bound content) and get the Tone.js beds automatically.

## Instagram

- [ ] **Try to claim `@thephotonsphere` once a week** (started 2026-11-14). The account is `@the.photonsphere` because
      the first account (`@thephotonsphere`) was banned with no appeal and its name is locked until Instagram deletes
      it. Each week: Instagram → Edit profile → Username → `thephotonsphere`. If accepted, update
      `docs/publishing.md` and record a `cc decision --channel`. Nothing in the pipeline depends on the handle. Give
      up around mid-May 2027.
      Log: 2026-11-14 taken.
- [ ] Add the profile links in the Instagram mobile app.

## Housekeeping

- [ ] **Flight 15 footage** is SpaceX's (standard YouTube licence), used by owner decision (see the episode's
      decisions). If a CC-licensed clip appears on Wikimedia Commons, prefer it for future Starship episodes.

## Done

- [x] 2026-11-15 Connect Instagram to Buffer (target live in `channel.config.json`, posting since 14 Nov).
- [x] 2026-11-15 Episodes grouped by series (`episodes/<series>/<slug>/`), renamed to the date-only-when-bound
      convention; the 8 scheduled posts for 16–24 Nov re-pointed at re-hosted (identical) videos.
- [x] 2026-11-15 Sky School / Sky This Week / Sky Tonight beds switched to the Tone.js + Kawai ports.
- [x] 2026-11-15 Hosted videos moved to `Nasus20202/ContentCreator-assets` (`<series>/<slug>-<sha8>.mp4`, `main`
      protected); all 30 scheduled posts for 15–24 Nov re-pointed with `--rehost` (same bytes, hash-checked).
- [x] 2026-11-15 Clean cover moment (first 0.6 s), `post.coverAt` → Buffer thumbnailOffset, cover frames in QA.
      Applies to new renders; already-approved videos keep their old 1.0 s cover.
- [x] 2026-11-15 All 24 videos from the old `videos` branch copied into the assets repo (`<series>/<slug>-<sha8>.mp4`,
      verified blob-for-blob); Buffer queried directly: 30 scheduled posts, none on the old URL. Old branch deleted
      on GitHub, reflogs expired and objects pruned (`.git` 381 MB → 2.8 MB).
