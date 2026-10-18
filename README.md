# Matchlight

## Intro

Matchlight helps spectators understand the game in front of them. Take or upload a photo of a sports broadcast or venue, connect it to an event, and tap markers on the photo to see scores, context, and explanations.

[Try the prototype](https://matchlight-eng170.uclae2e12.chatgpt.site/) — ChatGPT sign-in required.

## How It Works

A photo supplies clues. Sports feeds supply event facts. Matchlight connects the two and explains useful details on the image.

## Process

1. Take a photo or upload an image. Keep the scoreboard and participant names visible when possible.
2. Use **Live now** for a current broadcast, or select **Replay / past event** and enter the original event date.
3. Run the analysis and choose a matching event if prompted.
4. Tap the photo markers, then open **Match statistics** and **Sources** for more detail.

For a quick demo, choose **Current match sample**, a scorecard generated from current ESPN data. Historical samples open in Replay mode.

![Current cricket result with tappable photo markers](docs/images/04-live-result.jpg)

Captured on October 16, 2026. This browser run used candidate confirmation and returned 19 statistics. The input is a recreated ESPN scorecard, not venue photography.

[See the complete run, input images, screenshots, and backend response](docs/run-process.md).

## Photo Analysis

```mermaid
flowchart TD
    photo["Photo"] --> vision["OpenRouter<br/>Read visible clues"]
    vision --> mode{"Live or Replay?"}
    mode -->|Live| current["Current events<br/>ESPN / World Aquatics"]
    mode -->|Replay| archive["Historical records<br/>Original event date"]
    current --> decision["TypeSafe JEV + validation<br/>Compare eligible candidates"]
    archive --> decision
    decision -->|Linked or confirmed| facts["Available event data + sport rules"]
    facts --> markers["Tappable explanations<br/>Statistics and sources"]
```

- **Match checks:** Live queries use server time and explicit in-progress states. Conflicting clues block association. Unclear results need confirmation. Source failures stay separate from empty results.
- **Evidence:** Recorded facts and timestamps stay authoritative. The photo's score and the provider's latest score are shown separately.
- **Privacy:** Images go to the app server and OpenRouter. JEV and sports feeds receive clues, candidates, or queries. The app does not log or save photos. Keys stay server-side. Provider retention terms apply.

The backend owns the provider queries and validates model output. Event identity and the exact action shown in a photo are checked separately.

More detail: [request sequence and matching principles](docs/run-process.md#request-sequence).

## API Sources

| Source | What it supplies | Access |
| --- | --- | --- |
| ESPN sports feeds | Teams, event status, scores, available plays, player statistics, and current cricket discovery | Public website JSON feeds, no key |
| ESPN Olympic results | Paris 2024 replay results and a limited current-day lookup | No key, incomplete current coverage |
| World Aquatics | Official swimming and diving records, available judges, difficulty, and splits | Public results feeds, no key |
| Codante Olympics archive | Paris 2024 replay fallback when other searches lack a suitable candidate | Third-party archive, no key |
| [OpenRouter](https://openrouter.ai/docs/api_reference/overview) | Photo reading and selection of verified facts | Server-side API key |
| [TypeSafe JEV](https://docs.typesafe.ai/introduction/quickstart) | Candidate choice and evidence assessment | Server-side API key |

Rules are source-linked references maintained in code. They are not fetched through a live rules API. Sports feeds can be incomplete or delayed.

[Endpoint examples, source roles, and coverage limits](docs/api-sources.md).

## Can Dos (Current Prototype)

- Extract the sport and readable clues from an uploaded photo.
- Look up in-progress events in supported ESPN competitions, including NBA and cricket, and connected World Aquatics feeds.
- Show available scores, competitors, countries, player statistics, and scoring breakdowns with their sources.
- Explain basic rules and selected recorded scores, including diving score calculations.
- Keep live and historical results separate, and distinguish an uncertain match, no current results, and an unavailable data source.
- Offer English and Chinese interfaces with mobile layouts.

## Can't Dos (Current Prototype)

- Identify every match from incomplete, blurred, or old photos.
- Prove photo identity just because only one compatible current event exists.
- Identify any athlete by face alone or confirm an exact play or dive without matching records.
- Guarantee complete statistics, instant updates, or coverage of every competition, including full Olympic or LA28 live coverage.
- Explain a judge's reason for a deduction without a supporting record.
- Watch continuous video or automatically follow every play.

## Stack

| Layer | Technology |
| --- | --- |
| Interface | React 19, Kumo UI, Phosphor icons |
| App and backend | Vinext / Vite with Next-compatible route handlers |
| AI services | OpenRouter vision models, TypeSafe JEV decisions |
| Sports data | ESPN and World Aquatics public feeds |
| Hosting | Cloudflare Worker through Sites |
| Validation | TypeScript and the Node.js test runner |

## Run Locally

Requires Node.js 22.13 or newer.

```sh
npm run install:ci
cp .env.example .env.local
```

Set `OPENROUTER_API_KEY` in `.env.local` for photo analysis. Set `TYPESAFE_API_KEY` to enable JEV decisions. Keep both keys on the server.

```sh
npm run dev
```

Open the local URL printed in the terminal, normally `http://localhost:5173`. Without an OpenRouter key, real photo analysis reports that it is not configured.

Checks: `npm run typecheck`, `npm test`, and `npm run build`.

## Feature Branches

`main` is the integration branch. Feature branches organize development by module.

| Branch | Responsibility |
| --- | --- |
| `feat/spectator-ui` | Initial viewer, reusable components, and bilingual layouts |
| `feat/match-data-explanations` | Match records, scoring functions, and explanation APIs |
| `feat/visual-assets` | Generated illustrations, favicon, and asset provenance |
| `feat/ai-explanations` | Optional grounded explanations and fallback behavior |
| `feat/mvp-integration` | Dependencies, integration, verification, and deployment |
| `feat/athlete-media` | Official athlete portraits and identity mapping |
| `feat/la28-sports-theme` | Sports visual theme and portrait presentation |
| `feat/photo-scene-assets` | Verified competition photograph and provenance |
| `feat/photo-context-model` | Labeled sample context and manual clue validation |
| `feat/camera-first-prototype` | Camera entry, photo markers, and contextual cards |
| `feat/live-photo-agent` | Vision, decision, and event-data orchestration |
| `feat/live-photo-ui` | Upload analysis, dynamic markers, and confirmation UI |
| `feat/espn-provider` | Allowlisted ESPN event lookup tools |
| `feat/jev-decision` | TypeSafe decision adapter and response validation |
| `feat/espn-five-sport` | ESPN Olympic results and current cricket adapters |
| `feat/world-aquatics-provider` | Official aquatic results and scoring records |
| `feat/olympic-archive` | Public Paris 2024 fallback records |
| `feat/five-sport-ui` | Individual results, countries, and athlete cards |
| `feat/five-sport-integration` | Cross-sport matching, rules, and end-to-end verification |
| `feat/live-event-discovery` | Current-event discovery, association checks, and statistics |
| `feat/live-discovery-ui` | Live / Replay controls and current-event result states |
| `feat/current-aquatics` | Current World Aquatics discovery and phase-status checks |
| `feat/current-olympics` | Limited current-day ESPN Olympic lookup |
