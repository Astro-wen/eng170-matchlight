# ESPN current cricket coverage

`lib/analysis/espn-cricket.ts` discovers current cricket events from ESPN's
aggregate header, beyond the existing historical IPL adapter. No API key was
required for successful HTTP 200 probes on 2026-10-15.

- Discovery: `https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=in&lang=en`
- Details: `https://site.api.espn.com/apis/site/v2/sports/cricket/{numericLeagueId}/summary?event={numericEventId}&lang=en&region=in`

`fetchCricketScoreboard({ date? }, fetcher?)` returns the existing `EspnScoreboard`
contract. Its top-level league is `cricket`; each discovered event has a dynamic
league key `cricket-{numericLeagueId}` and a numeric event ID.
`fetchCricketSummary({ league, eventId }, fetcher?)` returns `EspnSummary`.
The summary must contain the exact requested event and league IDs.

Live verification found seven events in four competitions:

| Competition ID | Competition | Verified event |
| --- | --- | --- |
| 19439 | ICC Men's Cricket World Cup League 2 | 1554418 · Oman v Canada |
| 24268 | New Zealand Women tour of Australia | 1558543 · Governor-General XI Women v New Zealand Women |
| 8836 | President's Trophy | 1553799 · Markhor IT Solutions v State Bank of Pakistan |
| 1558221 | ECA Women's European Cup | 1558244 · Austria Women v Sweden Women |

All four summary endpoints returned JSON in initial research. The finished
adapter was then exercised against the current header and two summaries:
Oman–Canada returned eighteen recent ball commentaries, innings statistics and
leaders; the President's Trophy match returned multi-innings totals and leaders
with no actual ball commentaries. Empty commentary is left empty, rather than
converted from the provider's promotional pre-match text.

The header is a **current snapshot**, not a date-search archive. A requested
calendar day more than 48 hours from the current time returns no events and no
upstream sources. Near-current date requests filter the snapshot's actual event
start/end interval, including ongoing multi-day matches. Historical IPL lookup
continues to use the separate standard ESPN league adapter. This does not imply
that every historical or current cricket competition is covered.

Cricket scores remain strings, including `256 (50 ov)` and
`376 & 98/3 (29 ov)`. Over notation is never treated as a decimal score; a ball
commentary retains its `49.6 ov` anchor. Slash and multi-innings totals are not
coerced into basketball-style numeric home/away play scores. Commentaries are
ordered oldest to newest. Zero-filled mirror innings for the side that has not
batted are excluded from statistics.

Some ESPN entries say state `in` while their textual summary says `Starts at`
and both sides have no score. Those are conservatively returned as scheduled.
Other live/final/cancelled states preserve their distinctions. Provider status
and timestamps describe ESPN's fetched snapshot, not automatic confirmation of
the photograph's exact action or match time.

All paths and HTTPS hosts are fixed. Incoming identifiers must match numeric
patterns; redirects are refused; network operations have a 10-second timeout
and streamed 5-MiB response cap. Cached snapshots retain their original fetch
timestamp for 30 seconds, share in-flight requests and return independent clones.
ESPN's public website feeds have no availability or freshness guarantee for this
prototype. No future LA28 coverage is claimed.
