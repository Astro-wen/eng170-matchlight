import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { getAthleteMedia } from "../lib/athlete-media";
import { countryInfo } from "../lib/countries";
import { getMatch, getMatchSummaries } from "../lib/matches/data";

test("every real finalist has a distinct local official portrait and correct country label", () => {
  const match = getMatch("paris-2024-diving-women-3m")!;
  const files = new Set<string>();
  for (const athlete of match.leaderboard) {
    const media = getAthleteMedia(athlete.name);
    assert.ok(media, athlete.name);
    assert.ok(existsSync(`public${media.src}`), media.src);
    assert.ok(media.sourceUrl.startsWith("https://www.worldaquatics.com/athletes/"));
    assert.ok(countryInfo(athlete.country).flag, athlete.country);
    files.add(media.src);
  }
  assert.equal(files.size, 12);
  assert.equal(getAthleteMedia("Yiwen Chen")?.src, getAthleteMedia("CHEN Yiwen")?.src);
  assert.equal(getAthleteMedia("Arun Sharma"), undefined);
  assert.equal(getAthleteMedia("constructor"), undefined);
});

test("score-strip previews are copied from the same source standings", () => {
  for (const summary of getMatchSummaries()) {
    const standings = getMatch(summary.id)!.leaderboard;
    assert.deepEqual(summary.preview, standings.slice(0, 3));
    assert.deepEqual(summary.participants, standings.map(({ name, country }) => ({ name, country })));
  }
  const summary = getMatchSummaries()[0];
  summary.preview![0].score = "999.99";
  assert.notEqual(getMatch(summary.id)!.leaderboard[0].score, "999.99");
});

test("country presentation localizes real codes and does not invent fictional flags", () => {
  assert.equal(countryInfo("CHN", "zh").name, "中国");
  assert.equal(countryInfo("AUS").flag, "🇦🇺");
  assert.equal(countryInfo("GER").name, "Germany");
  assert.equal(countryInfo("DEMO").flag, "");
  assert.equal(countryInfo("constructor").name, "constructor");
});
