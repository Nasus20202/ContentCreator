# Quality bar — what keeps this from being AI slop

Every episode must pass all of these. They are enforced partly by code (✅ automated) and partly by Claude's recorded reviews (👀 reviewed).

## Truth

- ✅ Every number spoken, shown on screen, or in the post copy is backed by a fact in `facts.json` (`cc factcheck`).
- 👀 Every qualitative claim (direction, time of day, "brightest", "closest") is verified against facts (`fact-check` skill) and the review is recorded.
- ✅ Facts are either **computed** (method + inputs recorded) or **sourced** (URL, title, publisher, access date). No third category.
- 👀 Uncertainty is stated honestly: "around", "up to", "under a dark sky". Ideal-condition figures (meteor ZHR) are never presented as typical.
- 👀 Viewer safety: any solar event includes eye-safety guidance.

## Usefulness

- 👀 The viewer can act on it: concrete day, time window, direction and height in plain words, naked-eye vs binoculars.
- 👀 One genuine insight per episode (why / true scale / real photo / meaningful number) — not decoration.
- 👀 Location the data was computed for is stated (voice-over or footnote).

## Craft

- ✅ ≤ 60 s, 1080×1920, H.264/AAC, integrated loudness ≈ -14 LUFS, true peak ≤ -0.5 dBFS, no black gaps (`cc qa`).
- 👀 First sentence lands the promise in ≤ ~3 s. No clickbait questions, fake urgency, or "you won't believe".
- 👀 Captions readable and inside the platform safe zone; no overlapping labels/chips; nothing cut off (`qa-review` skill on every frame).
- 👀 Visuals depict what is real: computed sky for the stated time and place, real imagery with credits. No AI images of real objects (policy decision, see `docs/decisions/`).

## Honesty to platforms and viewers

- Synthetic narration is disclosed (description line + TikTok `video_made_with_ai`).
- Episodes vary because the sky/news varies — never re-upload templated near-duplicates to fill a schedule. If a week has nothing worth watching, make a different format (explainer) or skip; record the decision.

## Process

- 👀 A human approves the exact rendered file (sha256-pinned) before publishing.
- Every decision, review and publish attempt is in the episode's records; see `docs/traceability.md`.
