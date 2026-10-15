import assert from "node:assert/strict";
import test from "node:test";
import { GET as listMatches } from "../app/api/matches/route";
import { GET as detailMatch } from "../app/api/matches/[id]/route";
import { POST as postExplain } from "../app/api/explain/route";
import { GET as health } from "../app/api/health/route";
import { getMatch, getMatchSummaries, FIXTURE_UPDATED_AT } from "../lib/matches/data";
import { detectFocus, explainMatch, validateExplainRequest, MAX_QUESTION_LENGTH } from "../lib/matches/explain";
import { mapHistoricalDiving } from "../lib/matches/history";
import historicalSnapshot from "../lib/matches/paris-2024-diving.json";
import type { ExplainResponse, MatchDetail, MatchSummary } from "../lib/match-types";

const validBody = { matchId: "demo-diving-3m", question: "How was this score calculated?", locale: "en" as const };
const request = (body: unknown, headers: Record<string, string> = { "Content-Type": "application/json" }) => new Request("http://localhost/api/explain", { method: "POST", headers, body: JSON.stringify(body) });

test("match APIs expose labeled summaries and preserve stable source time on reload", async () => {
  const first = await listMatches();
  assert.equal(first.status, 200);
  const body = await first.json() as { matches: MatchSummary[] };
  assert.equal(body.matches.length, 4);
  assert.equal(body.matches.filter((match: { mode: string }) => match.mode === "demo").length, 3);
  assert.equal(body.matches.some((match) => "moments" in match), false);
  assert.equal(body.matches[0].updatedAt, FIXTURE_UPDATED_AT);
  assert.deepEqual(body, await (await listMatches()).json());
  assert.equal(first.headers.get("Cache-Control"), "no-store");
  const response = await detailMatch(new Request("http://localhost"), { params: Promise.resolve({ id: "demo-diving-3m" }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { match: MatchDetail }).match.currentMomentId, "arun-round-5");
  assert.equal((await detailMatch(new Request("http://localhost"), { params: Promise.resolve({ id: "missing" }) })).status, 404);
});

test("all fixtures have resolvable moments and source references; callers cannot mutate data", () => {
  for (const summary of getMatchSummaries()) {
    const match = getMatch(summary.id)!;
    assert.ok(match.moments.some((moment) => moment.id === match.currentMomentId));
    const sources = new Set(match.sources.map((source) => source.id));
    for (const rule of match.rules) assert.ok(sources.has(rule.sourceId));
    for (const moment of match.moments) {
      const answer = explainMatch({ ...validBody, matchId: match.id, momentId: moment.id });
      assert.ok(answer.answer.length > 0);
      assert.equal(answer.dataMode, match.mode);
      for (const id of answer.sourceIds) assert.ok(sources.has(id));
    }
    match.moments[0].athlete = "mutated";
    assert.notEqual(getMatch(match.id)!.moments[0].athlete, "mutated");
  }
});

test("historical adapter uses real final totals and valid provider result time", () => {
  const match = getMatch("paris-2024-diving-women-3m")!;
  assert.equal(match.mode, "historical");
  assert.equal(match.status, "finished");
  assert.equal(match.updatedAt, "2024-08-09T13:00:23Z");
  assert.equal(match.leaderboard.length, 12);
  assert.equal(match.leaderboard[0].name, "CHEN Yiwen");
  assert.equal(match.leaderboard[0].score, "376.00");
  const invalid = structuredClone(historicalSnapshot);
  invalid.Results[0].Dives[0].DivePoints = "99.00";
  assert.throws(() => mapHistoricalDiving(invalid), /points do not match/);
  invalid.Results = structuredClone(historicalSnapshot.Results);
  invalid.EventResultUtcDateTime = "0001-01-01T00:00:00";
  assert.throws(() => mapHistoricalDiving(invalid), /timestamp is invalid/);
});

test("score explanation returns exact calculation in both locales without judging speculation", async () => {
  for (const locale of ["en", "zh"] as const) {
    const response = await postExplain(request({ ...validBody, locale }));
    assert.equal(response.status, 200);
    const body = await response.json() as ExplainResponse;
    assert.equal(body.mode, "grounded-demo");
    assert.equal(body.dataMode, "demo");
    assert.equal(body.breakdown[3].value, "23.5 × 3.0 = 70.50");
    assert.match(body.answer, /cannot tell us why|无法知道/);
    assert.equal(body.updatedAt, FIXTURE_UPDATED_AT);
  }
  const body = explainMatch({ ...validBody, question: "Was there a splash deduction?" });
  assert.match(body.answer, /cannot identify a splash/);
});

test("historical explanation and guidance do not fabricate a next round or fictional results", () => {
  const requestBody = { ...validBody, matchId: "paris-2024-diving-women-3m" };
  const body = explainMatch(requestBody);
  assert.equal(body.dataMode, "historical");
  assert.match(body.answer, /official historical record/);
  assert.match(body.answer, /76.50/);
  assert.match(body.watchNext, /final is over/);
  const standings = explainMatch({ ...requestBody, momentId: "paris-3-dive-1", question: "Who won?" });
  assert.match(standings.answer, /CHEN Yiwen finished first on 376.00/);
  assert.match(standings.answer, /selected moment can be from an earlier dive/);
});

test("earlier swimming and cricket moments use their own split or balls remaining", () => {
  const split = explainMatch({ ...validBody, matchId: "demo-swimming-100free", momentId: "maya-50m" });
  assert.match(split.answer, /split time, not a finishing result/);
  assert.equal(split.breakdown[2].value, "24.92 − 24.81 = 0.11 s");
  const boundary = explainMatch({ ...validBody, matchId: "demo-cricket-chase", momentId: "noah-boundary" });
  assert.equal(boundary.breakdown[2].value, "21 runs from 15 legal balls");
  assert.equal(boundary.breakdown[3].value, "8.40");
  const wicket = explainMatch({ ...validBody, matchId: "demo-cricket-chase", momentId: "noah-wicket" });
  assert.equal(wicket.breakdown[2].value, "21 runs from 14 legal balls");
  assert.equal(wicket.breakdown[3].value, "9.00");
  const remaining = explainMatch({ ...validBody, matchId: "demo-cricket-chase", momentId: "noah-dot", question: "How many legal balls are left at this moment?" });
  assert.match(remaining.answer, /25 runs from 16 legal balls/);
  assert.match(remaining.watchNext, /25 runs from 16 legal balls/);
  const penalty = explainMatch({ ...validBody, matchId: "demo-cricket-chase", momentId: "noah-dot", question: "Was this a penalty?" });
  assert.doesNotMatch(penalty.answer, /bowled/);
  assert.match(penalty.answer, /136\/3/);
});

test("unsupported questions and predictions are explicit about coverage", () => {
  for (const question of ["Why is the sky blue?", "Explain quantum physics", "Tell me an athlete biography", "What are the latest live scores?", "Explain basketball rules", "What should I watch on Netflix?"]) {
    assert.equal(detectFocus(question), "unsupported");
    const body = explainMatch({ ...validBody, question });
    assert.match(body.answer, /has no general knowledge/);
    assert.deepEqual(body.breakdown, []);
  }
  assert.equal(detectFocus("Explain this"), "scoring");
  assert.equal(detectFocus("这个分数怎么计算？"), "scoring");
  assert.deepEqual(explainMatch({ ...validBody, question: "How do cricket runs work?" }).breakdown, []);
  const prediction = explainMatch({ ...validBody, question: "Who will win?" });
  assert.match(prediction.answer, /does not calculate odds or predict/);
  assert.match(prediction.answer, /not a final result/);
});

test("API rejects invalid JSON, locale, excessive question, foreign moments and unknown matches", async () => {
  const badJson = new Request("http://localhost/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal((await postExplain(badJson)).status, 400);
  for (const body of [null, [], { ...validBody, locale: "fr" }, { ...validBody, question: " " }, { ...validBody, question: "a".repeat(MAX_QUESTION_LENGTH + 1) }, { ...validBody, momentId: null }, { ...validBody, other: true }, { ...validBody, matchId: "../secrets" }]) {
    assert.equal((await postExplain(request(body))).status, 400);
    assert.throws(() => validateExplainRequest(body));
  }
  assert.equal((await postExplain(request({ ...validBody, matchId: "missing" }))).status, 404);
  assert.equal((await postExplain(request({ ...validBody, momentId: "maya-finish" }))).status, 404);
  assert.equal((await postExplain(request(validBody, { "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await postExplain(request({ ...validBody, question: "字".repeat(5000) }))).status, 413);
  assert.equal((await postExplain(request(validBody, { "Content-Type": "application/json", "Content-Length": "99999" }))).status, 413);
});

test("health accurately reports unavailable photo/decision providers without secrets", async () => {
  assert.deepEqual(await (await health()).json(), { ok: true, version: "0.2.0", aiConfigured: false, photoAnalysisConfigured: false, decisionConfigured: false });
});
