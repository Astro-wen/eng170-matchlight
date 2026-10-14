import type { LocalizedText, MatchDetail, MatchSummary, Source } from "../match-types";
import { cricketChase, scoreIndividualDive } from "./scoring";
import { historicalDiving } from "./history";

const text = (en: string, zh: string): LocalizedText => ({ en, zh });

/** Actual fixture authoring time; stable across requests. It is NOT an event-feed timestamp. */
export const FIXTURE_UPDATED_AT = "2026-10-14T09:56:09Z";
export const AQUATICS_RULES_URL = "https://resources.fina.org/fina/document/2026/02/18/e6815ecc-06d9-4f0b-98e9-4c441cf5e6a3/2026-02-18_World-Aquatics_CR-Final.pdf";
export const CRICKET_RULES_URL = "https://www.lords.org/getmedia/a4ef9f77-2a25-4f5b-a286-4601f08e6334/Laws-of-Cricket-2017-Code-4th-Edition-%282026%29_5.pdf";

const demoSource: Source = {
  id: "matchlight-demo",
  label: "Matchlight fictional demo",
  kind: "demo",
  note: text("Fictional competitors, venues, results and match dates authored for this prototype. Reloading retrieves the same saved snapshot; it does not fetch live scores.", "参赛者、场馆、成绩和比赛日期均为本原型虚构。刷新只会重新读取相同的演示快照，不会获取实时比分。"),
};
const aquaticsSource: Source = {
  id: "world-aquatics-2026",
  label: "World Aquatics · February 2026 regulations",
  url: AQUATICS_RULES_URL,
  kind: "official-rule",
  note: text("Verified 14 October 2026. Diving: Part Four 9.1.5.1, 9.1.5.5 and 10.1.1. Swimming: Part Two 11.1.2, 11.1.4–11.1.5. The rules are real; demo results are fictional.", "于 2026 年 10 月 14 日核验。跳水：第四部分 9.1.5.1、9.1.5.5 和 10.1.1；游泳：第二部分 11.1.2、11.1.4–11.1.5。规则真实，演示成绩虚构。"),
};
const cricketSource: Source = {
  id: "mcc-laws-2026",
  label: "MCC · Laws of Cricket, 2026 edition",
  url: CRICKET_RULES_URL,
  kind: "official-rule",
  note: text("Verified 14 October 2026. Laws 16 (result), 17 (over), 18–19 (runs and boundaries), and 32 (bowled). Twenty overs is this fictional scenario's playing condition, not a universal MCC rule.", "于 2026 年 10 月 14 日核验。第 16 条（结果）、17 条（回合）、18–19 条（跑分与边界）、32 条（击倒三柱门）。20 个回合是此虚构案例的赛制，并非所有板球比赛的通用规则。"),
};

const base = {
  mode: "demo" as const,
  date: "2026-10-14",
  heroImage: "/images/aquatics-hero.png",
  updatedAt: FIXTURE_UPDATED_AT,
};

const arunScoring = { judgeScores: [7, 7.5, 7.5, 8, 8, 8.5, 9], difficulty: 3.0 };
const evaScoring = { judgeScores: [6.5, 7, 7, 7.5, 7.5, 8, 8], difficulty: 3.2 };
const rinaScoring = { judgeScores: [6.5, 6.5, 7, 7, 7, 7.5, 8], difficulty: 3.2 };

