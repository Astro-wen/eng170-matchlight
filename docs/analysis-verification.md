# Real integration verification

Verified on 2026-10-14 Pacific time. No credentials or private photos are recorded
here. Keys are encrypted server-side runtime secrets; no client bundle contains
provider credentials.

- OpenRouter official API accepted the supplied credential and returned
  `google/gemini-3-flash-preview` responses.
- TypeSafe official API returned real `jev-1.13.0` Choice/Noul decisions.
- ESPN normalized scoreboards and event summaries were checked for all 17
  allowlisted competitions; coverage details are in espn-provider.md.
- Real ESPN NBA Finals screenshot: model extracted Dallas Mavericks, Boston
  Celtics, 88/106 and Final. JEV selected event401656363. ESPN summary returned
  BOS106/DAL88 and Tatum31points. Browser Analyze generated five tappable points;
  clicking Player to know displayed Tatum's record and the ESPN source link.
- Result correctly displayed HISTORICAL, not live. No specific play was inferred
  from a final scoreboard without period/clock evidence.
- The same positive flow completed on the deployed private Site after fixing
  Cloudflare Workers' unsupported `redirect: error` mode. All providers use
  `manual` and reject non-OK responses without following redirects.
- Real local-file upload through the file picker, Chinese UI: public diving photo
  produced visible athlete/Olympic-ring points and explicit unsupported-event
  status. It did not assign Chen Yiwen, a final dive score, or a live event.
- 390px viewport had document scrollWidth390 and five distinct tap targets.
- 69 automated tests, strict TypeScript, production build and GitHub Actions
  passed for application commit aaa0472f002b2c3c502ae6aee0288cf262753281.

Physical device camera permission/capture was not exercised during this run.
Camera entry and upload share the same analysis path after image capture.

## Five-sport expansion · 2026-10-15 UTC

- 130 deterministic tests, strict TypeScript and production Worker build passed.
- Real free ESPN Olympic API returned gymnastics, swimming, athletics and diving
  records; real aggregate cricket API discovered four competitions/seven events.
- Real providers with mocked model decisions verified ESPN-first Chen Yiwen final,
  World Aquatics enrichment of all 60 dives, and McEvoy 50m swimming (no invented
  exact action). Singapore 2025 men's 1500m lookup found Ahmed Jaouadi 14:34.41.
- Scope-conflict regression rejects a 10m platform label paired with Chen's 3m
  final total, even at high JEV confidence. Manual confirmation still enriches.
- Production OpenRouter + JEV + ESPN + World Aquatics returned matched historical
  Chen Yiwen, dive 5, 76.50, difficulty 3.0; verified 25.5 × 3.0 arithmetic.
- In this Worker deployment the site.web ESPN host failed while site.api served
  the identical records. Olympic/cricket adapters use the latter fixed host.
- Recreated historical scorecards display their source/date and pass through real
  image analysis. They are never represented as actual venue photographs.
- Gymnastics/athletics currently use Paris 2024 results. Aquatics has date-based
  official lookups; cricket has available current records. None guarantees
  comprehensive current coverage or a future LA28 live service.

## Live-first flow · 2026-10-15

- Default Live mode queries server-now provider states; Replay is explicit.
- 172 deterministic tests and strict TypeScript passed before the production build.
- Real server-clock discovery returned four ESPN current cricket events and no
  confirmed in-progress NBA or target individual-sport events at lookup time.
- Real ESPN discovery and summary with mocked vision/JEV linked Oman–Canada in
  Live mode, preserving 20 provider statistics and exact-action uncertainty.
- A synthetic LIVE diving phase exercises sport-only unique-current association,
  complete available dive awards/DD/judges and on-photo rules. It is a contract
  test, not a claim that an actual diving event was live during this run.
- Conflicting printed dates/teams cannot be overridden by manual current IDs.
  Failed detail requests remain unavailable; phase LIVE→OFFICIAL is refreshed.
