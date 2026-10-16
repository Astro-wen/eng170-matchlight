# Paris 2024 archive provider

`lib/analysis/olympic-archive.ts` uses the public Codante Olympic Games API for
historical diving, swimming, artistic gymnastics and athletics. It is a community
archive, not an IOC-operated service or a current Olympics feed. No key is needed.
The vendor documents a limit of 100 requests per minute. See the
[provider documentation](https://docs.apis.codante.io/olympic-games-english).

`findOlympicEvents({sport,date,query?})` requests the fixed `/events` endpoint with
the sport's discipline code, date and numbered page. At most three pages are read;
text is filtered locally across the event and competitor names so event queries
such as “100m” work as well as athlete queries. The provider never follows a
response's pagination URLs. More pages or invalid records set `limited: true`.
Only July 24–August 11, 2024 is queried; other dates return an empty, limited result
without a network call.

`fetchOlympicEvent({eventId})` accepts a numeric ID or its `paris-` prefixed form.
The returned event ID is always prefixed; `league` is `paris2024`, `provider` is
`olympic-archive`, `dataMode` is `historical`, and `teams` is empty. A finished
record is `final`. Archived running/scheduled flags are `unknown`, never `live`.
Every source carries the original request URL and fetch timestamp. Responses are
cached for 60 seconds without changing that timestamp. Redirects are refused;
requests time out after ten seconds and JSON bodies are limited to 2 MiB.

Live probes on October 15, 2026 verified these source records:

| Sport | Paris event | Archive ID | Available data |
| --- | --- | --- | --- |
| Diving | Women's 3m springboard final, August 9 | [16756](https://apis.codante.io/olympic-games/events/16756) | 12 competitors; Chen Yiwen 376.00, Maddison Keeney 343.10, Chang Yani 318.75 |
| Swimming | Women's 100m freestyle final, July 31 | [15263](https://apis.codante.io/olympic-games/events/15263) | 8 competitors; Sarah Sjöström 52.16, Torri Huske 52.29, Siobhán Haughey 52.33 |
| Gymnastics | Women's all-around final, August 1 | [15494](https://apis.codante.io/olympic-games/events/15494) | 24 competitors; medal ranks available; marks have ambiguous scope |
| Athletics | Men's 100m final, August 4 | [16117](https://apis.codante.io/olympic-games/events/16117) | Lyles and Thompson both display 9.79 with distinct recorded ranks; no thousandths |

Empty result positions stay unknown. The feed's `position` is an ordering field,
not a reliable finishing rank. Portuguese country names are not converted into
invented flags: country codes come from an existing three-letter code or the
allowlisted Codante flag URL. Gymnastics marks such as Biles's `15.766` appear in
the all-around record without an apparatus label; all gymnastics `score` fields
are therefore omitted. Missing marks remain missing. `rounds` is always empty:
this source cannot establish the precise photographed dive, apparatus action,
split or finish-camera thousandth. These limits accompany each detail response.

Tests cover query and ID validation, historical status safety, partial marks and
ranks, fixed-origin pagination, cached timestamps, mutation isolation and failed,
malformed or oversized upstream responses. Public feeds can return 403 or 429;
these produce provider errors rather than silently pretending no events exist.
