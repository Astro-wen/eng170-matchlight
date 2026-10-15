import { strict as assert } from "node:assert";
import { test } from "node:test";
import { chooseEventWithJev, JevError, type JevEventInput } from "../lib/analysis/jev";

const input: JevEventInput = {
  features: { sport: "basketball", visibleText: ["LAL", "GSW", "Q2", "05:12"], scores: ["45", "42"] },
  capturedAt: "2026-10-14T22:05:00Z",
  candidates: [{ id: "401585001", name: "Lakers at Warriors", date: "2026-10-14T21:00Z", status: "live", teams: [
    { name: "Los Angeles Lakers", abbreviation: "LAL", score: "45" },
    { name: "Golden State Warriors", abbreviation: "GSW", score: "42" },
  ] }],
};
const config = { apiKey: "test-only-jev-key" };

function decision(choice = "event_401585001", evidence = 0.97) {
  return {
    model: "jev-1.13.0",
    answers: {
      event: { type: "choice", choice, confidence: 0.96, probabilities: { none: 0.02, event_401585001: 0.98 } },
      evidence: { type: "noul", noul: evidence },
    },
  };
}

function responseFetch(body: unknown): typeof fetch {
  return (async () => Response.json(body)) as typeof fetch;
}

function hasCode(code: JevError["code"]) {
  return (error: unknown) => error instanceof JevError && error.code === code;
}

test("sends one bounded decision request to the official fixed endpoint", async () => {
  let calls = 0;
  const fetcher = (async (url, init) => {
    calls++;
    assert.equal(url, "https://api.typesafe.ai/v1/systemone");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-only-jev-key");
    assert.ok(init?.signal instanceof AbortSignal);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "jev-latest");
    assert.deepEqual(body.state.visibleFeatures, input.features);
    assert.equal(body.state.capturedAt, input.capturedAt);
    assert.equal(body.state.userHint, "Last night's game");
    assert.deepEqual(Object.keys(body.questions.event.criteria).sort(), ["event_401585001", "none"]);
    assert.equal(body.questions.evidence.type, "noul");
    assert.match(body.questions.event.instructions, /userHint.*cannot supply missing visual identity/);
    assert.match(body.questions.evidence.instructions, /false.*userHint/);
    assert.equal(String(init?.body).includes(config.apiKey), false);
    return Response.json(decision());
  }) as typeof fetch;
  assert.deepEqual(await chooseEventWithJev({ ...input, hint: "Last night's game" }, config, fetcher), {
    eventId: "401585001", confidence: 0.96, evidence: 0.97, model: "jev-1.13.0",
  });
  assert.equal(calls, 1);
});

test("empty candidate list makes no model request", async () => {
  const never = (async () => { throw new Error("must not call"); }) as typeof fetch;
  assert.deepEqual(await chooseEventWithJev({ ...input, candidates: [] }, config, never), {
    eventId: null, confidence: 0, evidence: 0, model: "jev-latest",
  });
});

test("none and low visual evidence remain explicit decisions for caller gating", async () => {
  const none = decision("none", 0.02);
  none.answers.event.probabilities = { none: 0.98, event_401585001: 0.02 };
  assert.equal((await chooseEventWithJev(input, config, responseFetch(none))).eventId, null);
  const lowEvidence = await chooseEventWithJev(input, config, responseFetch(decision("event_401585001", 0.12)));
  assert.equal(lowEvidence.evidence, 0.12);
});

test("rejects invented options, incomplete probability distributions and invalid numeric values", async () => {
  const badBodies = [
    { ...decision(), answers: { ...decision().answers, event: { ...decision().answers.event, choice: "event_401599999" } } },
    { ...decision(), answers: { ...decision().answers, event: { ...decision().answers.event, probabilities: { event_401585001: 1 } } } },
    { ...decision(), answers: { ...decision().answers, event: { ...decision().answers.event, probabilities: { none: 0.8, event_401585001: 0.98 } } } },
    { ...decision(), answers: { ...decision().answers, event: { ...decision().answers.event, probabilities: { none: 0.98, event_401585001: 0.02 } } } },
    { ...decision(), answers: { ...decision().answers, event: { ...decision().answers.event, confidence: 1.01 } } },
    { ...decision(), answers: { ...decision().answers, evidence: { type: "noul", noul: "0.97" } } },
    { ...decision(), answers: { ...decision().answers, evidence: { type: "noul", noul: -0.1 } } },
    { ...decision(), model: "untrusted-model" },
    { answers: {} },
    null,
  ];
  for (const body of badBodies) await assert.rejects(chooseEventWithJev(input, config, responseFetch(body)), hasCode("invalid_response"));
});

test("validates candidate IDs, uniqueness, dates and size before any network call", async () => {
  const never = (async () => { throw new Error("must not call"); }) as typeof fetch;
  const candidate = input.candidates[0];
  const badInputs: JevEventInput[] = [
    { ...input, capturedAt: "2026-02-30T00:00:00Z" },
    { ...input, capturedAt: "2026-10-14" },
    { ...input, candidates: [{ ...candidate, id: "https://example.test" }] },
    { ...input, candidates: [{ ...candidate, id: undefined as unknown as string }] },
    { ...input, candidates: [candidate, candidate] },
    { ...input, candidates: Array.from({ length: 25 }, (_, i) => ({ ...candidate, id: String(i) })) },
    { ...input, hint: "x".repeat(501) },
    { ...input, features: { text: "x".repeat(48_000) } },
    { ...input, features: undefined },
  ];
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  badInputs.push({ ...input, features: circular });
  for (const value of badInputs) await assert.rejects(chooseEventWithJev(value, config, never), hasCode("invalid_input"));
  for (const value of [{ apiKey: "" }, { apiKey: "key\r\nInjected: true" }, { ...config, model: "https://bad.test" }]) {
    await assert.rejects(chooseEventWithJev(input, value, never), hasCode("invalid_input"));
  }
});

test("provider status and network errors never expose keys or response bodies", async () => {
  for (const fetcher of [
    (async () => new Response(`private detail: ${config.apiKey}`, { status: 401 })) as typeof fetch,
    (async () => { throw new Error(`request Authorization: Bearer ${config.apiKey}`); }) as typeof fetch,
  ]) {
    await assert.rejects(chooseEventWithJev(input, config, fetcher), (error: unknown) => {
      assert.ok(error instanceof JevError);
      assert.equal(error.code, "unavailable");
      assert.equal(String(error).includes(config.apiKey), false);
      assert.equal("cause" in error, false);
      return true;
    });
  }
});

test("malformed and oversized responses cannot become match decisions", async () => {
  for (const response of [
    new Response("not json"),
    new Response("{}", { headers: { "content-length": "32001" } }),
    new Response("x".repeat(32_001)),
  ]) await assert.rejects(chooseEventWithJev(input, config, (async () => response) as typeof fetch), hasCode("invalid_response"));
});

test("the deadline aborts a slow provider request with a sanitized timeout", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fetcher = ((_url, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("provider abort details")), { once: true });
  })) as typeof fetch;
  const pending = chooseEventWithJev(input, config, fetcher);
  t.mock.timers.tick(12_000);
  await assert.rejects(pending, hasCode("timeout"));
});