const diving: MatchDetail = {
  ...base,
  id: "demo-diving-3m",
  sport: "diving",
  title: text("3m springboard · Final", "3 米跳板 · 决赛"),
  subtitle: text("Seven judges. One score. Let's unpack it.", "七位裁判，一个得分。一起看懂计算过程。"),
  venue: "Harbor Aquatics Center · fictional venue",
  status: "in_progress",
  phase: text("Demo snapshot · 5 of 6 rounds complete", "演示快照 · 已完成 6 轮中的 5 轮"),
  sources: [demoSource, aquaticsSource],
  currentMomentId: "arun-round-5",
  leaderboard: [
    { id: "arun", name: "Arun Vale", country: "GBR", rank: 1, score: "354.20", delta: "Leader" },
    { id: "eva", name: "Eva Chen", country: "USA", rank: 2, score: "350.80", delta: "−3.40" },
    { id: "niko", name: "Niko Mori", country: "JPN", rank: 3, score: "343.65", delta: "−10.55" },
    { id: "rina", name: "Rina Sol", country: "AUS", rank: 4, score: "339.60", delta: "−14.60" },
  ],
  moments: [
    {
      id: "rina-round-5", label: text("Rina · 67.20 points", "Rina · 67.20 分"), clock: "Round 5 · Dive 2",
      athlete: "Rina Sol", country: "AUS", kind: "score", scoring: rinaScoring,
      scoreboard: `${scoreIndividualDive(rinaScoring.judgeScores, rinaScoring.difficulty).formatted} pts`,
      summary: text("Rina records 67.20 on a dive with 3.2 difficulty.", "Rina 完成难度系数为 3.2 的动作，得到 67.20 分。"),
      stats: [{ label: text("Difficulty", "难度系数"), value: "3.2" }, { label: text("Total after round 5", "第 5 轮后的总分"), value: "339.60" }],
    },
    {
      id: "eva-round-5", label: text("Eva · 70.40 points", "Eva · 70.40 分"), clock: "Round 5 · Dive 3",
      athlete: "Eva Chen", country: "USA", kind: "score", scoring: evaScoring,
      scoreboard: `${scoreIndividualDive(evaScoring.judgeScores, evaScoring.difficulty).formatted} pts`,
      summary: text("Eva scores 70.40 with a 3.2 difficulty multiplier.", "Eva 的难度系数为 3.2，本轮得分 70.40。"),
      stats: [{ label: text("Difficulty", "难度系数"), value: "3.2" }, { label: text("Total after round 5", "第 5 轮后的总分"), value: "350.80" }],
    },
    {
      id: "arun-round-5", label: text("Arun · 70.50 points", "Arun · 70.50 分"), clock: "Round 5 · Dive 4",
      athlete: "Arun Vale", country: "GBR", kind: "lead-change", scoring: arunScoring,
      scoreboard: `${scoreIndividualDive(arunScoring.judgeScores, arunScoring.difficulty).formatted} pts`,
      summary: text("Arun's 70.50 takes his total from 283.70 to 354.20, 3.40 ahead of Eva after round 5.", "Arun 得到 70.50 分，总分从 283.70 增至 354.20。第 5 轮后领先 Eva 3.40 分。"),
      stats: [{ label: text("Difficulty", "难度系数"), value: "3.0" }, { label: text("Total after round 5", "第 5 轮后的总分"), value: "354.20" }],
    },
  ],
  rules: [
    { id: "diving-seven-judges", title: text("Keep the middle three", "保留中间三个分数"), body: text("In this individual seven-judge case, discard two highest and two lowest awards. Exactly three remain, including when judges tie. Add them and multiply by degree of difficulty.", "此案例为个人跳水、七裁判制。去掉两个最高分和两个最低分，遇到同分时也只去掉规定数量。将剩下三个分数相加，再乘以难度系数。"), sourceId: aquaticsSource.id },
    { id: "diving-execution", title: text("A score is not a fault diagnosis", "分数不能直接说明失误原因"), body: text("Judges award 0–10 in half-point increments for their overall impression. The recorded numbers show how the score was calculated; without judge notes or video, this demo cannot say which entry, takeoff or body-position issue caused an award.", "裁判根据整体表现给出 0–10 分，以 0.5 分为间隔。记录的分数能够解释计分方式；没有裁判评语或视频，演示无法判断入水、起跳或姿态的哪项问题导致该分数。"), sourceId: aquaticsSource.id },
    { id: "diving-standings", title: text("Total points decide the order", "按累计得分排序"), body: text("This fictional final has six rounds. The table is the saved total after five rounds; a higher single-dive score does not by itself determine the final winner.", "此虚构决赛共有六轮。榜单是五轮后的累计分数快照；单次动作分数更高，并不等于最终获胜。"), sourceId: demoSource.id },
  ],
  watchNext: {
    title: text("The final round can change the lead", "最后一轮仍可改变领先者"),
    description: text("Eva trails Arun by 3.40 after five rounds. In round six, she must score more than 3.40 points above Arun's last dive to finish ahead of him. Other divers can still change the final order.", "五轮后 Eva 落后 Arun 3.40 分。第六轮中，她的得分需要比 Arun 最后一跳高出超过 3.40 分，最终总分才会超过他。其他选手也仍可能改变最终排名。"),
    athlete: "Eva Chen", target: "+3.40 pts vs Arun in round 6",
  },
};

