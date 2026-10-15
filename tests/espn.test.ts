import assert from "node:assert/strict";
import test from "node:test";
import { ESPN_LEAGUES, EspnProviderError, fetchEventSummary, fetchScoreboard, resetEspnCache } from "../lib/analysis/espn";

function response(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" }, ...init });
}
function fixtureEvent(status: Record<string, unknown> = { type: { state: "post", completed: true, detail: "Final" } }) {
  return {
    id: "401000001", name: "Boston Celtics at Los Angeles Lakers", date: "2024-06-01T00:30Z", status,
    links: [{ href: "https://www.espn.com/nba/game/_/gameId/401000001", text: "Gamecast" }, { href: "javascript:alert(1)", text: "Unsafe" }],
    competitions: [{
      id: "401000001", date: "2024-06-01T00:30Z", venue: { fullName: "Crypto.com Arena" }, status,
      competitors: [
        { id: "13", homeAway: "home", score: "99", team: { id: "13", displayName: "Los Angeles Lakers", abbreviation: "LAL", logo: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png" } },
        { id: "2", homeAway: "away", score: "103", team: { id: "2", displayName: "Boston Celtics", abbreviation: "BOS" } },
      ],
    }],
  };
}
function mockFetch(payload: unknown): typeof fetch {
  return async () => response(payload);
}
async function rejectsCode(promise: Promise<unknown>, code: EspnProviderError["code"]): Promise<void> {
  await assert.rejects(promise, (error) => error instanceof EspnProviderError && error.code === code);
}

test("ESPN tools accept only verified competition keys, numeric event IDs, and actual calendar dates", async () => {
  let requests = 0;
  const fetcher: typeof fetch = async () => { requests++; return response({ events: [] }); };
  for (const league of ["https://evil.example", "../../nba", "constructor", "diving", "swimming", "cricket"]) {
    await rejectsCode(fetchScoreboard({ league }, fetcher), "UNSUPPORTED_LEAGUE");
  }
  for (const date of ["2025-02-29", "2024-02-30", "2026-13-01", "2026-1-01", "2026-10-14&url=https://evil.example"]) {
    await rejectsCode(fetchScoreboard({ league: "nba", date }, fetcher), "INVALID_INPUT");
  }
  for (const eventId of ["../secret", "1&url=https://evil.example", "", "1234567890123456"]) {
    await rejectsCode(fetchEventSummary({ league: "nba", eventId }, fetcher), "INVALID_INPUT");
  }
  assert.equal(requests, 0);
  assert.equal(new Set(ESPN_LEAGUES.map((league) => league.key)).size, ESPN_LEAGUES.length);
  assert.ok(ESPN_LEAGUES.some((league) => league.key === "ipl" && league.league === "8048"));
});

test("scoreboard preserves real historical final, teams, source, and fetch timestamp", async () => {
  let requested: string | undefined;
  const fetcher: typeof fetch = async (url, init) => {
    requested = String(url);
    assert.equal(init?.redirect, "manual");
    assert.ok(init?.signal instanceof AbortSignal);
    return response({ events: [fixtureEvent()] });
  };
  const board = await fetchScoreboard({ league: "nba", date: "2024-06-01" }, fetcher);
  assert.equal(requested, "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20240601");
  assert.equal(board.events[0].status, "final");
  assert.equal(board.events[0].date, "2024-06-01T00:30Z");
  assert.equal(board.events[0].teams[0].score, "99");
  assert.equal(board.events[0].teams[0].homeAway, "home");
  assert.equal(board.events[0].venue, "Crypto.com Arena");
  assert.equal(board.events[0].links?.length, 1);
  assert.equal(board.sources[0].url, requested);
  assert.equal(board.sources[0].fetchedAt, board.fetchedAt);
  assert.ok(Number.isFinite(Date.parse(board.fetchedAt)));
});

test("statuses do not turn postponed, missing, scheduled, or completed events into live events", async () => {
  for (const [rawStatus, expected] of [
    [{ type: { state: "pre" } }, "scheduled"],
    [{ type: { state: "in" }, displayClock: "3:12", period: 4 }, "live"],
    [{ type: { state: "post", completed: true } }, "final"],
    [{ type: { state: "post", completed: true, name: "STATUS_CANCELED" } }, "unknown"],
    [{ type: { state: "pre", name: "STATUS_POSTPONED" } }, "unknown"],
    [{}, "unknown"],
  ] as const) {
    const board = await fetchScoreboard({ league: "nba" }, mockFetch({ events: [fixtureEvent(rawStatus)] }));
    assert.equal(board.events[0].status, expected);
    if (expected === "live") { assert.equal(board.events[0].clock, "3:12"); assert.equal(board.events[0].period, 4); }
  }
});

test("empty dates are valid; optional data is omitted and corrupt events cannot masquerade as no fixtures", async () => {
  assert.deepEqual((await fetchScoreboard({ league: "ncaaw", date: "2024-02-29" }, mockFetch({ events: [] }))).events, []);
  const minimal = fixtureEvent();
  delete (minimal as Partial<typeof minimal>).name;
  delete (minimal as Partial<typeof minimal>).links;
  const board = await fetchScoreboard({ league: "nba" }, mockFetch({ events: [{ id: "bad" }, minimal] }));
  assert.equal(board.events.length, 1);
  assert.equal(board.events[0].name, "Boston Celtics at Los Angeles Lakers");
  assert.equal(board.events[0].teams[1].logo, undefined);
  await rejectsCode(fetchScoreboard({ league: "nba" }, mockFetch({})), "UPSTREAM_INVALID");
  await rejectsCode(fetchScoreboard({ league: "nba" }, mockFetch({ events: [{ id: "bad" }] })), "UPSTREAM_INVALID");
});

test("30 second cache is isolated per fetch provider and returns independent records", async () => {
  resetEspnCache();
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return response({ events: [fixtureEvent()] }); };
  const a = await fetchScoreboard({ league: "nba", date: "2024-06-01" }, fetcher);
  a.events[0].teams[0].score = "999";
  const b = await fetchScoreboard({ league: "nba", date: "2024-06-01" }, fetcher);
  assert.equal(calls, 1);
  assert.equal(b.events[0].teams[0].score, "99");
  assert.equal(b.fetchedAt, a.fetchedAt);
  await fetchScoreboard({ league: "nba", date: "2024-06-02" }, fetcher);
  assert.equal(calls, 2);
  assert.deepEqual((await fetchScoreboard({ league: "nba", date: "2024-06-01" }, mockFetch({ events: [] }))).events, []);
  resetEspnCache();
  await fetchScoreboard({ league: "nba", date: "2024-06-01" }, fetcher);
  assert.equal(calls, 3);
});

test("summary normalizes plays, statistics, leaders, and summary identity without inventing fields", async () => {
  const header = fixtureEvent();
  const data = {
    header,
    plays: [
      { id: "play-1", text: "Player makes three point shot", clock: { displayValue: "3:12" }, period: { number: 4 }, homeScore: 99, awayScore: 103, wallclock: "2024-06-01T02:30:15Z" },
      { id: "play-2", text: "Timeout" },
      { id: "play-3" },
    ],
    leaders: [{ team: { id: "2" }, leaders: [{ displayName: "Points", leaders: [{ displayValue: "30", athlete: { displayName: "Example athlete" } }] }] }],
    boxscore: { teams: [{ team: { id: "2" }, statistics: [{ label: "Rebounds", displayValue: "42" }, { displayName: "Batting", stats: [{ displayName: "Hits", displayValue: "8" }] }] }] },
    news: { articles: [{ headline: "Final score recorded" }] },
  };
  const summary = await fetchEventSummary({ league: "nba", eventId: header.id }, mockFetch(data));
  assert.equal(summary.event.status, "final");
  assert.equal(summary.plays.length, 2);
  assert.deepEqual(summary.plays[0], { id: "play-1", text: "Player makes three point shot", clock: "3:12", period: 4, homeScore: 99, awayScore: 103, wallclock: "2024-06-01T02:30:15Z" });
  assert.equal(summary.plays[1].clock, undefined);
  assert.deepEqual(summary.leaders, [{ category: "Points", athlete: "Example athlete", value: "30", teamId: "2" }]);
  assert.deepEqual(summary.statistics, [{ teamId: "2", label: "Rebounds", value: "42" }, { teamId: "2", label: "Hits", value: "8" }]);
  assert.deepEqual(summary.headlines, ["Final score recorded"]);
  assert.equal(summary.sources[0].fetchedAt, summary.fetchedAt);
  await rejectsCode(fetchEventSummary({ league: "nba", eventId: "123" }, mockFetch(data)), "UPSTREAM_INVALID");
});

test("NFL drive plays and duplicate scoring plays are combined without duplicate facts", async () => {
  const play = { id: "1234", text: "Touchdown", clock: { displayValue: "1:35" }, period: { number: 2 }, homeScore: 7, awayScore: 0 };
  const summary = await fetchEventSummary({ league: "nfl", eventId: "401000001" }, mockFetch({ header: fixtureEvent(), drives: { previous: [{ plays: [play] }], current: { plays: [{ id: "next", text: "Kickoff" }] } }, scoringPlays: [play] }));
  assert.equal(summary.plays.length, 2);
  assert.equal(summary.plays[0].homeScore, 7);
});

test("soccer commentary keeps stoppage-time display; cricket keeps runs/wickets score strings and available balls", async () => {
  const soccer = await fetchEventSummary({ league: "epl", eventId: "401000001" }, mockFetch({ header: fixtureEvent(), commentary: [{ sequence: 7, time: { displayValue: "90'+4'" }, text: "Corner awarded" }] }));
  assert.equal(soccer.plays[0].clock, "90'+4'");
  const cricketHeader = fixtureEvent();
  cricketHeader.competitions[0].competitors[0].score = "203/4 (15.4/20 ov, target 202)";
  const cricketCompetition = cricketHeader.competitions[0] as typeof cricketHeader.competitions[0] & { commentaries: unknown };
  cricketCompetition.commentaries = { "215040": { id: "215040", shortText: "Patel to Kohli, FOUR", text: "<b>Long commentary</b>", period: 2, over: { actual: 15.4 }, bbbTimestamp: 1774719164000, homeScore: "0", awayScore: "203/4" } };
  const cricket = await fetchEventSummary({ league: "ipl", eventId: "401000001" }, mockFetch({ header: cricketHeader }));
  assert.equal(cricket.event.teams[0].score, "203/4 (15.4/20 ov, target 202)");
  assert.equal(cricket.plays[0].text, "Patel to Kohli, FOUR");
  assert.equal(cricket.plays[0].clock, "15.4 ov");
  assert.equal(cricket.plays[0].period, 2);
  assert.equal(cricket.plays[0].awayScore, undefined);
  assert.ok(cricket.plays[0].wallclock?.endsWith("Z"));
});

test("upstream failures are typed, do not leak response bodies, and are never cached", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return calls === 1 ? new Response("private upstream detail", { status: 429 }) : response({ events: [] }); };
  await assert.rejects(fetchScoreboard({ league: "nba" }, fetcher), (error) => error instanceof EspnProviderError && error.code === "UPSTREAM_HTTP" && error.upstreamStatus === 429 && !error.message.includes("private"));
  await fetchScoreboard({ league: "nba" }, fetcher);
  assert.equal(calls, 2);
  await rejectsCode(fetchScoreboard({ league: "nba" }, async () => { throw new DOMException("aborted", "AbortError"); }), "UPSTREAM_TIMEOUT");
  await rejectsCode(fetchScoreboard({ league: "nba" }, async () => { throw new Error("network credentials should not leak"); }), "UPSTREAM_HTTP");
});

test("malformed JSON, invalid shape, and both declared and streaming oversized payloads are rejected", async () => {
  await rejectsCode(fetchScoreboard({ league: "nba" }, async () => new Response("not json")), "UPSTREAM_INVALID");
  await rejectsCode(fetchScoreboard({ league: "nba" }, mockFetch([])), "UPSTREAM_INVALID");
  await rejectsCode(fetchScoreboard({ league: "nba" }, async () => new Response("{}", { headers: { "content-length": "6000000" } })), "UPSTREAM_INVALID");
  await rejectsCode(fetchScoreboard({ league: "nba" }, async () => new Response(new Uint8Array(5 * 1024 * 1024 + 1))), "UPSTREAM_INVALID");
});
