# Data and explanation sources

Matchlight serves saved cases through its backend. It does not subscribe to a
live score feed. Reloading returns the same saved data and preserves its timestamp.
AI artwork is illustration, independent of the competition records.

## Real historical case

`paris-2024-diving-women-3m` is the completed Paris 2024 women's individual 3m
springboard final on 9 August 2024. The saved data includes all 12 finalists and
their five dives; the MVP presents three selected moments. CHEN Yiwen's final
total is 376.00, KEENEY Maddison's 343.10, and CHANG Yani's 318.75.

- [World Aquatics public event result endpoint](https://api.worldaquatics.com/fina/events/ef62ff76-092c-4d34-882d-e247cd6a0310)
- [World Aquatics regulations archived for 1 July 2024](https://resources.fina.org/fina/document/2024/07/23/44b81452-f720-471f-8d07-40e1387dd2fb/Competition-Regulations-version-1st-July-2024-_publishing_V3.pdf), Part Four 7.5 and 7.8

The original endpoint was retrieved on 14 October 2026. A reduced factual
snapshot is checked in as `lib/matches/paris-2024-diving.json`; fields not needed
by this prototype (photos, partner logos and identity metadata) are omitted.
The provider adapter in `lib/matches/history.ts` validates every single-dive
calculation and all running totals before exposing the case. All 60 dives agree
with the seven-judge formula.

`updatedAt` for this historical case is the endpoint's named
`EventResultUtcDateTime`, converted to `2024-08-09T13:00:23Z`. This is the
competition result timestamp, not a claim about when an HTTP response was last
published. The endpoint's `LastChange` was `0001-01-01T00:00:00` and is rejected as
invalid. The snapshot capture date is independently recorded in the source note.

The historical case is marked `historical` and `finished`. Its guidance invites
comparison between recorded dives, rather than inventing another round or a
future event. Judge awards explain the calculation; without judge comments or
video, no entry fault or precise deduction cause is asserted.

## Fictional demo cases

The other three cases (`demo-diving-3m`, `demo-swimming-100free`,
`demo-cricket-chase`) have fictional competitors, venues, dates and results.
Their `mode` is `demo`. An `in_progress` status describes the stage depicted in
the saved example; it does not mean that the event is happening now.

Their fixed `updatedAt` (`2026-10-14T09:56:09Z`) is the fixture authoring time.
It stays fixed across API calls. The cricket over allocation of 20 is a stated
scenario condition; it is not presented as a rule for every format of cricket.

Verified official rules as of 14 October 2026:

| Sport | Primary source | Used sections |
| --- | --- | --- |
| Diving | [World Aquatics February 2026 competition regulations](https://resources.fina.org/fina/document/2026/02/18/e6815ecc-06d9-4f0b-98e9-4c441cf5e6a3/2026-02-18_World-Aquatics_CR-Final.pdf) | Part Four 9.1.5.1, 9.1.5.5, 10.1.1 |
| Swimming | Same World Aquatics regulations | Part Two 11.1.2, 11.1.4–11.1.5 |
| Cricket | [MCC Laws, 2017 Code fourth edition (2026)](https://www.lords.org/getmedia/a4ef9f77-2a25-4f5b-a286-4601f08e6334/Laws-of-Cricket-2017-Code-4th-Edition-%282026%29_5.pdf) | Laws 1, 16–19, 32 |

Rules are paraphrased, and every rule points to an explicit `sourceId`.
The [World Aquatics regulations index](https://www.worldaquatics.com/rules/competition-regulations)
identifies the current and archived versions. The
[MCC laws index](https://www.lords.org/mcc/about-the-laws-of-cricket) identifies the
2026 edition, effective 1 October 2026.

## Explanation engine

The no-key engine in `lib/matches/explain.ts` returns bilingual explanations from
recorded facts and the rules above. It handles score calculations, standings,
rules, next-moment guidance, and evidence limits. Unsupported questions return
an explicit description of the supported queries. It does not forecast winners.

The contract's `mode: "grounded-demo"` identifies this deterministic engine.
Use `dataMode` (`demo` or `historical`) to label the underlying record. These are
separate concepts; a historical case is still historical when explained without
a language model. `GET /api/health` reports `aiConfigured: false` without a valid
key and explicit model. The integrated optional server-only model path adds a
labeled AI paraphrase without replacing these verified answers, calculations or
citations. Its external-provider behavior is tested with mocks; no actual key
is present and real model responses have not been evaluated.

`POST /api/explain` requires JSON, limits streamed bodies to 8 KiB, accepts only
the contract's fields, restricts questions to 400 characters, validates locale,
and rejects a moment belonging to a different match. API responses are marked
`Cache-Control: no-store`. Invalid data is not silently changed into a plausible
score.

## Verification

`tests/scoring.test.ts` checks exact seven-judge arithmetic, tied awards, bad
records, all 60 historical dives and totals, cricket legal-ball notation, and
swimming hundredths. `tests/backend.test.ts` checks API validation, errors,
source references, stable timestamps, both languages, historical provenance,
unsupported questions and cross-moment consistency. Tests can also run as
`node --import tsx --test tests/*.test.ts` when a sandbox disallows the tsx CLI's
local IPC pipe.

Before adding live coverage, implement provider access and license checks,
source timestamps, freshness/error states, and actual polling or subscription.
The saved public historical endpoint is evidence for a working adapter, not a
promise of LA28 live availability.
