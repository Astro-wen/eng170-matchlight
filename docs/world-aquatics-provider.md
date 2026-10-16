# World Aquatics public results provider

`lib/analysis/world-aquatics.ts` performs fresh, server-side, no-key public lookups
for swimming and diving. It does not substitute a saved Paris fixture when a
date has no results.

## Contract

```ts
findAquaticsEvents(
  { sport: 'diving' | 'swimming', date: 'YYYY-MM-DD', query?: string },
  fetcher?: typeof fetch,
): Promise<IndividualSearch>

fetchAquaticsEvent(
  { eventId: string },
  fetcher?: typeof fetch,
): Promise<IndividualSummary>
```

Events use `league: 'worldaquatics'`, `provider: 'worldaquatics'`, `teams: []`,
and actual `competitors` with name, country, recorded rank, and score/time.
Canonical IDs are `wa-<discipline-UUID>-h<heat-index>`; a bare UUID also selects
heat zero. Finals, semifinals, preliminaries and swimming heats have distinct IDs
and phase-specific UTC timestamps. Phase timestamps describe the phase record,
not the exact photographed action.

Each summary contains recorded diving rounds (dive code, points, total,
difficulty and complete supplied judge panel), or swimming cumulative splits.
Missing scores, ranks, difficulty and judges remain absent. The provider never
invents a judge's deduction reason or converts a missing value into zero.

## Verified upstream paths

These paths and filters are used by the official World Aquatics website:

- `GET https://api.worldaquatics.com/fina/competitions`
  with `venueDateFrom`, `venueDateTo`, `disciplines=DV|SW`, `pageSize`, `page`,
  and `sort=dateFrom,asc`.
- `GET https://api.worldaquatics.com/fina/competitions/{numeric-id}/schedule`
  supplies discipline UUIDs and dated phase entries.
- `GET https://api.worldaquatics.com/fina/events/{discipline-UUID}`
  supplies all heats and results for that discipline.

Official website references inspected:
[competition calendar](https://www.worldaquatics.com/competitions),
[calendar script](https://www.worldaquatics.com/resources/v2.12.46/widgets/fina_competition-calendar.min.js),
[endpoint definitions](https://www.worldaquatics.com/resources/v2.12.46/widgets/common.min.js).

## Real probes on 2026-10-15 UTC

- Diving search, `2024-08-09`, `CHEN Yiwen women 3m 76.50`: fetched the date-window
  catalog, Paris schedule and results; returned women's 3m final separately from
  men's 10m preliminary. The official women's final phase time was
  `2024-08-09T13:00:23Z`, CHEN Yiwen total `376.00`.
- Direct final summary
  [official result JSON](https://api.worldaquatics.com/fina/events/ef62ff76-092c-4d34-882d-e247cd6a0310):
  60 recorded dives. CHEN's fifth dive `5152B` has difficulty `3.0`, points `76.50`,
  and judges `8.5, 8.5, 8.0, 9.0, 8.5, 8.5, 8.5`.
- Swimming search, `2025-08-03`, `Singapore women 50m freestyle Meg Harris`:
  found the Singapore 2025 women's 50m freestyle final, HARRIS Meg (AUS) `24.02`,
  at `2025-08-03T11:23:54Z`.
  [Official result JSON](https://api.worldaquatics.com/fina/events/6301246c-86e4-498e-b99d-b2b193d87bd1).

The competition-level `IsLive` flag was `true` for both concluded Paris 2024
and Singapore 2025 records. It is deliberately ignored. `ResultStatus=OFFICIAL`
means the returned phase is a completed historical result. Other records remain
`lookup` with unverified live status (or scheduled if future and empty). This
provider accepts `live` only for an explicit, non-summary phase `ResultStatus=LIVE`
with a UTC phase timestamp no more than 18 hours before the server's current time.
Future `START_LIST` phases are scheduled even when their athlete list is already
present; elapsed start lists and `UNOFFICIAL` results remain unknown. A live phase
status does not identify the exact action visible in a photo.

Current discovery in `lib/analysis/current-aquatics.ts` uses the official website's
`GET /fina/results/live?venueDateFrom=...&venueDateTo=...` strip, then verifies up to
four discipline result records (five requests total). `events` contains only
explicit recent live phases; `schedule` contains today's completed, planned and
unverified phase records. `limited` flags omitted disciplines or failed detail
lookups. The internal `asOf` test argument is not accepted from photo requests.
The 30-second caches preserve each source's original fetch timestamp.

On 2026-10-15 at 09:59 UTC, real current discovery found Astana Swimming World Cup
records with morning heats completed and afternoon finals still on start lists.
It correctly returned no active swimming phases. The current public strip had no
diving schedule and returned no active diving phases. The official strip includes
current competitions, rather than proving that every competition is running now.

## Limits and validation

A search performs at most six requests: one date-window catalog, up to two
competition schedules, and the remaining budget on relevant discipline results.
Independent schedules/results are requested concurrently. Query terms and major
competition names prioritize this bounded set; coverage is marked `limited`
when other competitions/disciplines are omitted or a secondary request fails.
Swimming aggregate heat summaries are excluded from candidates to avoid
duplicating the actual individual heats. User confirmation is appropriate when
several phase records fit the visible evidence.

Upstream traffic uses the fixed HTTPS origin, validated UUID/numeric IDs, manual
redirect handling, ten-second timeouts and a 4 MiB streamed body limit. A small
30-second cache preserves each record's original `fetchedAt`; cached responses
are copied so a caller cannot mutate later results. At most twelve records of
up to 512 KiB each are cached per fetcher. No keys or image bytes are required.

Provider tests cover actual score arithmetic, phase separation, swimming time
strings, stale live flags, no-result dates, strict identifiers, request budgets,
missing values, cache isolation, malformed responses, redirects and failures.
