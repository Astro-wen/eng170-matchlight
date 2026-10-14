# Matchlight

**Get in the game.**

An ENGR 170 Team 4 spectator companion MVP for casual fans and tourists. Choose a match, understand a score or key moment in plain language, then know what to watch next. Product name is provisional.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm ci
npm run dev
```

Open the loopback URL printed by the server (normally http://localhost:5173). The working demo does not require an account, database, sports subscription, or model key. English and Chinese are supported.

```sh
npm run typecheck
npm test
npm run build
```

## What the MVP does

- Browse diving, swimming, and cricket cases and select a particular moment.
- Use a compact score strip, athlete/country search, country filters, and official portraits for all 12 real Paris finalists.
- Explore a black-and-white sports interface with LA28-inspired pink, cyan, and orange accents.
- Explain recorded scores and rules with an auditable breakdown.
- Show rankings, source references, and relevant follow-up viewing guidance.
- Switch the interface and explanations between English and Chinese.
- Use AI-generated venue illustrations with recorded provenance.
- Include a real Paris 2024 women's 3m springboard results snapshot alongside clearly labeled fictional demos.

Historical results are finished events. Fictional cases are not live feeds. Refresh reloads available data; it does not manufacture a new live update. Scores alone cannot establish why a judge deducted points.

## Optional model-written explanations

Copy `.env.example` to `.env.local` and set a server-side model key and an explicit model name. The provider must support Chat Completions and strict JSON Schema outputs. OpenAI is the default endpoint; compatible HTTPS endpoints can be configured. Without configuration, the app uses bilingual explanations grounded in recorded facts and rules. A provider timeout or invalid response falls back to that same working behavior. Numerical breakdowns, authoritative explanations and citations remain server-owned. Model-written prose appears separately as an AI paraphrase, with additional checks for unsupported numbers and judging causes.

No actual model credentials are included. The provider path is tested with mocked HTTP responses; a real model call requires your key and is not claimed as verified. In hosted deployments, set the same variables in the hosting runtime.

## Stack

- React 19 + Kumo UI + Phosphor icons.
- Vinext/Vite with Next-compatible route handlers for a small backend.
- Typed match contract and pure scoring/explanation functions.
- Sites-compatible Cloudflare Worker deployment.
- Node test runner and TypeScript checks.

## Feature branches

| Branch | Responsibility |
| --- | --- |
| `feat/spectator-ui` | Discovery, match viewer, bilingual UI, responsive design |
| `feat/match-data-explanations` | Fixtures, historical result mapping, scoring, API |
| `feat/visual-assets` | AI images, favicon, asset provenance |
| `feat/ai-explanations` | Optional grounded model provider and fallback tests |
| `feat/mvp-integration` | Dependencies, integration, QA, documentation, deployment |
| `feat/athlete-media` | Verified World Aquatics portraits, identity mapping, provenance |
| `feat/la28-sports-theme` | Sports layout, score strip, country filters, portrait integration |

`main` holds the integrated MVP. Feature branches retain each module's history. Start future changes from `main`, then open a new branch for that feature.

## API and data

- [API contract](docs/api-contract.md)
- [Data sources](docs/data-sources.md)
- [Data requirements and protection](docs/data-requirements.md)
- [Generated image provenance](docs/asset-provenance.md)
- [Official athlete portraits](docs/athlete-media.md)
- [Sports design references](docs/design-references.md)
- [MVP scope and next steps](docs/mvp-plan.md)

## Assignment use

The three solution states are discovery, explanation, and follow-the-match. Capture those screens and add short annotations, your name, team name/number, and the team's agreed long-term goal to the Canvas document. Include the data table. Use an anonymous version on the shared collaboration board. The running application is a supplementary demonstration; follow the instructor's digital sketch submission requirements.
