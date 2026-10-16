# Current-event photo flow

Default flow: vision → current-event discovery → compatibility gates / TypeSafe
JEV → current detail fetch → source-backed photo points and available statistics.
Live requests use the server's current UTC time. An explicit Replay request keeps
the previous original-date archival workflow. No historical fixture substitutes
for a live event.

## Sources and limits

- ESPN ordinary scoreboards: current UTC and preceding league-schedule day,
  actual `state=in`, completion/cancellation checks, recent start timestamps.
- ESPN current cricket aggregate: current competitions and dynamic verified
  league/event pairs, scores preserved in runs/wickets/overs notation.
- World Aquatics: official `/fina/results/live` widget feed, then phase details.
  Only a recent explicit `ResultStatus=LIVE` non-summary phase is current.
  `IsLive`, a start list, elapsed planned time or unofficial result is insufficient.
  Current detail is freshly fetched, so a finished phase can invalidate a candidate.
- ESPN Olympics: latest Summer Games' exact current-day result endpoint,
  validating returned year, day and Games calendar, plus preceding day when
  relevant. Only explicit state=in can be current. This is a limited result feed,
  not a verified complete live schedule; availability flags are not event states.

Requests have fixed HTTPS origins, manual redirects, timeouts and bounded bodies.
Provider caches retain original fetchedAt. Internal asOf hooks are for deterministic
adapter tests only; HTTP endpoints do not accept an alternate discovery clock.

## Association

The current scenario is explicitly selected by Live mode. One compatible current
candidate can be associated from the visible sport. This uses matchMethod=current
and does not prove that a photograph belongs to the event. Printed conflicting
dates, teams or event scope veto automatic association. Several compatible
candidates require distinguishing printed clues or a manual choice. JEV ranks
only supplied events and never generates a URL, score or current status.

Manual confirmation is bounded to newly discovered current candidates. Detail
identity and current state are checked again. A specific play / dive is a separate
association requiring its own recorded evidence. Current stats can be ahead of
or behind the photographed scoreboard because of broadcast/provider delays.

## Responses and UI

`POST /api/analyze`: optional mode live|replay (default live).
`GET /api/live-events?sport=cricket`: current candidate events, sources, checkedAt,
status ok|unavailable|unsupported, limited; no model call or photo involved.

`discovery` reports matched, ambiguous, empty, unavailable or unsupported plus
active count and lookup time. Partial detail failures do not masquerade as a
successful complete empty lookup. All returned statistics can be expanded.

Historical samples choose Replay. The current sample image is locally recreated
from a real ESPN current event, identifies its provenance and is never called a
venue photograph. Preparing a sample does not call paid analysis models.

## Verification

Deterministic tests include sport-only single current diving candidate, multiple
NBA candidates, distinguishing teams, old printed dates, source failures,
invalid/current manual IDs, in-progress→final changes, stats provenance and
explicitly synthetic Olympic state transitions. Real current probes on 2026-10-15
returned active ESPN cricket candidates and no confirmed in-progress target
Olympic/aquatic events or NBA matches at the lookup time. No true Summer Olympic
live event was available to validate during this run.
