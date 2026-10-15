# Matchlight

**Snap the game. See more.**

An ENGR 170 Team 4 camera-first spectator prototype. Take or upload a photo,
explore information markers on the image, and tap for a short explanation.
English and Chinese are supported. The sample overlays demonstrate the intended
recognition experience; automatic image recognition is not connected.

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

## What the prototype does

- Open the device camera, capture a frame, or choose a local JPG/PNG/WebP.
- Try a real World Aquatics competition photograph or a recreated scoreboard.
- Keep the photo visible with athlete, score and rule information markers.
- Tap markers, switch context cards, show/hide labels and expand explanations.
- Associate own photos with an explicitly chosen saved event and moment; move a
  marker on the image without losing its position when the screen size changes.
- Explain saved scores with source references and bilingual grounded answers.

Photos stay in browser memory and are not transmitted or persisted. The prototype
uses preset sample contexts and manual event selection for own photos. It does
not recognize arbitrary people, events, scores or judging faults from pixels.
The genuine Paris 2024 action photograph is from the semi-final; linked final
scores are separate saved historical context, not the photographed dive's score.
Historical records and fictional examples are labeled; there is no live feed.

See [camera prototype](docs/camera-prototype.md) and
[sample photograph provenance](docs/photo-scene-assets.md).

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
| `feat/la28-sports-theme` | Earlier sports theme and portrait integration |
| `feat/photo-scene-assets` | Verified competition photograph and provenance |
| `feat/photo-context-model` | Preset/manual photo context and validation |
| `feat/camera-first-prototype` | Camera/upload entry, on-photo markers, contextual cards and QA |

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

The three solution states are capture, information on the photo, and contextual explanation. Capture those screens and add short annotations, your name, team name/number, and the team's agreed long-term goal to the Canvas document. Include the data table. Use an anonymous version on the shared collaboration board. The running application is a supplementary demonstration; follow the instructor's digital sketch submission requirements.
