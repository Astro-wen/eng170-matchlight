import { strict as assert } from "node:assert";
import { test } from "node:test";
import { defaultQuestion } from "../components/matchlight/use-match-data";
import { explainMatch } from "../lib/matches/explain";
import { getMatchSummaries } from "../lib/matches/data";

test("every frontend default question yields the selected sport's explanation in both languages", () => {
  for (const match of getMatchSummaries()) {
    for (const locale of ["en", "zh"] as const) {
      const result = explainMatch({ matchId: match.id, question: defaultQuestion(match.sport, locale), locale });
      assert.ok(result.breakdown.length, `${match.id} / ${locale} must explain the score`);
      assert.equal(result.dataMode, match.mode);
      assert.doesNotMatch(result.headline, /outside|超出/);
    }
  }
});

test("a natural Chinese question about the number on a photo explains the selected score", () => {
  const answer = explainMatch({matchId:"paris-2024-diving-women-3m", momentId:"paris-1-dive-5", question:"为什么是76.50分？", locale:"zh"});
  assert.match(answer.headline, /76\.50 分如何计算/);
  assert.equal(answer.breakdown.at(-1)?.value, "25.5 × 3.0 = 76.50");
});
