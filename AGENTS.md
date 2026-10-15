# Matchlight MVP

Build a small, working spectator companion for ENGR 170 Team 4. Use React and
Kumo UI. Product copy defaults to English with a Chinese language option.
The core product is camera-first: take/upload a photo, show information on that
photo, tap to understand. A match catalog must not replace that primary flow.
Prototype recognition presets must be labeled; never pretend arbitrary photos
were automatically recognized. Photo analysis uploads a resized image to the server and OpenRouter only after
the user presses Analyze. Disclose this before the button. Never log or persist
photo bytes. JEV and ESPN receive extracted features/query data, not image bytes.

## Working agreement

- Work on feature branches in separate worktrees; do not switch another agent's checkout.
- Keep shared API types in `lib/match-types.ts` stable. Coordinate changes with the owner.
- Do not commit credentials, runtime files, node_modules, or generated build output.
- Label sample data as a demo and historical records as historical. Never imply LA28 live coverage.
- Explain recorded scores; do not invent a judge's reason for a deduction.
- Implement actual interactions, loading/error states, and responsive layouts.
- Keep secrets on the server. Optional external services must have a working no-key demo fallback.
- Run type checking, meaningful scoring/API tests, and a production build before merging.
- Use AI-generated assets as illustration; never present them as actual event photography.

## Modules

- `feat/spectator-ui`: page, styling, reusable viewer components.
- `feat/match-data-explanations`: match fixtures, scoring, API routes, explanation engine.
- `feat/visual-assets`: generated artwork, favicon, asset provenance.
- `feat/mvp-integration`: integration, documentation, verification, deployment.

The main agent owns package/dependency files, shared types, and integration.

Real analysis lives in lib/analysis and POST /api/analyze. Keep event facts and
source timestamps server-owned. JEV chooses candidates; visible independent
identifiers must also match. Never equate a shared clock with a unique action.
