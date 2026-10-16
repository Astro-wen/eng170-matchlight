# ESPN Olympic results provider

ESPN has a separate Olympic results API. Its coverage must not be inferred from
the conventional two-team sports/league scoreboard registry.

Verified on 2026-10-15, without an API key:

`https://site.api.espn.com/apis/site/v2/olympics/summer/2024/results?dates=20240809&lang=en&region=us`

The public ESPN results site's JavaScript declares
`apis/site/v2/olympics/{season}/{year}/results`. Both `site.web.api.espn.com` and
`site.api.espn.com` returned JSON in the verification; this adapter fixes the
latter hostname. The public page is
[ESPN Paris 2024 diving results](https://www.espn.com/olympics/summer/2024/results/_/view/medalrounds/discipline/16).

The API returned all sports on the requested day. The `discipline` and `event`
query parameters were ignored in actual probes; date ranges were not reliable.
Consequently this adapter requests one exact day, verifies the returned season
and date, and filters discipline/event IDs locally. Its normalized IDs include
the day to retrieve an individual result without scanning a whole Games.

## Verified coverage

| Sport | ESPN discipline IDs | Actual sample ID | Sample result |
| --- | --- | --- | --- |
| Diving | 16 | `espn-olym-summer-2024-20240809-30401` | Women's 3m springboard: Chen Yiwen, CHN, 376.00 |
| Swimming | 39 | `espn-olym-summer-2024-20240804-30599` | Men's 1500m freestyle: Bobby Finke, USA, 14:30.67 |
| Athletics | 3 | `espn-olym-summer-2024-20240804-30665` | Men's 100m: Noah Lyles, USA, 9.784 |
| Gymnastics | 21 artistic; 22 rhythmic; 23 trampoline | `espn-olym-summer-2024-20240801-30299` | Women's artistic all-around: Simone Biles, USA, 59.131 |

All four sample searches and summaries were run against ESPN successfully.
Score strings preserve the provider's original precision, including the
thousandths ESPN reports for the first two men's 100m finishers.

## Contract

`searchEspnOlympics({ sport, date, query? }, fetcher?)` returns `IndividualSearch`.
`fetchEspnOlympicSummary({ eventId }, fetcher?)` returns `IndividualSummary`.
`league` and `provider` are both `espn-olympics`.

The current adapter intentionally verifies only Paris 2024, July 24–August 11.
Other valid dates return an empty limited search, without substituting archive
results for a present-day capture. Every event uses `dataMode: historical`.
Even an erroneous archived `in` status cannot become `live`.

This feed supplies medal result records, sometimes with tied bronze medalists.
It does not supply a complete start list, every finalist, lap splits, diving
judges' marks, gymnastics difficulty/execution breakdowns, or an action timeline.
Those omissions are returned as limitations, and `rounds` is empty. Relay,
synchronised and team result rows are grouped so a repeated team score does not
become a separate rank for each member. Final standings do not establish which
action a photograph captured.

Requests use a fixed HTTPS origin/path, manual redirects, a 10-second timeout,
a streamed 2-MiB limit, and a per-fetcher 30-second cache shared across sports
and summaries. Source URLs and fetch timestamps accompany results. ESPN's public
website feed is suitable for a no-key prototype; it has no availability or
freshness guarantee for this application. It establishes no future LA28 coverage.

## Cricket discovery

Cricket's public aggregate header also returned HTTP 200:

`https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=in&lang=en`

At verification it contained four competitions and seven events, including
New Zealand Women tour of Australia (`24268`), President's Trophy (`8836`),
ECA Women's European Cup (`1558221`), and ICC Men's Cricket World Cup League 2
(`19439`). This demonstrates broader ESPN cricket coverage beyond IPL. The
[cricket adapter](espn-cricket-provider.md) implements that distinct header shape,
discovers competition/event pairs and verifies summary IDs on fixed paths.
The existing IPL historical tools remain separate.
