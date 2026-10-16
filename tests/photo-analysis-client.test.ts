import { strict as assert } from "node:assert";
import { test } from "node:test";
import { captureDateInput, captureDateISO, fitAnalysisImage, PhotoAnalysisError, requestPhotoAnalysis, safeAthleteImage, requestLiveEvents, liveEventScorecard, type LiveEventsResponse } from "../lib/photo-analysis-client";
import type { AnalysisEvent, AnalyzeRequest, AnalyzeResult } from "../lib/analysis/types";

test("image resize bounds upload size while keeping the full photo and aspect ratio", () => {
  assert.deepEqual(fitAnalysisImage(4000, 2000), { width: 1600, height: 800 });
  assert.deepEqual(fitAnalysisImage(1200, 2400), { width: 800, height: 1600 });
  assert.deepEqual(fitAnalysisImage(640, 480), { width: 640, height: 480 });
  assert.throws(() => fitAnalysisImage(0, 20));
  assert.throws(() => fitAnalysisImage(NaN, 20));
});

test("capture date preserves local wall time and rejects invalid event dates", () => {
  const local = new Date(2024, 7, 9, 13, 15);
  assert.equal(captureDateInput(local), "2024-08-09T13:15");
  assert.equal(captureDateISO("2024-08-09T13:15"), local.toISOString());
  assert.equal(captureDateISO("2024-02-30T13:15"), null);
  assert.equal(captureDateISO("2024-08-09T25:15"), null);
  assert.equal(captureDateISO("2024-08-09"), null);
  assert.equal(captureDateISO(""), null);
});

const request: AnalyzeRequest = {
  mode: "replay", imageDataUrl: "data:image/jpeg;base64,cGhvdG8=", capturedAt: "2024-08-09T13:00:00.000Z", timeZone: "America/Los_Angeles", locale: "zh", hint: "Paris 2024", selectedEvent: { league: "nba", eventId: "401" },
};
test("analysis request sends image, real capture context and explicit candidate selection together", async () => {
  const controller = new AbortController();
  const response: AnalyzeResult = {
    id: "photo-1", generatedAt: request.capturedAt, capturedAt: request.capturedAt,
    outcome: "needs_confirmation", matchMethod: "none", headline: "A basketball game", message: "Confirm the teams.",
    features: { sport: "basketball", league: "nba", visibleText: [], teams: [], athletes: [], scores: [], clock: null, period: null, explicitDate: null, observations: [], limitations: [] },
    event: null, candidates: [], points: [], sources: [], temporal: "historical", moment: null, trace: [], models: { vision: "vision", decision: null, explanation: null },
  };
  const fetcher = (async (url, init) => {
    assert.equal(url, "/api/analyze");
    assert.equal(init?.method, "POST");
    assert.equal(init?.signal, controller.signal);
    assert.deepEqual(JSON.parse(String(init?.body)), request);
    assert.equal(new Headers(init?.headers).get("Content-Type"), "application/json");
    return Response.json(response);
  }) as typeof fetch;
  assert.deepEqual(await requestPhotoAnalysis(request, controller.signal, fetcher), response);
});

test("provider errors remain actionable and malformed successful responses cannot become results", async () => {
  const signal = new AbortController().signal;
  await assert.rejects(requestPhotoAnalysis(request, signal, (async () => Response.json({ error: "Add a team name", code: "VISION_UNAVAILABLE" }, { status: 503 })) as typeof fetch), (error: unknown) => error instanceof PhotoAnalysisError && error.message === "Add a team name" && error.code === "VISION_UNAVAILABLE");
  await assert.rejects(requestPhotoAnalysis(request, signal, (async () => new Response("offline", { status: 502 })) as typeof fetch), /ANALYSIS_FAILED/);
  await assert.rejects(requestPhotoAnalysis(request, signal, (async () => Response.json({ ok: true })) as typeof fetch), /INVALID_RESPONSE/);
  await assert.rejects(requestPhotoAnalysis(request, signal, (async () => Response.json({ outcome: "matched", features: {}, points: [] })) as typeof fetch), /INVALID_RESPONSE/);
});

