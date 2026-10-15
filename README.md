# Matchlight

**Snap the game. See more.**

Take or upload a photo of a game, identify visible teams and scoreboard clues,
fetch real ESPN event data, and tap points on the image to understand the game.
English and Chinese are supported.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Set server-only `OPENROUTER_API_KEY` and `TYPESAFE_API_KEY` for real analysis.
The camera and upload preview work without keys; Analyze then reports that the
service is not configured. Historical scoring APIs remain usable without keys.
Never put provider keys in frontend variables or the repository.

```sh
npm run typecheck
npm test
npm run build
```

## Photo analysis

1. Capture or upload a JPEG, PNG or WebP. The browser resizes it to at most 1600px.
2. Check the capture date/time and optionally add a team or league clue. For a
   replay, use the original event date.
3. Press Analyze. The resized photo goes to the server and OpenRouter for visual
   extraction. Images are not logged or saved by this app. Provider retention is
   governed by the chosen provider's terms; this app cannot promise zero provider retention.
4. The server queries fixed ESPN scoreboards near the relevant date. TypeSafe's
   JEV chooses between supplied candidates and an explicit no-match option.
   Automatic matching also requires two distinct visible team identities and a
   unique candidate. A hint alone never supplies missing visual proof.
5. ESPN details provide current/recorded scores and available play records.
   Exact moment association needs matching period, clock and both scores; shared
   clock actions remain ambiguous. Provider scores at lookup time are separate
   from the score visible in the photo.
6. A second model call selects useful verified facts. Scores, status, action text
   and uncertainty remain server-owned. Generated prose cannot replace them.
7. Tap dynamically positioned points for explanations and timestamped sources.
   Uncertain matches expose candidate confirmation instead of fixed demo overlays.

The public competition photograph is a Paris 2024 diving image with no visible
name, score, date or clock. It intentionally exercises the **unmatched** state.
ESPN feeds currently cover 17 configured team-sport competitions; diving and
swimming do not have a connected live provider. This is not universal recognition
or live coverage of LA28. Historical records are always labeled.

The deployed integration was exercised with real OpenRouter and TypeSafe calls,
a public ESPN Finals screenshot, and the public diving photograph. Deterministic
unit tests use mocked providers and never consume model credits.

See [real analysis contract](docs/photo-analysis.md),
[ESPN coverage](docs/espn-provider.md), [JEV decisions](docs/jev-provider.md),
and [photograph provenance](docs/photo-scene-assets.md).

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
| `feat/live-photo-agent` | Real vision/decision/data orchestration, API, integration and QA |
| `feat/live-photo-ui` | Image upload analysis, dynamic pins and confirmation UI |
| `feat/espn-provider` | Real allowlisted event data tools |
| `feat/jev-decision` | TypeSafe decision adapter and validation |
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
