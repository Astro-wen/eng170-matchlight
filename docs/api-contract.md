# MVP API contract

The active photo flow is `POST /api/analyze`: see [photo-analysis.md](photo-analysis.md)
and `lib/analysis/types.ts`. The routes below remain the saved historical/demo
scoring API, separate from real event lookup.

Shared model: `lib/match-types.ts`.

- `GET /api/matches` -> `{ matches: MatchSummary[] }`.
- `GET /api/matches/[id]` -> `{ match: MatchDetail }`; unknown ID is 404.
- `POST /api/explain` accepts `ExplainRequest` -> `ExplainResponse`.
- `GET /api/health` -> `{ ok: true, version: "0.1.0", aiConfigured: boolean }`.
- Error JSON: `{ error: string }` with a relevant HTTP status.

The MVP has demo diving, swimming, and cricket cases plus a saved official Paris
2024 women's 3m springboard final. Fictional competitors and results are explicitly
labeled. Optional real-data/provider integrations must
preserve timestamps, provenance, and failure states. Refreshing fixtures must
not be described as receiving live scores.

The frontend's three core states are match discovery, selected-moment
explanation, and follow-the-match guidance. It uses the API instead of embedding
duplicate datasets. The hero artwork lives at `/images/aquatics-hero.png`.

Explanations work without credentials, using recorded facts and verified rules.
Optional server-side model prose is returned as `aiSummary`, separate from the
authoritative answer, scoring breakdown and source IDs. Key and model are required
to enable this path. Missing credentials or provider failure use the grounded
engine. `aiConfigured` reports whether a valid provider configuration is present.

Match summaries also include `preview` (the first three saved standings) and
`participants` (all saved names and country codes) for scoreboard cards, athlete
search, and country filters. Both are cloned from the same match record.
