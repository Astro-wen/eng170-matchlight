# MVP scope

## Primary user and target

A casual fan or tourist sees a confusing score or key moment during a sporting
event. They want a short explanation and to return to enjoying the match.
This targets steps 3–5 of Team 4's agreed customer journey.

## Three solution states

1. **Find the match:** identify the event and choose the moment that is confusing.
2. **Understand it:** plain-language explanation, underlying score calculation,
   rule references, and language choice.
3. **Follow along:** current rankings and a relevant viewing prompt.

## Definition of done

- Core flows work on desktop and phone widths.
- API returns match summaries, details, and validated explanations.
- Recorded diving score matches the seven-judge calculation.
- Data mode and source references remain visible and truthful.
- Failure states offer recovery and stale requests do not overwrite a new match.
- English and Chinese explanations are usable.
- Optional model failures leave the core experience usable.
- Main branch builds and the private prototype can be opened.

## Next feature branches

| Proposed branch | Result to validate |
| --- | --- |
| `feat/world-aquatics-provider` | Read fresh upstream historical results through an adapter with schema checks and caching |
| `feat/live-match-sync` | A licensed live source, latency measurement and viewer-time alignment |
| `feat/ai-evaluation` | Real model credentials and a held-out set of grounded sports questions |
| `feat/user-testing` | Test with casual fans; measure understanding and time away from the match |
| `feat/gymnastics-athletics` | Source-aware detailed coverage for remaining Team 4 sports |

LA28 coverage, commercial rights, real-time latency and judge-specific deduction
reasons remain unverified. The historical snapshot demonstrates data shape and
the explanation experience without making these claims.
