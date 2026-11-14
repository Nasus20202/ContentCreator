# TODO

Recurring and pending chores that aren't part of the episode pipeline.

## Instagram

- [ ] **Try to claim `@thephotonsphere` once a week** (started 2026-11-14). The account is currently `@the.photonsphere`
      because the first account (`@thephotonsphere`, created on the web) was banned with no appeal, and its name is
      locked until Instagram deletes it, which may never happen. Each week: Instagram → Edit profile → Username →
      `thephotonsphere`. If it's accepted, update `docs/publishing.md` and record a `cc decision --channel`. Nothing in
      the pipeline depends on the handle, because Buffer is tied to the account, not its name. Give up after about
      6 months (mid-May 2027).
      Log: 2026-11-14 taken.
- [ ] **Connect Instagram to Buffer** once the account (appeal accepted 2026-11-14; profile photo, name and bio set) has a few days
      of manual posts behind it: switch to a Professional account, then Buffer → Connect Channel → Instagram →
      Professional → "Connect to Instagram" (no Facebook Page needed). Then run `pnpm -s cc publish channels`, add an
      `instagram` target to `channel.config.json`, update `docs/publishing.md`, record a `cc decision --channel`, and
      run a `--dry-run` publish.
