# TODO

Open chores and hand-offs that aren't recorded by the pipeline itself. **Agents: read this at the start of a
session and update it before you finish** (tick what you did, add what is now pending, with dates). Episode state
lives in the records (`pnpm -s cc status`); this file is for what a human or the next session must not forget.

## Needs the owner

_Nothing waiting on approval._

## Publishing queue (Buffer: 10 scheduled posts per channel; keep the next 10 days filled)

- Full from 27 Nov to 6 Dec on all three platforms, 17:00 UTC (state in the episode records). Planet Ages (27 Nov),
  Voyager light-day, Light travel and Proxima travel are the original approved renders (old long credit, cover taken at
  1.0 s).
- [ ] **Schedule Geminids radiant on Mon 7 Dec** once a slot frees up (after the 27 Nov post, 17:00 UTC).
- [ ] **Approved, waiting for the 10-day window:** Sky This Week Dec 14 (Fri 11 Dec), Sky Tonight Geminids (Sun 13 Dec
      15:00 UTC), Sky This Week Dec 21 (Fri 18 Dec), Sky This Week Jan 4 (Fri 1 Jan), Mars opposition (Mon 15 Feb).
      Their videos are in the assets repo (cloned at `../ContentCreator-assets`), except Mars opposition, which needs a
      re-render and new approval. Publish older renders with `--cover-at 1`.
- [ ] **Produce videos for 8 Dec onward** (weekday rotation in the series files). There is no Sky This Week for
      7–13 Dec (thin week, Light travel runs on 4 Dec instead).
- [ ] **Record metrics** for the posts that have gone out (`cc metrics add`).

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

- [x] 2026-11-26 Refilled the empty queue (twin paradox went out the same day), added a `--cover-at` option to the
      publish command, produced six new episodes, recorded the owner's approval and scheduled them.
- [x] 2026-11-15 Credit line shortened to the source only (CC licences kept), small, lower left above the captions;
      the 15–24 Nov queue re-rendered in parallel (clean covers too), QA'd, owner-approved and swapped into Buffer
      (30 posts, 0 differences, hosted files hash-checked). Loudness step now re-measures and retries on true-peak
      overshoot (Cosmic Top 5 had hit +0.1 dBFS).
- [x] 2026-11-15 Starship catch (footage version) and ISS gravity (music fixed) approved by the owner and swapped
      into their Buffer posts (15 and 22 Nov); Buffer re-checked: 30 posts, 0 differences. Fixed the media-cache
      upload (`mktree --missing`) that failed when a series folder already held videos the blobless cache lacks.
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
