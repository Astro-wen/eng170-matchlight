/** Individual diving with a seven-judge panel; not synchronised or high diving. */
export function scoreIndividualDive(judgeScores: number[], difficulty: number) {
  if (judgeScores.length !== 7) {
    throw new RangeError("Individual diving requires exactly seven judge scores.");
  }
  if (judgeScores.some((score) => !Number.isFinite(score) || score < 0 || score > 10 || !Number.isInteger(score * 2))) {
    throw new RangeError("Judge scores must be between 0 and 10 in half-point increments.");
  }
  if (!Number.isFinite(difficulty) || difficulty <= 0 || difficulty > 10 || Math.abs(difficulty * 10 - Math.round(difficulty * 10)) > 1e-8) {
    throw new RangeError("Difficulty must be positive and use one decimal place.");
  }
  // Keep original judge positions. Ties discard exactly two on each end.
  const sorted = judgeScores.map((score, index) => ({ score, index })).sort((a, b) => a.score - b.score || a.index - b.index);
  const retained = sorted.slice(2, 5);
  const discarded = [...sorted.slice(0, 2), ...sorted.slice(5)];
  const totalHalfPoints = retained.reduce((total, judge) => total + judge.score * 2, 0);
  // Integer arithmetic prevents 22.0 * 3.2 becoming 70.40000000000001.
  const cents = totalHalfPoints * Math.round(difficulty * 10) * 5;
  return {
    retained,
    discarded,
    sum: totalHalfPoints / 2,
    points: cents / 100,
    formatted: (cents / 100).toFixed(2),
  };
}

/** Scorecard over notation is base-six deliveries, never a decimal fraction. */
export function cricketBallsBowled(overs: string): number {
  const match = /^(\d{1,3})\.([0-5])$/.exec(overs);
  if (!match) throw new RangeError("Overs must use completed-overs.legal-balls notation (e.g. 17.4).");
  return Number(match[1]) * 6 + Number(match[2]);
}

export function cricketChase(target: number, runs: number, overs: string, allocatedOvers = 20) {
  if (![target, runs, allocatedOvers].every(Number.isSafeInteger) || target <= 0 || runs < 0 || allocatedOvers <= 0) {
    throw new RangeError("A chase requires valid non-negative integer scores and an over allocation.");
  }
  const ballsBowled = cricketBallsBowled(overs);
  const ballsRemaining = allocatedOvers * 6 - ballsBowled;
  if (ballsRemaining < 0) throw new RangeError("Overs exceed the innings allocation.");
  const runsNeeded = Math.max(0, target - runs);
  return {
    runsNeeded,
    ballsRemaining,
    requiredRunRate: runsNeeded === 0 ? 0 : ballsRemaining === 0 ? null : Math.round((runsNeeded * 6 / ballsRemaining) * 100) / 100,
  };
}

/** Recorded hundredths of a second make gaps exact at displayed precision. */
export function swimmingTimeHundredths(value: string): number {
  const match = /^(?:(\d+):)?([0-5]?\d)\.(\d{2})$/.exec(value);
  if (!match) throw new RangeError("Swimming times must have two decimal places, optionally minutes.");
  return Number(match[1] ?? 0) * 6000 + Number(match[2]) * 100 + Number(match[3]);
}
