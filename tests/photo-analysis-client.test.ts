import { strict as assert } from "node:assert";
import { test } from "node:test";
import { captureDateInput, captureDateISO, fitAnalysisImage, PhotoAnalysisError, requestPhotoAnalysis } from "../lib/photo-analysis-client";
import type { AnalyzeRequest, AnalyzeResult } from "../lib/analysis/types";

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
  imageDataUrl: "data:image/jpeg;base64,cGhvdG8=", capturedAt: "2024-08-09T13:00:00.000Z", timeZone: "America/Los_Angeles", locale: "zh", hint: "Paris 2024", selectedEvent: { league: "nba", eventId: "401" },
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
