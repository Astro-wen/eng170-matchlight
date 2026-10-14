import type { LocalizedText, MatchDetail, Moment, Source } from "../match-types";
import rawSnapshot from "./paris-2024-diving.json";
import { scoreIndividualDive } from "./scoring";

const text = (en: string, zh: string): LocalizedText => ({ en, zh });
export const PARIS_EVENT_URL = "https://api.worldaquatics.com/fina/events/ef62ff76-092c-4d34-882d-e247cd6a0310";
const HISTORICAL_RULES_URL = "https://resources.fina.org/fina/document/2024/07/23/44b81452-f720-471f-8d07-40e1387dd2fb/Competition-Regulations-version-1st-July-2024-_publishing_V3.pdf";

type PublicDivingSnapshot = typeof rawSnapshot;

/** Small read-only adapter for an official individual-diving event snapshot.
 * Live fetching requires a separate provider integration and is not implied here.
 */
export function mapHistoricalDiving(snapshot: PublicDivingSnapshot): MatchDetail {
  if (snapshot.ResultStatus !== "OFFICIAL" || snapshot.HeatName !== "Finals" || snapshot.Results.length === 0) {
    throw new Error("An official diving final is required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(snapshot.EventResultUtcDateTime) || snapshot.EventResultUtcDateTime.startsWith("0001-")) {
    throw new Error("The provider result timestamp is invalid.");
  }
  const standings = snapshot.Results.toSorted((a, b) => a.Rank - b.Rank);
  const leader = standings[0];
  for (const result of standings) {
    if (!Number.isInteger(result.Rank) || result.Rank < 1 || !Number.isFinite(Number(result.TotalPoints)) || result.Dives.length !== 5) {
      throw new Error("Invalid historical final result.");
    }
    let totalCents = 0;
    for (const dive of result.Dives) {
      const score = scoreIndividualDive(dive.JudgesScores.map((award) => Number(award.Score)), Number(dive.DD));
      if (score.formatted !== dive.DivePoints) throw new Error("Recorded points do not match this adapter's individual-diving formula.");
      totalCents += Math.round(score.points * 100);
      if ((totalCents / 100).toFixed(2) !== dive.TotalPoints) throw new Error("Recorded running total is inconsistent.");
    }
    if ((totalCents / 100).toFixed(2) !== result.TotalPoints) throw new Error("Recorded final total is inconsistent.");
  }
  const provider: Source = {
    id: "world-aquatics-paris-2024",
    label: "World Aquatics · Paris 2024 official results",
    kind: "provider",
    url: PARIS_EVENT_URL,
    note: text("Saved official final snapshot captured 14 October 2026. Names, nations, ranks, judge awards and totals come from this public endpoint. The timestamp is its EventResultUtcDateTime (9 August 2024); LastChange is an invalid year-one value and is not used. No live feed or video.", "于 2026 年 10 月 14 日保存的官方决赛历史快照。姓名、国家、排名、裁判评分和总分来自此公开端点。时间戳取自 EventResultUtcDateTime（2024 年 8 月 9 日）；LastChange 为无效的公元元年值，未使用。未接入实时数据或视频。"),
  };
  const rules: Source = {
    id: "world-aquatics-2024",
    label: "World Aquatics · July 2024 regulations",
    kind: "official-rule",
    url: HISTORICAL_RULES_URL,
    note: text("Official archived 1 July 2024 regulations, Part Four 7.5 and 7.8. Verified 14 October 2026. The scoring calculation reproduces all 60 recorded dives in this final.", "官方 2024 年 7 月 1 日存档规则，第四部分第 7.5 和 7.8 条。于 2026 年 10 月 14 日核验。计算方法与此决赛全部 60 次动作的官方得分一致。"),
  };
  // Keep three focused moments for the MVP; retain all final competitors.
  const moments: Moment[] = [
    { athlete: standings[2], dive: standings[2].Dives[0] },
    { athlete: standings[1], dive: standings[1].Dives[4] },
    { athlete: leader, dive: leader.Dives[4] },
  ].map(({ athlete, dive }) => ({
    id: `paris-${athlete.Rank}-dive-${dive.DiveOrder}`,
    athlete: athlete.FullName,
    country: athlete.NAT,
    kind: "score",
    clock: `Round ${dive.DiveOrder} · ${dive.DiveNo}`,
    label: text(`${athlete.FullName} · ${dive.DivePoints} points`, `${athlete.FullName} · ${dive.DivePoints} 分`),
    scoreboard: `${dive.DivePoints} pts`,
    summary: text(`${athlete.FullName} records ${dive.DivePoints} on dive ${dive.DiveNo}, difficulty ${dive.DD}. Their running total after this dive is ${dive.TotalPoints}.`, `${athlete.FullName} 在动作 ${dive.DiveNo} 中得分 ${dive.DivePoints}，难度系数 ${dive.DD}；完成此跳后的累计分数为 ${dive.TotalPoints}。`),
    stats: [
      { label: text("Difficulty", "难度系数"), value: dive.DD },
      { label: text("Running total after this dive", "此跳后的累计总分"), value: dive.TotalPoints },
    ],
    scoring: { judgeScores: dive.JudgesScores.map((award) => Number(award.Score)), difficulty: Number(dive.DD) },
  }));
  return {
    id: "paris-2024-diving-women-3m",
    sport: "diving",
    title: text("Paris 2024 · Women's 3m final", "巴黎 2024 · 女子 3 米跳板决赛"),
    subtitle: text("Real recorded scores, explained one dive at a time.", "逐跳解释真实的历史成绩。"),
    venue: "Paris 2024 · Olympic Games",
    date: snapshot.EventResultDate,
    mode: "historical",
    status: "finished",
    phase: text("Historical results · Final complete · 5 rounds", "历史成绩 · 决赛已结束 · 共 5 轮"),
    heroImage: "/images/aquatics-hero.png",
    updatedAt: `${snapshot.EventResultUtcDateTime}Z`,
    sources: [provider, rules],
    currentMomentId: moments[2].id,
    leaderboard: standings.map((athlete) => ({
      id: `paris-athlete-${athlete.Rank}`,
      name: athlete.FullName,
      country: athlete.NAT,
      rank: athlete.Rank,
      score: athlete.TotalPoints,
      delta: athlete.Rank === 1 ? "Winner" : `−${((Math.round(Number(leader.TotalPoints) * 100) - Math.round(Number(athlete.TotalPoints) * 100)) / 100).toFixed(2)}`,
    })),
    moments,
    rules: [
      { id: "paris-diving-score", title: text("Same seven-judge calculation", "七位裁判的计分方式"), body: text("For individual diving with seven judges, remove exactly two highest and two lowest awards. Add the three that remain, then multiply by difficulty. This reproduces the official recorded points.", "七裁判制个人跳水中，去掉两个最高分和两个最低分。将保留的三个分数相加，再乘以难度系数，得到与官方记录一致的得分。"), sourceId: rules.id },
      { id: "paris-evidence-limit", title: text("Awards show the arithmetic", "评分记录说明计算过程"), body: text("The official endpoint provides judge awards but no video or judge explanations. It cannot establish which visual fault caused an award. The final table and the selected dive's running total refer to different stages of the event.", "官方端点提供裁判评分，但没有视频或裁判评语，无法据此判断哪项可见失误造成该评分。最终榜单与所选动作的累计总分对应比赛的不同阶段。"), sourceId: provider.id },
      { id: "paris-final-total", title: text("Compare the full five-dive total", "比较五跳累计总分"), body: text("CHEN Yiwen finishes first with 376.00, KEENEY Maddison second with 343.10, and CHANG Yani third with 318.75. A higher single-dive score does not replace the five-dive total.", "CHEN Yiwen 以 376.00 分获得第一，KEENEY Maddison 以 343.10 分获得第二，CHANG Yani 以 318.75 分获得第三。单跳得分更高不能替代五跳累计总分。"), sourceId: provider.id },
    ],
    watchNext: {
      title: text("Compare difficulty with execution", "比较难度与完成质量"),
      description: text("This historical final is over. Compare KEENEY Maddison's last dive (78.20, difficulty 3.4) with CHEN Yiwen's last dive (76.50, difficulty 3.0), then compare their five-dive totals. The higher last-dive score did not determine the winner.", "这场历史决赛已结束。可比较 KEENEY Maddison 最后一跳（78.20 分、难度 3.4）与 CHEN Yiwen 最后一跳（76.50 分、难度 3.0），再查看两人的五跳总分。最后一跳得分更高，并不决定最终胜者。"),
      athlete: "KEENEY Maddison", target: "78.20 at DD 3.4 vs 76.50 at DD 3.0",
    },
  };
}

export const historicalDiving = mapHistoricalDiving(rawSnapshot);
