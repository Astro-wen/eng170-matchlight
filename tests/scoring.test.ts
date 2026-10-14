import assert from "node:assert/strict";
import test from "node:test";
import { cricketBallsBowled, cricketChase, scoreIndividualDive, swimmingTimeHundredths } from "../lib/matches/scoring";
import snapshot from "../lib/matches/paris-2024-diving.json";

test("seven-judge scoring discards precisely four awards and multiplies three retained", () => {
  const result = scoreIndividualDive([7, 7.5, 7.5, 8, 8, 8.5, 9], 3);
  assert.deepEqual(result.retained.map((judge) => judge.score), [7.5, 8, 8]);
  assert.deepEqual(result.discarded.map((judge) => judge.score), [7, 7.5, 8.5, 9]);
  assert.equal(result.sum, 23.5);
  assert.equal(result.formatted, "70.50");
});

test("ties retain three judges and input order is unchanged", () => {
  const scores = Array(7).fill(8);
  const result = scoreIndividualDive(scores, 3.2);
  assert.equal(result.retained.length, 3);
  assert.equal(result.discarded.length, 4);
  assert.equal(result.formatted, "76.80");
  assert.deepEqual(scores, Array(7).fill(8));
  assert.equal(new Set([...result.retained, ...result.discarded].map((judge) => judge.index)).size, 7);
});

test("invalid scoring records are rejected instead of silently inferred", () => {
  for (const scores of [[8, 8, 8], [8, 8, 8, 8, 8, 8, 10.5], [8, 8, 8, 8, 8, 8, 7.3], [8, 8, 8, 8, 8, 8, NaN]]) {
    assert.throws(() => scoreIndividualDive(scores, 3), RangeError);
  }
  for (const difficulty of [0, -1, Infinity, 3.14]) assert.throws(() => scoreIndividualDive(Array(7).fill(8), difficulty), RangeError);
});

test("formula reproduces all sixty official Paris final dives and running totals", () => {
  let dives = 0;
  for (const athlete of snapshot.Results) {
    let total = 0;
    for (const dive of athlete.Dives) {
      const computed = scoreIndividualDive(dive.JudgesScores.map((judge) => Number(judge.Score)), Number(dive.DD));
      assert.equal(computed.formatted, dive.DivePoints, `${athlete.FullName} round ${dive.DiveOrder}`);
      total += Math.round(computed.points * 100);
      assert.equal((total / 100).toFixed(2), dive.TotalPoints);
      dives++;
    }
    assert.equal((total / 100).toFixed(2), athlete.TotalPoints);
  }
  assert.equal(dives, 60);
});

test("cricket reads legal deliveries in base-six scorecard notation", () => {
  assert.equal(cricketBallsBowled("17.4"), 106);
  assert.deepEqual(cricketChase(161, 140, "17.4"), { runsNeeded: 21, ballsRemaining: 14, requiredRunRate: 9 });
  assert.deepEqual(cricketChase(161, 140, "17.3"), { runsNeeded: 21, ballsRemaining: 15, requiredRunRate: 8.4 });
  assert.equal(cricketChase(161, 140, "20.0").requiredRunRate, null);
  assert.equal(cricketChase(161, 161, "20.0").requiredRunRate, 0);
  for (const overs of ["17.6", "17.8", "17.40", "-1.0", "17", "17.3abc"]) assert.throws(() => cricketBallsBowled(overs), RangeError);
  assert.throws(() => cricketChase(161, 140, "20.1"), RangeError);
});

test("swimming gaps use exact displayed hundredths", () => {
  assert.equal(swimmingTimeHundredths("49.70") - swimmingTimeHundredths("49.62"), 8);
  assert.equal(swimmingTimeHundredths("1:50.04"), 11004);
  assert.equal(swimmingTimeHundredths("24.92") - swimmingTimeHundredths("24.81"), 11);
  for (const value of ["49.7", "49.700", "1:60.00", "NaN", "-49.62"]) assert.throws(() => swimmingTimeHundredths(value), RangeError);
});
