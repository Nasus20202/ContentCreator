# CLI reference

> Generated from `pnpm cc --help`. Run any command with `--help` for details.

```text
Usage: cc [options] [command]

ContentCreator pipeline — operated from Claude Code

Options:
  -h, --help                     display help for command

Commands:
  status [episode]               list episodes, or show one episode with its
                                 next step
  episode                        create episodes
  research                       deterministic research generators
  fact                           manage facts (claims must cite a fact)
  asset                          real imagery with recorded provenance
  plan [options] <episode>       validate plan.json (schema + cross-references)
                                 and register it
  factcheck [options] <episode>  check every number against the facts; with
                                 --review, record the semantic review
  voice [options] <episode>      synthesise narration locally with Kokoro →
                                 build/voice/*.wav + timeline.json
  render [options] <episode>     render build/video.mp4 with Remotion (CPU) and
                                 normalise loudness
  qa [options] <episode>         automated technical QA + review frames; with
                                 --review, record the visual review
  approve [options] <episode>    human sign-off on the exact rendered video
                                 (sha256-pinned)
  publish                        publish via Buffer (videos hosted as public
                                 GitHub release assets)
  decision [options] [episode]   record a decision with its rationale
                                 (append-only)
  metrics
  report [episode]               regenerate episode README(s), docs/ledger.md
                                 and docs/decisions/README.md
  validate                       check all committed records parse, agree with
                                 each other, and reports are up to date (CI)
  show [options] <episode>       print research events / plan summary / timeline
                                 for quick inspection
  help [command]                 display help for command
```

## cc episode new

```text
Usage: cc episode new [options]

Options:
  --series <series>  series id (series/<id>.md)
  --week <date>      first day (YYYY-MM-DD) of a 7-day window, for time-boxed
                     series
  --location <id>    location preset id from channel.config.json
  --id <id>          explicit episode id
  --actor <actor>    who performs this step (choices: "pipeline", "claude",
                     "human", default: "pipeline")
  -h, --help         display help for command
```

## cc research sky

```text
Usage: cc research sky [options] <episode>

detect sky events in the episode window → research.json + facts.json

Options:
  --actor <actor>  who performs this step (choices: "pipeline", "claude",
                   "human", default: "pipeline")
  -h, --help       display help for command
```

## cc fact add

```text
Usage: cc fact add [options] <episode>

Options:
  --id <id>
  --statement <text>
  --url <url>
  --title <title>     source page title
  --publisher <name>
  --values <list>     comma-separated numbers the narration may quote (default:
                      "")
  --actor <actor>     who performs this step (choices: "pipeline", "claude",
                      "human", default: "claude")
  -h, --help          display help for command
```

## cc asset search

```text
Usage: cc asset search [options] <query...>

search the NASA Image and Video Library

Options:
  --limit <n>  max results (default: "10")
  -h, --help   display help for command
```

## cc asset add

```text
Usage: cc asset add [options] <episode>

Options:
  --nasa-id <id>
  --id <assetId>   id the plan will reference
  --actor <actor>  who performs this step (choices: "pipeline", "claude",
                   "human", default: "claude")
  -h, --help       display help for command
```

## cc plan

```text
Usage: cc plan [options] <episode>

validate plan.json (schema + cross-references) and register it

Options:
  --actor <actor>  who performs this step (choices: "pipeline", "claude",
                   "human", default: "claude")
  -h, --help       display help for command
```

## cc factcheck

```text
Usage: cc factcheck [options] <episode>

check every number against the facts; with --review, record the semantic review

Options:
  --review <verdict>  record a semantic review (choices: "pass", "fail")
  --notes <text>      review notes (required with --review)
  --actor <actor>     who performs this step (choices: "pipeline", "claude",
                      "human", default: "pipeline")
  -h, --help          display help for command
```

## cc voice

```text
Usage: cc voice [options] <episode>

synthesise narration locally with Kokoro → build/voice/*.wav + timeline.json

Options:
  --actor <actor>  who performs this step (choices: "pipeline", "claude",
                   "human", default: "pipeline")
  -h, --help       display help for command
```

## cc render

```text
Usage: cc render [options] <episode>

render build/video.mp4 with Remotion (CPU) and normalise loudness

Options:
  --actor <actor>  who performs this step (choices: "pipeline", "claude",
                   "human", default: "pipeline")
  -h, --help       display help for command
```

## cc qa

```text
Usage: cc qa [options] <episode>

automated technical QA + review frames; with --review, record the visual review

Options:
  --review <verdict>  record the visual review (choices: "pass", "fail")
  --notes <text>
  --actor <actor>     who performs this step (choices: "pipeline", "claude",
                      "human", default: "pipeline")
  -h, --help          display help for command
```

## cc approve

```text
Usage: cc approve [options] <episode>

human sign-off on the exact rendered video (sha256-pinned)

Options:
  --by <name>      who approved
  --note <text>
  --actor <actor>  who performs this step (choices: "pipeline", "claude",
                   "human", default: "human")
  -h, --help       display help for command
```

## cc publish episode

```text
Usage: cc publish episode [options] <episode>

Options:
  --mode <mode>       (choices: "now", "schedule", "draft")
  --at <iso>          schedule time (ISO 8601, with --mode schedule)
  --platforms <list>  subset, e.g. youtube,tiktok
  --dry-run           build and record payloads without uploading or calling
                      Buffer
  --actor <actor>     who performs this step (choices: "pipeline", "claude",
                      "human", default: "pipeline")
  -h, --help          display help for command
```

## cc publish channels

```text
Usage: cc publish channels [options]

list Buffer channels (to fill channel.config.json → publishing.targets)

Options:
  -h, --help  display help for command
```

## cc decision

```text
Usage: cc decision [options] [episode]

record a decision with its rationale (append-only)

Arguments:
  episode                episode id (omit with --channel)

Options:
  --channel              channel-level decision (strategy, series, policy)
  --stage <stage>        e.g. strategy, research, plan, script, visuals, publish
  --decision <text>
  --rationale <text>
  --alternatives <list>  pipe-separated alternatives considered (default: "")
  --inputs <list>        pipe-separated files/urls/event ids that informed it
                         (default: "")
  --actor <actor>        who performs this step (choices: "pipeline", "claude",
                         "human", default: "claude")
  -h, --help             display help for command
```

## cc metrics add

```text
Usage: cc metrics add [options] <episode>

record a performance snapshot (feeds the strategy review)

Options:
  --platform <p>      (choices: "youtube", "tiktok", "instagram", "facebook")
  --views <n>
  --likes <n>
  --comments <n>
  --shares <n>
  --avg-view-pct <n>
  --followers <n>
  --url <url>
  --source <text>     where the numbers came from (default: "manual (platform
                      analytics)")
  --actor <actor>     who performs this step (choices: "pipeline", "claude",
                      "human", default: "human")
  -h, --help          display help for command
```

## cc report

```text
Usage: cc report [options] [episode]

regenerate episode README(s), docs/ledger.md and docs/decisions/README.md

Options:
  -h, --help  display help for command
```

## cc validate

```text
Usage: cc validate [options]

check all committed records parse, agree with each other, and reports are up to
date (CI)

Options:
  -h, --help  display help for command
```
