# ESPN provider

`lib/analysis/espn.ts` is a server-side data tool for the photo analysis flow.
It reads actual ESPN event records; it does not recognize images, pick a match,
or generate explanations. The analysis agent must match visual evidence and
capture time to these records before presenting an event as identified.

## API

```ts
fetchScoreboard({ league: "nba", date: "2024-06-17" })
fetchEventSummary({ league: "nba", eventId: "401656363" })
```

Both functions optionally accept a Fetch-compatible second argument for isolated
tests. `ESPN_LEAGUES` contains `{ key, sport, league, label }` entries. Inputs use
the `key`; paths use the fixed `sport`/`league` values from that registry.

Results contain normalized event IDs, names, start dates, teams, scores, status,
optional clocks/periods/venues, and source URLs with the server retrieval time.
Summaries also return available plays, team statistics, leaders, and headlines.
Absent fields remain absent. Cricket scores retain strings such as
`203/4 (15.4/20 ov, target 202)`; they are never coerced to a basketball-style score.
Sources point to the exact JSON used, with a separate original event date.

`scheduled`, `live`, `final`, and `unknown` reflect upstream status. Canceled,
postponed, suspended, and delayed records are `unknown`, with the upstream detail
retained when supplied. An old final stays final when retrieved today. Retrieval
time is not the time a play occurred, and `live` does not promise zero delay.

## Verified coverage

Verified on October 14, 2026 (America/Los_Angeles). Every row below returned an
HTTP 200 scoreboard containing actual events and an HTTP 200 summary that passed
the provider's normalized event-identity validation. These are coverage probes,
not claims that the listed completed events are currently live.

| Key | Fixed ESPN sport/league | Scoreboard date | Events | Example summary ID |
| --- | --- | --- | ---: | --- |
| `nba` | `basketball/nba` | 2026-10-14 | 7 | 401898404 |
| `wnba` | `basketball/wnba` | 2026-10-01 | 1 | 401918022 |
| `ncaam` | `basketball/mens-college-basketball` | 2026-04-06 | 1 | 401856600 |
| `ncaaw` | `basketball/womens-college-basketball` | 2026-04-05 | 1 | 401856590 |
| `nfl` | `football/nfl` | 2026-10-11 | 13 | 401872981 |
| `nhl` | `hockey/nhl` | 2026-10-14 | 2 | 401892504 |
| `mlb` | `baseball/mlb` | 2026-10-14 | 1 | 401908032 |
| `epl` | `soccer/eng.1` | 2025-05-25 | 10 | 704649 |
| `mls` | `soccer/usa.1` | 2026-10-10 | 14 | 761845 |
| `laliga` | `soccer/esp.1` | 2025-05-25 | 3 | 705033 |
| `bundesliga` | `soccer/ger.1` | 2025-05-17 | 9 | 711730 |
| `seriea` | `soccer/ita.1` | 2025-05-25 | 6 | 712483 |
| `ligue1` | `soccer/fra.1` | 2025-05-17 | 9 | 706729 |
| `ucl` | `soccer/uefa.champions` | 2025-05-31 | 1 | 733620 |
| `worldcup` | `soccer/fifa.world` | 2026-07-19 | 1 | 760517 |
| `wwc` | `soccer/fifa.wwc` | 2023-08-20 | 1 | 622586 |
| `ipl` | `cricket/8048` | 2026-03-28 | 1 | 1527674 |

Paths are formed only under:

```
https://site.api.espn.com/apis/site/v2/sports/{fixed sport}/{fixed league}/scoreboard?dates=YYYYMMDD
https://site.api.espn.com/apis/site/v2/sports/{fixed sport}/{fixed league}/summary?event=NUMERIC_ID
```

The NBA Finals example used for integration is Dallas at Boston on the ESPN
schedule date `2024-06-17`, ID `401656363`, start `2024-06-18T00:30Z`, final
Boston 106–Dallas 88. The [summary JSON](https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401656363)
contains the actual clock, period, running scores, and wallclock for plays. For
example, Q1 11:40 records Jrue Holiday's driving layup, home 2–away 0, wallclock
`2024-06-18T00:38:52Z`. The final score must not replace that earlier score when
explaining a photo from Q1.

## Coverage limits

- A successful empty date means no events were returned for that schedule query.
  It is not evidence that an arbitrary sport is supported.
- This ordinary league adapter enables only its listed competitions. The separate
  [Olympic provider](espn-olympics-provider.md) connects Paris 2024 gymnastics,
  swimming, athletics and diving; the [current cricket provider](espn-cricket-provider.md)
  discovers other current cricket competitions. No LA28 coverage is claimed.
- ESPN's schedule date can be a US/local schedule day rather than the UTC day in
  the event start field. Callers matching capture times should consider adjacent
  schedule dates around midnight and compare event timestamps.
- NFL plays come from available drives and scoring plays. Soccer uses available
  commentary and key events. IPL's verified summary supplied just 18 recent-ball
  records in `header.competitions[0].commentaries`, not a complete ball history.
  Do not claim a full timeline when the feed does not provide it.
- Missing player leaders or news are omitted. A returned summary can have no
  plays; the caller must explain that limit rather than create a play.

## Boundaries and failure behavior

No arbitrary URL can be supplied. League paths come from the fixed registry;
dates must be real `YYYY-MM-DD` dates; IDs must be 1–15 digits. Redirects are
refused. Requests have a 10 second timeout, and the streamed JSON body is limited
to 5 MiB, including when no `Content-Length` is present. Malformed JSON, invalid
event shape, and summaries for a different ID are rejected. Outgoing image and
game links are HTTPS ESPN-family URLs only.

Successful scoreboards are cached for 30 seconds with their original `fetchedAt`
and independently cloned results. The per-provider cache holds up to 100 queries.
Summaries are fetched on demand. Failures are never cached or silently replaced
with sample fixtures. Errors use `EspnProviderError` codes `UNSUPPORTED_LEAGUE`,
`INVALID_INPUT`, `UPSTREAM_HTTP`, `UPSTREAM_TIMEOUT`, and `UPSTREAM_INVALID`;
upstream response bodies and credentials are not copied into error messages.

Ten mocked provider tests cover input/path boundaries, historical/live status,
missing fields, malformed data, cache isolation, play/stat normalization, NFL
deduplication, soccer/cricket clocks, upstream failures, and both declared and
streaming size limits. The 17 real normalized league probes are recorded above.
