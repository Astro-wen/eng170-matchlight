import assert from "node:assert/strict";
import test from "node:test";
import { getMatch } from "../lib/matches/data";
import { getPhotoSample, getPhotoSamples, selectPhotoContext, type PhotoContextInput } from "../lib/photo-prototype";

test("photo samples expose bounded pins and explicitly labeled saved historical context", () => {
  const samples = getPhotoSamples();
  assert.equal(samples.length, 2);
  assert.equal(new Set(samples.map((sample) => sample.id)).size, samples.length);
  for (const sample of samples) {
    const match = getMatch(sample.matchId)!;
    assert.equal(match.mode, "historical");
    assert.ok(match.moments.some((moment) => moment.id === sample.momentId));
    assert.equal(new Set(sample.hotspots.map((pin) => pin.id)).size, sample.hotspots.length);
    assert.deepEqual(new Set(sample.hotspots.map((pin) => pin.kind)), new Set(["athlete", "score", "rule"]));
    assert.match(sample.note.en, /preset/i);
    assert.match(sample.note.zh, /预设/);
    assert.match(sample.image, /^\/images\/scan\//);
    for (const pin of sample.hotspots) {
      assert.ok(Number.isFinite(pin.x) && pin.x >= 0 && pin.x <= 1);
      assert.ok(Number.isFinite(pin.y) && pin.y >= 0 && pin.y <= 1);
      assert.ok(pin.label.en && pin.label.zh);
    }
    const context = selectPhotoContext({ source: "sample", sampleId: sample.id });
    assert.equal(context.status, "preset-demo");
    assert.equal(context.source, "sample");
    assert.equal(context.matchId, sample.matchId);
    assert.equal(context.momentId, sample.momentId);
    assert.equal(context.sampleId, sample.id);
  }
});

test("sample lookups and selections cannot mutate saved photo context", () => {
  const first = getPhotoSamples()[0];
  first.title.en = "changed";
  first.hotspots[0].x = 99;
  assert.notEqual(getPhotoSamples()[0].title.en, "changed");
  assert.notEqual(getPhotoSample(first.id)!.hotspots[0].x, 99);
  const sample = getPhotoSample(first.id)!;
  sample.note.en = "changed";
  const selected = selectPhotoContext({ source: "sample", sampleId: first.id });
  selected.note.en = "changed again";
  assert.notEqual(getPhotoSample(first.id)!.note.en, "changed");
  assert.notEqual(selectPhotoContext({ source: "sample", sampleId: first.id }).note.en, "changed again");
  assert.equal(getPhotoSample("constructor"), undefined);
  assert.equal(getPhotoSample("missing"), undefined);
});

test("own uploads and camera photos never automatically acquire a saved match", () => {
  for (const source of ["upload", "camera"] as const) {
    const unlinked = selectPhotoContext({ source });
    assert.equal(unlinked.status, "manual-context");
    assert.equal(unlinked.source, source);
    assert.equal(unlinked.matchId, null);
    assert.equal(unlinked.momentId, null);
    assert.equal(unlinked.sampleId, undefined);
    assert.match(unlinked.note.en, /no automatic match/);
    const manual = selectPhotoContext({ source, matchId: "paris-2024-diving-women-3m", momentId: "paris-2-dive-5" });
    assert.equal(manual.status, "manual-context");
    assert.equal(manual.momentId, "paris-2-dive-5");
    assert.match(manual.note.en, /You selected/);
    assert.match(manual.note.zh, /手动选择/);
    assert.equal(selectPhotoContext({ source, matchId: "paris-2024-diving-women-3m" }).momentId, getMatch("paris-2024-diving-women-3m")!.currentMomentId);
  }
});

test("context selection rejects unknown inputs, foreign moments and misleading sample overrides", () => {
  const invalid: unknown[] = [
    null, [], {}, { source: "recognition" },
    { source: "sample" }, { source: "sample", sampleId: "missing" }, { source: "sample", sampleId: "constructor" },
    { source: "sample", sampleId: "diving-final", matchId: "demo-diving-3m" },
    { source: "sample", sampleId: "diving-final", momentId: "paris-2-dive-5" },
    { source: "upload", sampleId: "diving-final" }, { source: "camera", sampleId: "scoreboard" },
    { source: "upload", matchId: "missing" }, { source: "camera", matchId: "constructor" },
    { source: "upload", momentId: "paris-1-dive-5" },
    { source: "camera", matchId: "paris-2024-diving-women-3m", momentId: "arun-round-5" },
    { source: "upload", matchId: "paris-2024-diving-women-3m", momentId: "missing" },
    { source: "camera", matchId: " " }, { source: "upload", momentId: null },
    { source: "sample", sampleId: 5 },
  ];
  for (const input of invalid) assert.throws(() => selectPhotoContext(input as PhotoContextInput), Error);
  assert.doesNotThrow(() => selectPhotoContext({ source: "sample", sampleId: "diving-final", matchId: "paris-2024-diving-women-3m", momentId: "paris-1-dive-5" }));
});