function individualResult(): AnalyzeResult {
  const athlete = { id: "chen", name: "CHEN Yiwen", country: "CHN", rank: 1, score: "376.00", profileUrl: "https://www.worldaquatics.com/athletes/1028322/wd" };
  return {
    id: "individual-photo", generatedAt: request.capturedAt, capturedAt: request.capturedAt,
    outcome: "matched", matchMethod: "jev", headline: "Women's 3m final", message: "Published results.",
    features: { sport: "diving", league: null, visibleText: ["76.50"], teams: [], athletes: ["CHEN Yiwen"], scores: ["76.50"], clock: null, period: null, explicitDate: null, observations: [], limitations: [] },
    event: { id: "final", league: "olympics", sport: "diving", name: "Women's 3m final", date: request.capturedAt, status: "final", teams: [], competitors: [athlete, { id: "unknown", name: "Another finalist" }], provider: "worldaquatics", phase: "Final", dataMode: "historical" },
    candidates: [], points: [{ id: "athlete", kind: "athlete", x: .4, y: .5, title: "Meet the athlete", summary: athlete.name, detail: "Official record", evidence: "provider", sourceIds: ["record"], athlete }, { id: "rule", kind: "rule", x: .6, y: .7, title: "How scoring works", summary: "Official rules", detail: "Seven awards, three retained", evidence: "rule", sourceIds: ["rule"] }],
    sources: [{ id: "record", label: "World Aquatics", url: "https://www.worldaquatics.com", fetchedAt: request.capturedAt }, { id: "rule", label: "Diving rules", url: "https://www.worldaquatics.com/rules", fetchedAt: request.capturedAt, kind: "rule" }],
    temporal: "historical", moment: null, trace: [], models: { vision: "vision", decision: "jev", explanation: null }, coverage: { sport: "diving", label: "Historical result", detail: "Paris 2024 final" }, limitations: ["The photo cannot establish a deduction cause."],
  };
}

test("individual results preserve country, missing placings, athlete cards and distinct official rule evidence", async () => {
  const response = individualResult();
  const received = await requestPhotoAnalysis(request, new AbortController().signal, (async () => Response.json(response)) as typeof fetch);
  assert.deepEqual(received, response);
  assert.equal(received.event?.competitors?.[1].rank, undefined);
  assert.equal(received.event?.competitors?.[1].score, undefined);
  assert.equal(received.points[1].evidence, "rule");
});

test("invalid individual metadata cannot render as a successful provider result", async () => {
  const response = individualResult();
  const fetcher = (async () => Response.json(response)) as typeof fetch;
  response.event!.competitors![0].rank = 0;
  await assert.rejects(requestPhotoAnalysis(request, new AbortController().signal, fetcher), /INVALID_RESPONSE/);
  response.event!.competitors![0].rank = 1;
  (response.points[0].athlete as unknown as { name: unknown }).name = { invented: true };
  await assert.rejects(requestPhotoAnalysis(request, new AbortController().signal, fetcher), /INVALID_RESPONSE/);
});

test("athlete portraits allow only HTTPS sports provider image hosts", () => {
  assert.equal(safeAthleteImage("https://a.espncdn.com/i/headshots/olympics/players/full/1.png"), "https://a.espncdn.com/i/headshots/olympics/players/full/1.png");
  assert.equal(safeAthleteImage("https://resources.fina.org/profile.png"), "https://resources.fina.org/profile.png");
  for (const value of ["http://a.espncdn.com/image.png", "https://a.espncdn.com.attacker.test/image.png", "https://secret@a.espncdn.com/image.png", "https://attacker.test/image.png", "/arbitrary-local-file.png", undefined]) assert.equal(safeAthleteImage(value), undefined);
});

test("a photo analysis without an explicit mode always sends live mode", async () => {
  const fetcher = (async (_url, init) => {
    assert.equal(JSON.parse(String(init?.body)).mode, "live");
    return Response.json(individualResult());
  }) as typeof fetch;
  await requestPhotoAnalysis({ ...request, mode: undefined }, new AbortController().signal, fetcher);
});