const swimming: MatchDetail = {
  ...base,
  heroImage: "/images/swimming-hero.png",
  id: "demo-swimming-100free",
  sport: "swimming",
  title: text("100m freestyle · Final", "100 米自由泳 · 决赛"),
  subtitle: text("A finish decided by eight hundredths.", "胜负相差 0.08 秒。"),
  venue: "Harbor Aquatics Center · fictional venue",
  status: "finished",
  phase: text("Demo snapshot · Race finished", "演示快照 · 比赛已结束"),
  sources: [demoSource, aquaticsSource],
  currentMomentId: "maya-finish",
  leaderboard: [
    { id: "maya", name: "Maya Brooks", country: "USA", rank: 1, score: "49.62", delta: "Winner" },
    { id: "jules", name: "Jules Laurent", country: "FRA", rank: 2, score: "49.70", delta: "+0.08" },
    { id: "emi", name: "Emi Ito", country: "JPN", rank: 3, score: "50.04", delta: "+0.42" },
    { id: "theo", name: "Theo Park", country: "KOR", rank: 4, score: "50.31", delta: "+0.69" },
  ],
  moments: [
    {
      id: "maya-50m", label: text("50m · Maya leads", "50 米 · Maya 领先"), clock: "50m split",
      athlete: "Maya Brooks", country: "USA", kind: "lead-change", scoreboard: "24.81 s",
      summary: text("At 50m, Maya's split is 24.81; Jules records 24.92. Maya is 0.11 seconds ahead at halfway.", "50 米分段计时中，Maya 为 24.81 秒，Jules 为 24.92 秒；Maya 在半程领先 0.11 秒。"),
      stats: [{ label: text("Distance", "距离"), value: "50m" }, { label: text("Maya / Jules split", "Maya / Jules 分段时间"), value: "24.81 / 24.92 s" }],
    },
    {
      id: "jules-finish", label: text("Jules · 49.70 seconds", "Jules · 49.70 秒"), clock: "100m finish",
      athlete: "Jules Laurent", country: "FRA", kind: "finish", scoreboard: "49.70 s",
      summary: text("Jules finishes in 49.70, second to Maya's 49.62 by 0.08 seconds.", "Jules 以 49.70 秒完赛，比 Maya 的 49.62 秒慢 0.08 秒，获得第二名。"),
      stats: [{ label: text("Place", "名次"), value: "2" }, { label: text("Gap to winner", "与冠军的差距"), value: "+0.08 s" }],
    },
    {
      id: "maya-finish", label: text("Maya · 49.62 seconds", "Maya · 49.62 秒"), clock: "100m finish",
      athlete: "Maya Brooks", country: "USA", kind: "finish", scoreboard: "49.62 s",
      summary: text("Maya wins this fictional race in 49.62. Jules is 0.08 seconds behind, at 49.70.", "Maya 以 49.62 秒赢得此虚构比赛。Jules 为 49.70 秒，落后 0.08 秒。"),
      stats: [{ label: text("Place", "名次"), value: "1" }, { label: text("Winning margin", "获胜优势"), value: "0.08 s" }],
    },
  ],
  rules: [
    { id: "swimming-timing", title: text("Lower time, higher place", "时间越短，排名越高"), body: text("Automatic timing records how long each swimmer takes to finish and determines placing from those times. The lower recorded finish time places ahead; equal times receive equal placing.", "自动计时记录每位选手完成全程的时间，并据此确定名次。完赛时间较短者排名更高；时间相同者并列。"), sourceId: aquaticsSource.id },
    { id: "swimming-hundredths", title: text("Read the hundredths", "看懂百分之一秒"), body: text("Automatic race times are recorded and displayed to one hundredth of a second. 49.70 − 49.62 = 0.08 seconds; a halfway split does not decide the finishing order.", "自动计时的成绩记录与显示精确至 0.01 秒。49.70 − 49.62 = 0.08 秒；半程分段时间不决定最终名次。"), sourceId: aquaticsSource.id },
    { id: "swimming-demo-schedule", title: text("The next race is an illustrative cue", "下一场仅为演示提示"), body: text("This case has no real schedule feed or disqualification reports. The next-event prompt is part of the fictional prototype, not a confirmed upcoming event.", "本案例未接入真实赛程或犯规判罚报告。下一场提示为虚构原型内容，不代表已确认的真实赛事。"), sourceId: demoSource.id },
  ],
  watchNext: {
    title: text("Follow the next race's 50m split", "下一场关注 50 米分段"),
    description: text("This race is finished. In the fictional next heat, compare the halfway split with the finish: leading at 50m does not guarantee winning at 100m. No upcoming start time is available in this demo.", "这场比赛已结束。在虚构的下一组比赛中，可比较半程与终点成绩：50 米领先不保证 100 米获胜。此演示没有下一场的实际开赛时间。"),
    target: "50m split → 100m finish",
  },
};

