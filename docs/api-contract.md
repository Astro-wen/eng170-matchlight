# MVP API contract

Shared model: `lib/match-types.ts`.

- `GET /api/matches` -> `{ matches: MatchSummary[] }`.
- `GET /api/matches/[id]` -> `{ match: MatchDetail }`; unknown ID is 404.
- `POST /api/explain` accepts `ExplainRequest` -> `ExplainResponse`.
- `GET /api/health` -> `{ ok: true, version: "0.1.0", aiConfigured: boolean }`.
- Error JSON: `{ error: string }` with a relevant HTTP status.

The MVP has demo diving, swimming, and cricket cases. Fictional competitors and
results are explicitly labeled. Optional real-data/provider integrations must
preserve timestamps, provenance, and failure states. Refreshing fixtures must
not be described as receiving live scores.

The frontend's three core states are match discovery, selected-moment
explanation, and follow-the-match guidance. It uses the API instead of embedding
duplicate datasets. The hero artwork lives at `/images/aquatics-hero.png`.

Explanations work without credentials, using recorded demo facts and verified
rules. An optional server-side model may enrich those facts, but cannot invent
judging causes, live data, or data-provider coverage.
