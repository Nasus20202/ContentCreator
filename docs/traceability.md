# Traceability — what is recorded where

**Principle:** machine-readable records are append-only and committed; human-readable reports are generated from them (`pnpm cc report`). Nobody (human or Claude) edits records by hand.

## Per episode — `episodes/<id>/`

| File              | Written by               | Contents                                                                                                                                        |
| ----------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `episode.json`    | every stage              | Manifest: current stage, location, window, **input hashes** each stage signed off (plan, narration, video), approvals (who, when, video sha256) |
| `log.jsonl`       | every command            | Append-only event log: timestamp, actor (`pipeline` / `claude` / `human`), stage, action, details, git sha                                      |
| `decisions.jsonl` | `cc decision`            | Editorial decisions: what, why, alternatives considered, inputs used                                                                            |
| `research.json`   | `cc research sky`        | Detected events with scores and viewing geometry, engine version                                                                                |
| `facts.json`      | research / `cc fact add` | Every citable fact: statement, values, source (computed method+inputs, or URL+title+publisher+access date)                                      |
| `plan.json`       | Claude                   | Script, scenes, camera, labels, post copy. Input, not a record — editing it invalidates later stages (hash check)                               |
| `factcheck.json`  | `cc factcheck`           | Each number → backing fact, problems, and the recorded semantic review                                                                          |
| `timeline.json`   | `cc voice`               | TTS engine/voice, per-sentence and per-word timings, narration hash                                                                             |
| `assets.json`     | `cc asset add`           | Image provenance: source URL/page, credit, license, sha256, AI flag                                                                             |
| `render.json`     | `cc render`              | Video sha256, plan + timeline hashes it was rendered from, duration, render time, Remotion version                                              |
| `qa.json`         | `cc qa`                  | Automated checks, extracted frames, recorded visual review                                                                                      |
| `publish.json`    | `cc publish`             | Every attempt: mode, schedule, dry-run flag, Postiz base URL, media id, per-platform status, Postiz post id, error, **full payload**            |
| `metrics.jsonl`   | `cc metrics add`         | Performance snapshots per platform with source                                                                                                  |
| `README.md`       | `cc report`              | Generated audit report of all the above                                                                                                         |
| `build/`          | render stages            | Large artefacts (wav, mp4, frames). **Not committed**; reproducible, and the video is pinned by sha256                                          |

## Channel level — `docs/`

| File                                                | Contents                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `decisions/decisions.jsonl` → `decisions/README.md` | Strategy and policy decisions (`cc decision --channel`)                      |
| `ledger.md`                                         | Generated index of all episodes: stage, title, where published, latest views |
| `content-strategy.md`                               | Current thesis, KPIs, experiments, changelog                                 |

## Integrity guarantees

- **Stale-output protection:** each stage stores the hash of its inputs; later stages refuse to run if the plan or narration changed (`plan.json changed after it was validated`, `Narration changed since the voice was generated`, …).
- **Approval pinning:** approval stores the video sha256; publishing refuses a video that differs from the approved one.
- **Actors:** reviews require `--actor claude|human`; approval requires `human` unless `autoApprove` is explicitly enabled in `channel.config.json`.
- **Regressions are visible:** moving an episode back a stage is logged as `stage.regress`.
- **Git:** every log line carries the commit sha the pipeline ran on; commit records after each session.