const chase = cricketChase(161, 140, "17.4");
const cricket: MatchDetail = {
  ...base,
  heroImage: "/images/cricket-hero.png",
  id: "demo-cricket-chase",
  sport: "cricket",
  title: text("Harbor vs Valley · T20 chase", "Harbor 对 Valley · T20 追分"),
  subtitle: text("Runs, wickets, and balls left — made readable.", "看懂跑分、出局与剩余投球数。"),
  venue: "Valley Oval · fictional venue",
  status: "in_progress",
  phase: text("Demo snapshot · Harbor 140/4 after 17.4 overs", "演示快照 · Harbor 17.4 回合后 140/4"),
  sources: [demoSource, cricketSource],
  currentMomentId: "noah-wicket",
  leaderboard: [
    { id: "valley", name: "Valley CC", country: "DEMO", rank: 1, score: "160/7", delta: "20.0 overs" },
    { id: "harbor", name: "Harbor CC", country: "DEMO", rank: 2, score: "140/4", delta: "17.4 overs" },
  ],
  moments: [
    {
      id: "noah-dot", label: text("17.2 · Dot ball", "17.2 · 未得分球"), clock: "17.2 overs",
      athlete: "Noah Patel", country: "DEMO", kind: "score", scoreboard: "136/3",
      summary: text("A legal delivery adds no runs. Harbor stays on 136/3; 25 runs are needed from 16 legal balls.", "此有效投球未得分。Harbor 仍为 136/3，还需在 16 次有效投球内得到 25 分。"),
      stats: [{ label: text("Target", "目标分数"), value: "161" }, { label: text("Legal balls left", "剩余有效投球"), value: "16" }],
    },
    {
      id: "noah-boundary", label: text("17.3 · Four runs", "17.3 · 四分边界球"), clock: "17.3 overs",
      athlete: "Noah Patel", country: "DEMO", kind: "score", scoreboard: "140/3",
      summary: text("Noah hits a boundary four: Harbor rises from 136/3 to 140/3. The target stays 161; 21 runs are needed from 15 legal balls.", "Noah 击出边界四分球，Harbor 从 136/3 增至 140/3。目标仍是 161 分，还需在 15 次有效投球内得到 21 分。"),
      stats: [{ label: text("Runs on delivery", "本球得分"), value: "4" }, { label: text("Legal balls left", "剩余有效投球"), value: "15" }],
    },
    {
      id: "noah-wicket", label: text("17.4 · A wicket falls", "17.4 · 一名击球手出局"), clock: "17.4 overs",
      athlete: "Noah Patel", country: "DEMO", kind: "wicket", scoreboard: "140/4",
      summary: text("Noah is bowled in the fictional delivery log: the ball hits and breaks his wicket. No runs are added; Harbor moves from 140/3 to 140/4, needing 21 from 14 legal balls.", "虚构逐球记录记载：Noah 的三柱门被投球击倒，因而出局。本球未增加跑分，Harbor 从 140/3 变为 140/4，还需在 14 次有效投球内得到 21 分。"),
      stats: [{ label: text("Runs needed", "还需得分"), value: String(chase.runsNeeded) }, { label: text("Legal balls left", "剩余有效投球"), value: String(chase.ballsRemaining) }, { label: text("Required runs / over", "每回合所需得分"), value: "9.00" }],
    },
  ],
  rules: [
    { id: "cricket-scorecard", title: text("140/4 means runs / wickets", "140/4 表示跑分 / 出局数"), body: text("The first number is the team's runs; the second is wickets lost. This eleven-player demo starts with ten wickets available, so four lost means six remain.", "第一个数字是球队跑分，第二个是已出局人数。此 11 人制演示共可失去 10 个三柱门，已失去 4 个，还剩 6 个。"), sourceId: cricketSource.id },
    { id: "cricket-overs", title: text("17.4 is not 17.4 decimal overs", "17.4 不是十进制回合数"), body: text("An over consists of six valid balls. 17.4 means 17 completed overs plus four valid balls: 106 delivered. In this 20-over innings, 120 − 106 = 14 legal balls remain. Wides and no-balls do not count toward the six.", "一个回合包含 6 次有效投球。17.4 表示完成 17 个回合再加 4 球，共 106 球。此 20 回合局共有 120 球，剩余 120 − 106 = 14 球。宽球和无效球不计入每回合的 6 球。"), sourceId: cricketSource.id },
    { id: "cricket-chase", title: text("Beat the opponent's total", "超过对方的总分"), body: text("Valley recorded 160, so Harbor's winning target is 161 in this uninterrupted fictional chase. At 140, they need 21 more from 14 legal balls, equivalent to 9.00 runs per six-ball over. This does not predict the winner.", "Valley 得到 160 分，所以在此未受中断的虚构追分局中，Harbor 的获胜目标为 161 分。目前 140 分，还需在 14 球内得到 21 分，相当于每 6 球回合 9.00 分。这不是对胜者的预测。"), sourceId: cricketSource.id },
  ],
  watchNext: {
    title: text("Watch the chase pressure", "关注追分压力"),
    description: text("Harbor needs 21 runs from 14 legal balls, with six wickets in hand. Watch whether the next batter scores above the required rate of 9.00 runs per over. The result is still open.", "Harbor 还需在 14 次有效投球内得到 21 分，尚有 6 名击球手可出局。关注下一位击球手能否超过每回合 9.00 分的所需速度；比赛结果仍未确定。"),
    target: "21 runs / 14 balls",
  },
};

const fixtures: MatchDetail[] = [diving, swimming, cricket, historicalDiving];

/** Return copies so a caller cannot mutate the saved snapshot for another request. */
export function getMatch(id: string): MatchDetail | undefined {
  const match = fixtures.find((entry) => entry.id === id);
  return match ? structuredClone(match) : undefined;
}

export function getMatchSummaries(): MatchSummary[] {
  return fixtures.map((match) => structuredClone({
    id: match.id, sport: match.sport, title: match.title, subtitle: match.subtitle,
    venue: match.venue, date: match.date, mode: match.mode, status: match.status,
    phase: match.phase, heroImage: match.heroImage, updatedAt: match.updatedAt,
    sources: match.sources,
    preview: match.leaderboard.slice(0, 3),
    participants: match.leaderboard.map(({ name, country }) => ({ name, country })),
  }));
}
