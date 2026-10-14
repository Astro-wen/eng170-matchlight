import { strict as assert } from "node:assert";
import { test } from "node:test";
import { enhanceExplanation, getAIConfig } from "../lib/ai-explanation";
import type { ExplainRequest, ExplainResponse, MatchDetail } from "../lib/match-types";

const request: ExplainRequest = { matchId: "demo", question: "How was this scored?", locale: "en" };
const match = { sport: "diving", title: { en: "Demo", zh: "示例" }, mode: "demo", status: "in_progress", moments: [], currentMomentId: "", leaderboard: [], rules: [], sources: [] } as unknown as MatchDetail;
const grounded: ExplainResponse = {
  headline: "A score explained", answer: "The verified answer.", breakdown: [{ label: "Score", value: "70.50" }],
  watchNext: "Watch the next dive.", sourceIds: ["rule"], mode: "grounded-demo", dataMode: "demo", updatedAt: "2026-10-14T00:00:00Z",
};
const config = { apiKey: "test-only", model: "test-model", baseUrl: "https://example.test/v1" };

test("requires both a key and explicit model; rejects insecure or credential-bearing URLs", () => {
  assert.equal(getAIConfig({ MATCHLIGHT_AI_API_KEY: "test" }), null);
  assert.equal(getAIConfig({ MATCHLIGHT_AI_API_KEY: "test", MATCHLIGHT_AI_MODEL: "model", MATCHLIGHT_AI_BASE_URL: "http://example.test" }), null);
  assert.equal(getAIConfig({ MATCHLIGHT_AI_API_KEY: "test", MATCHLIGHT_AI_MODEL: "model", MATCHLIGHT_AI_BASE_URL: "https://secret@example.test" }), null);
  assert.equal(getAIConfig({ OPENAI_API_KEY: "test", MATCHLIGHT_AI_MODEL: "model" })?.baseUrl, "https://api.openai.com/v1");
});

test("no-key demo never makes a provider request", async () => {
  const fetcher = (async () => { throw new Error("must not fetch"); }) as typeof fetch;
  assert.equal(await enhanceExplanation(request, match, grounded, null, fetcher), grounded);
});

test("model prose retains server-verified calculation and provenance", async () => {
  const fetcher = (async (url, init) => {
    assert.equal(url, "https://example.test/v1/chat/completions");
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.store, false);
    assert.equal(payload.response_format.json_schema.strict, true);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ headline: "Readable", answer: "Clear explanation.", sourceIds: ["rule"] }) } }] });
  }) as typeof fetch;
  const result = await enhanceExplanation(request, match, grounded, config, fetcher);
  assert.equal(result.mode, "ai");
  assert.equal(result.answer, grounded.answer);
  assert.equal(result.headline, grounded.headline);
  assert.equal(result.aiSummary, "Clear explanation.");
  assert.deepEqual(result.sourceIds, grounded.sourceIds);
  assert.deepEqual(result.breakdown, grounded.breakdown);
  assert.equal(result.dataMode, "demo");
  assert.equal(result.updatedAt, grounded.updatedAt);
});

test("rejects contradictory numbers, invented judging causes and wrong event state", async () => {
  for (const answer of ["Arun scored 99.00.", "A poor entry reduced the score.", "Arun wins; the final is over.", "因为水花大扣分。"] ) {
    const fetcher = (async () => Response.json({ choices: [{ message: { content: JSON.stringify({ headline: "H", answer, sourceIds: ["rule"] }) } }] })) as typeof fetch;
    assert.equal(await enhanceExplanation(request, match, grounded, config, fetcher), grounded);
  }
});

test("cannot strip a data citation from the authoritative answer", async () => {
  const original = { ...grounded, sourceIds: ["demo", "rule"] };
  const fetcher = (async () => Response.json({ choices: [{ message: { content: JSON.stringify({ headline: "H", answer: "A readable paraphrase.", sourceIds: ["rule"] }) } }] })) as typeof fetch;
  const result = await enhanceExplanation(request, match, original, config, fetcher);
  assert.deepEqual(result.sourceIds, ["demo", "rule"]);
  assert.equal(result.answer, original.answer);
});

test("preserves explicit evidence limitations", async () => {
  const original = { ...grounded, answer: "We cannot infer the cause from scores." };
  const fetcher = (async () => Response.json({ choices: [{ message: { content: JSON.stringify({ headline: "H", answer: "The judge marked it down.", sourceIds: ["rule"] }) } }] })) as typeof fetch;
  assert.equal(await enhanceExplanation(request, match, original, config, fetcher), original);
});

test("provider errors, refusals, malformed data and invented citations fall back", async () => {
  for (const response of [
    new Response("error", { status: 429 }),
    Response.json({ choices: [{ message: { refusal: "No" } }] }),
    Response.json({ choices: [{ message: { content: "not json" } }] }),
    Response.json({ choices: [{ message: { content: JSON.stringify({ headline: "H", answer: "A", sourceIds: ["made-up"] }) } }] }),
  ]) {
    const fetcher = (async () => response) as typeof fetch;
    assert.equal(await enhanceExplanation(request, match, grounded, config, fetcher), grounded);
  }
});
