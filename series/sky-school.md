# Series: Sky School

**id:** `sky-school` · **format:** vertical short, 45–60 s · **cadence:** 1–2 per month, in weeks with no event worth a sky guide · **research:** computed facts from `cc research sky` for the relevant event, or primary sources via `cc fact add`

## Promise to the viewer

> "One real sky question, answered with the actual geometry — in under a minute."

## Topics we accept

Only topics where the **computation is the payoff**, so the channel is more correct than a generic explainer:

- geometry we can draw from ephemerides (`orbit3d`, `skyView`): why an opposition is close, why a radiant exists, why a conjunction is not a collision;
- a number we can compute and show (`factCard`): how much the Moon's distance varies, how fast Earth moves through a meteor stream;
- real imagery with a computed overlay (`image`), never an artist's impression of a real object.

Reject topics that need a visual we cannot make truthfully (e.g. eclipse geometry in `orbit3d`, which draws planets only), and topics that are just trivia.

## Episode structure

| Beat   | Seconds  | Template                         | Purpose                                      |
| ------ | -------- | -------------------------------- | -------------------------------------------- |
| Hook   | 0–5      | `skyView` / `factCard` + `title` | The surprising, concrete claim               |
| Setup  | 5–15     | `skyView`                        | What the viewer actually sees                |
| Reveal | 15–35    | `orbit3d` / `factCard`           | Why it happens, from computed geometry       |
| Payoff | 35–50    | `factCard` / `image`             | The number or real image that makes it stick |
| Outro  | last 4–5 | `outro`                          | Location/credits footnote + follow ask       |

## Writing rules (in addition to docs/quality-bar.md)

- The hook is a statement, not a clickbait question ("Mars is about to become the brightest object after Jupiter", not "Guess what happens to Mars?").
- One idea per episode. If the explanation needs two "whys", split it.
- Every number is computed or sourced; never "scientists say".
- Say what the animation is (computed positions, not a photo) when it could be mistaken for one.

## Visual rules

- `orbit3d` only for bodies it actually renders (Mercury–Saturn, Earth); never fake the Moon or a not-to-scale orbit without saying so.
- No zoom tighter than ~5° fov without a scale reference.
- Labels: max 3 on screen; chips only for the one number worth remembering.

## Hashtags baseline

`#astronomy #space #science #nightsky` + 1–2 topic tags.