test("live discovery metadata and every supplied statistic survive response validation", async () => {
  const response: AnalyzeResult = { ...individualResult(), mode: "live", matchMethod: "current", discovery: { checkedAt: request.capturedAt, activeCount: 3, status: "ambiguous", detail: "Three current matches need checking." }, statistics: [{ label: "Runs", value: "142/4", subject: "Australia" }, { label: "Overs", value: "18.2" }] };
  const received = await requestPhotoAnalysis(request, new AbortController().signal, (async () => Response.json(response)) as typeof fetch);
  assert.deepEqual(received.discovery, response.discovery);
  assert.deepEqual(received.statistics, response.statistics);
  response.discovery!.activeCount = -1;
  await assert.rejects(requestPhotoAnalysis(request, new AbortController().signal, (async () => Response.json(response)) as typeof fetch), /INVALID_RESPONSE/);
  response.discovery!.activeCount = 3;
  (response.statistics![0] as unknown as { value: unknown }).value = 142;
  await assert.rejects(requestPhotoAnalysis(request, new AbortController().signal, (async () => Response.json(response)) as typeof fetch), /INVALID_RESPONSE/);
});

const currentEvent: AnalysisEvent = {
  id: "live-event", league: "icc-t20", sport: "cricket", name: "Australia Women vs India Women", date: "2026-10-16T08:00:00.000Z", status: "live", statusDetail: "India Women need 25 runs in 12 balls", provider: "espn",
  teams: [{ id: "aus", name: "Australia Women", abbreviation: "AUS-W", score: "164/5 (20)", homeAway: "home" }, { id: "ind", name: "India Women", abbreviation: "IND-W", score: "140/4 (18)", homeAway: "away" }],
};
const currentResponse: LiveEventsResponse = { events: [currentEvent], sources: [{ id: "espn-current", label: "ESPN current cricket", url: "https://www.espn.com/cricket/", fetchedAt: "2026-10-16T10:05:00.000Z" }], checkedAt: "2026-10-16T10:05:00.000Z", status: "ok", limited: false };

test("current sample makes a read-only uncached cricket query without paid image analysis", async () => {
  const signal = new AbortController().signal;
  const fetcher = (async (url, init) => {
    assert.equal(url, "/api/live-events?sport=cricket");
    assert.equal(init?.signal, signal);
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.method, undefined);
    assert.equal(init?.body, undefined);
    return Response.json(currentResponse);
  }) as typeof fetch;
  assert.deepEqual(await requestLiveEvents(signal, fetcher), currentResponse);
});

test("unavailable, unsupported and unknown current feeds cannot silently become a live match sample", async () => {
  const signal = new AbortController().signal;
  for (const status of ["unavailable", "unsupported"] as const) {
    const response = { ...currentResponse, events: [], status, limited: true };
    assert.equal((await requestLiveEvents(signal, (async () => Response.json(response)) as typeof fetch)).status, status);
  }
  await assert.rejects(requestLiveEvents(signal, (async () => Response.json(currentResponse, { status: 503 })) as typeof fetch), /LIVE_UNAVAILABLE/);
  await assert.rejects(requestLiveEvents(signal, (async () => Response.json({ ...currentResponse, events: [{ ...currentEvent, teams: [{}] }] })) as typeof fetch), /INVALID_RESPONSE/);
  for (const status of ["unknown", "scheduled", "final"] as const) assert.throws(() => liveEventScorecard({ ...currentEvent, status }, currentResponse.checkedAt), /LIVE_NONE_CONFIRMED/);
});

test("current scorecard uses complete returned team names, scores and check date with honest provenance", () => {
  const svg = liveEventScorecard(currentEvent, currentResponse.checkedAt);
  for (const text of ["Australia Women", "India Women", "164/5 (20)", "140/4 (18)", "2026-10-16", "2026-10-16T10:05:00.000Z", "RECREATED FROM ESPN CURRENT DATA", "NOT A CAMERA PHOTO"]) assert.ok(svg.includes(text), text);
  const escaped = liveEventScorecard({ ...currentEvent, name: '<script>alert("match")</script>', teams: [{ ...currentEvent.teams[0], name: 'A & B <team>' }, currentEvent.teams[1]] }, currentResponse.checkedAt);
  assert.ok(escaped.includes("A &amp; B &lt;team&gt;"));
  assert.ok(!escaped.includes("<script>"));
  assert.throws(() => liveEventScorecard(currentEvent, "invalid date"), /LIVE_NONE_CONFIRMED/);
});
