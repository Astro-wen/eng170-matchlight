# API sources

The prototype combines AI services with sports records. AI reads clues and helps choose a candidate. Sports providers supply recorded event facts.

## ESPN sports feeds

ESPN's public website JSON feeds supply teams, event IDs, status, scores, and available statistics, leaders, or play records. The ordinary league adapter has 17 configured competitions, including NBA. Current cricket uses a separate aggregate feed to discover additional competitions.

```text
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard?dates=YYYYMMDD
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary?event={eventId}

GET https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=in&lang=en
GET https://site.api.espn.com/apis/site/v2/sports/cricket/{leagueId}/summary?event={eventId}&lang=en&region=in
```

No ESPN API key is used. These are website feeds rather than a supported developer API contract. The backend uses fixed hosts, validated league paths, timeouts, and bounded responses. Missing plays or statistics remain missing.

The cricket aggregate is a current snapshot, not a historical search. Runs, wickets, and overs retain their original scorecard notation.

Examples: [NBA scoreboard](https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard), [current cricket feed](https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=in&lang=en), and [the recorded test match summary](https://site.api.espn.com/apis/site/v2/sports/cricket/8836/summary?event=1553797&lang=en&region=in).

## ESPN Olympic results

The replay adapter queries Paris 2024 results for diving, swimming, athletics, and gymnastics. Available medal results do not imply complete judges, splits, or action history.

```text
GET https://site.api.espn.com/apis/site/v2/olympics/summer/2024/results?dates=YYYYMMDD&lang=en&region=us
```

Example: [August 9, 2024 results](https://site.api.espn.com/apis/site/v2/olympics/summer/2024/results?dates=20240809&lang=en&region=us).

Live mode has a separate current-day lookup against the latest Summer Games year. It checks the returned calendar and requires an explicit in-progress state. This is a limited results lookup, not a complete Olympic live schedule or a connected LA28 service.

## World Aquatics

Official public results feeds provide swimming and diving competitions, schedules, and event details. Where supplied, details include athletes, countries, placings, diving judge awards and difficulty, or swimming splits.

```text
GET https://api.worldaquatics.com/fina/competitions
GET https://api.worldaquatics.com/fina/competitions/{competitionId}/schedule
GET https://api.worldaquatics.com/fina/events/{disciplineId}
GET https://api.worldaquatics.com/fina/results/live
```

Discovery adds date and discipline filters. Current candidates require a recent, non-summary phase with `ResultStatus=LIVE`. A start list or an `IsLive` flag alone is insufficient. The selected phase is fetched again before it is presented as live.

Replay can enrich compatible ESPN records with official dive details. The providers must agree on participant identities, marks, and event scope.

Example: [official Paris women's 3m final](https://api.worldaquatics.com/fina/events/ef62ff76-092c-4d34-882d-e247cd6a0310). Athlete portraits come from verified World Aquatics profiles, including [CHEN Yiwen](https://www.worldaquatics.com/athletes/1028322/wd).

## Codante Olympics archive

[Codante's documented Olympics API](https://docs.apis.codante.io/olympic-games-english) supplies a third-party Paris 2024 archive. It is an active Replay fallback when earlier searches do not produce sufficiently supported candidates.

```text
GET https://apis.codante.io/olympic-games/events?discipline={code}&date=YYYY-MM-DD&page=1
GET https://apis.codante.io/olympic-games/events/{eventId}
```

No key is used. Codante is not an IOC-operated source. It is never used to replace an empty current-event lookup, and it does not supply a complete per-action history.

## OpenRouter

The [OpenRouter API](https://openrouter.ai/docs/api_reference/overview) receives the resized image in a structured-output request. It returns visible features, including sport, readable names, scores, event text, and clue positions.

```text
POST https://openrouter.ai/api/v1/chat/completions
```

Matched team and cricket results attempt another call that selects existing fact IDs. This call does not write new scores, action descriptions, or deduction reasons. Individual-sport cards and diving arithmetic use deterministic data mapping.

The server reads `OPENROUTER_API_KEY`. The current code defaults to `google/gemini-3-flash-preview` for vision and fact selection. The October 16 test used that model. Model availability is controlled by the provider.

## TypeSafe JEV

The [TypeSafe System One API](https://docs.typesafe.ai/introduction/quickstart) compares extracted clues with supplied candidates.

```text
POST https://api.typesafe.ai/v1/systemone
```

One request contains a candidate Choice and an evidence Noul assessment. The response can select a supplied event ID or `none`. JEV receives features and candidate data, not the photo.

The server reads `TYPESAFE_API_KEY` and defaults to `jev-latest`. The October 16 test resolved to `jev-1.13.0`. Code independently validates eligibility and requires confidence and evidence of at least 0.8 for automatic association. Live requests only invoke JEV when one event is independently eligible and no manual selection is supplied.

## Rule references

Rule cards use source-linked summaries maintained in code. These are not runtime API calls.

| Sport | Reference |
| --- | --- |
| Diving and swimming | [World Aquatics regulations](https://www.worldaquatics.com/rules/competition-regulations) |
| Gymnastics | [World Gymnastics rules](https://www.gymnastics.sport/site/rules/index.php) |
| Athletics | [World Athletics technical information](https://worldathletics.org/about-iaaf/documents/technical-information) |
| Cricket | [MCC Laws of Cricket](https://www.lords.org/mcc/about-the-laws-of-cricket) |

Seven-judge diving arithmetic removes the two highest and two lowest awards, then multiplies the remaining three by difficulty. A score alone does not establish why a judge deducted marks.

[Back to README](../README.md) · [Runtime walkthrough](run-process.md)
