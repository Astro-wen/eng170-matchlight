import type { ExplainRequest, ExplainResponse, Locale, MatchDetail, Moment } from "../match-types";
import { getMatch } from "./data";
import { cricketChase, scoreIndividualDive, swimmingTimeHundredths } from "./scoring";

export class ExplanationError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ExplanationError";
  }
}

export const MAX_QUESTION_LENGTH = 400;
const allowedKeys = new Set(["matchId", "momentId", "question", "locale"]);

/** Reject malformed input before touching fixtures; this is also the API boundary. */
export function validateExplainRequest(body: unknown): ExplainRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ExplanationError("Expected a JSON object.", 400);
  }
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    throw new ExplanationError("Unknown request field.", 400);
  }
  if (typeof input.matchId !== "string" || !/^[a-z0-9-]{1,100}$/.test(input.matchId)) {
    throw new ExplanationError("A valid matchId is required.", 400);
  }
  if (input.momentId !== undefined && (typeof input.momentId !== "string" || !/^[a-z0-9-]{1,100}$/.test(input.momentId))) {
    throw new ExplanationError("momentId must be a valid moment identifier.", 400);
  }
  if (input.locale !== "en" && input.locale !== "zh") {
    throw new ExplanationError("locale must be en or zh.", 400);
  }
  if (typeof input.question !== "string" || !input.question.trim() || input.question.length > MAX_QUESTION_LENGTH) {
    throw new ExplanationError(`question must contain 1–${MAX_QUESTION_LENGTH} characters.`, 400);
  }
  return { matchId: input.matchId, momentId: input.momentId as string | undefined, question: input.question.trim(), locale: input.locale };
}

type Focus = "scoring" | "standings" | "rules" | "next" | "evidence" | "prediction" | "unsupported";
const phrases = {
  prediction: /predict|will.*win|who.*going to win|odds|bet|预测|谁会赢|谁能赢|夺冠概率|赔率|投注/i,
  evidence: /deduct|penalt|fault|splash|entry|take.?off|body position|clean|disqualif|扣分|入水|水花|起跳|失误|姿态|犯规|取消资格/i,
  next: /next|watch|follow|remaining|left|接下来|下一|关注|还剩|剩余/i,
  rules: /rule|what.*mean|means|how.*work|what.*wicket|what.*over|规则|什么意思|含义|什么是|回合|三柱门|怎么读/i,
  standings: /rank|standings|leader|lead|behind|ahead|winner|who.*won|winning|faster|gap|margin|place|排名|领先|落后|获胜|冠军|谁赢|名次|差距|更快/i,
  scoring: /\b(?:score|scoring|points?|judges?|difficulty|dd|split|runs?|wicket|overs?|balls?)\b|finish time|得分|分数|分值|评分|裁判|难度|成绩|分段|跑分|出局|投球|几分|多少分/i,
};

export function detectFocus(question: string): Focus {
  if (/weather|president|politic|quantum|stock|recipe|biography|world record|latest|live score|real.?time|netflix|tax|basketball|baseball|football|soccer|tennis|gymnastics|hockey|天气|总统|政治|量子|股票|食谱|履历|世界纪录|最新|实时|篮球|棒球|足球|网球|体操|税/i.test(question)) return "unsupported";
  // A few intentionally broad prompts are supported only as complete phrases.
  if (/^(?:explain (?:this|that)(?: moment)?|what happened(?: here)?|how (?:was|is) (?:this|that) calculated|why (?:was|is) (?:this|that) (?:low|high)|解释(?:这个|这一刻|一下)|发生了什么)[?.!。？！]*$/i.test(question.trim())) return "scoring";
  for (const [focus, phrase] of Object.entries(phrases)) {
    if (phrase.test(question)) return focus as Focus;
  }
  return "unsupported";
}

const t = (locale: Locale, en: string, zh: string) => locale === "zh" ? zh : en;

function watchNextForMoment(match: MatchDetail, moment: Moment, locale: Locale): string {
  if (match.sport !== "cricket") return match.watchNext.description[locale];
  const [runs, wickets] = moment.scoreboard.split("/").map(Number);
  const chase = cricketChase(161, runs, moment.clock.split(" ")[0]);
  return t(locale,
    `At the selected ${moment.clock} snapshot, Harbor needs ${chase.runsNeeded} runs from ${chase.ballsRemaining} legal balls, with ${10 - wickets} wickets in hand. Compare the next delivery's scoring with the required rate of ${chase.requiredRunRate?.toFixed(2)} runs per six-ball over. This saved example does not predict the result.`,
    `在所选 ${moment.clock} 快照中，Harbor 还需在 ${chase.ballsRemaining} 次有效投球内得到 ${chase.runsNeeded} 分，尚可失去 ${10 - wickets} 个三柱门。可比较下一球得分与每 6 球回合 ${chase.requiredRunRate?.toFixed(2)} 分的所需速度。此保存案例不预测比赛结果。`);
}

function scoringExplanation(match: MatchDetail, moment: Moment, locale: Locale): Pick<ExplainResponse, "headline" | "answer" | "breakdown"> {
  const prefix = match.mode === "historical"
    ? t(locale, "From the saved official historical record: ", "根据已保存的官方历史记录：")
    : t(locale, "In this fictional demo: ", "在此虚构演示中：");
  if (match.sport === "diving" && moment.scoring) {
    const scoring = scoreIndividualDive(moment.scoring.judgeScores, moment.scoring.difficulty);
    const retained = scoring.retained.map((judge) => judge.score.toFixed(1)).join(" + ");
    const discarded = scoring.discarded.map((judge) => judge.score.toFixed(1)).join(", ");
    return {
      headline: t(locale, `${moment.athlete}'s ${scoring.formatted}, step by step`, `${moment.athlete} 的 ${scoring.formatted} 分如何计算`),
      answer: prefix + moment.summary[locale] + " " + t(locale,
        `Remove the two highest and two lowest awards. The three retained awards add to ${scoring.sum.toFixed(1)}; multiplied by difficulty ${moment.scoring.difficulty.toFixed(1)}, they produce ${scoring.formatted} points. The awards alone cannot tell us why a judge gave a particular mark.`,
        `去掉两个最高分和两个最低分后，保留的三个分数之和为 ${scoring.sum.toFixed(1)}；乘以难度系数 ${moment.scoring.difficulty.toFixed(1)}，得到 ${scoring.formatted} 分。仅凭这些评分，无法知道裁判为何给出某个分数。`),
      breakdown: [
        { label: t(locale, "Seven judge awards", "七位裁判评分"), value: moment.scoring.judgeScores.map((score) => score.toFixed(1)).join(" · ") },
        { label: t(locale, "Four awards discarded", "去掉四个分数"), value: discarded, detail: t(locale, "Exactly two low and two high awards, even when tied.", "即使同分，也只去掉两个最低分和两个最高分。") },
        { label: t(locale, "Three awards retained", "保留三个分数"), value: `${retained} = ${scoring.sum.toFixed(1)}` },
        { label: t(locale, "Apply difficulty", "乘以难度系数"), value: `${scoring.sum.toFixed(1)} × ${moment.scoring.difficulty.toFixed(1)} = ${scoring.formatted}` },
      ],
    };
  }
  if (match.sport === "swimming") {
    const halfway = moment.id === "maya-50m";
    const first = halfway ? "24.81" : "49.62";
    const second = halfway ? "24.92" : "49.70";
    const difference = ((swimmingTimeHundredths(second) - swimmingTimeHundredths(first)) / 100).toFixed(2);
    return {
      headline: t(locale, halfway ? "A 0.11-second lead at halfway" : "Eight hundredths decide this finish", halfway ? "半程领先 0.11 秒" : "终点相差百分之八秒"),
      answer: prefix + moment.summary[locale] + " " + t(locale,
        halfway ? "This is a split time, not a finishing result. It shows the order at 50m; the saved final table belongs to the 100m finish. Race times are read to hundredths of a second." : "A lower finish time places ahead. The recorded gap is 49.70 − 49.62 = 0.08 seconds. These are fictional timed results; this data does not establish a technical reason for the difference.",
        halfway ? "这是分段时间，不是最终成绩。它说明 50 米处的顺序；保存的最终榜单对应 100 米终点。比赛时间读至 0.01 秒。" : "完赛时间较短者排名更高。记录的差距为 49.70 − 49.62 = 0.08 秒。这些计时成绩为虚构数据，无法据此确定技术层面的差距原因。"),
      breakdown: [
        { label: t(locale, halfway ? "Maya · 50m split" : "Maya · finish", halfway ? "Maya · 50 米分段" : "Maya · 完赛"), value: `${first} s` },
        { label: t(locale, halfway ? "Jules · 50m split" : "Jules · finish", halfway ? "Jules · 50 米分段" : "Jules · 完赛"), value: `${second} s` },
        { label: t(locale, "Recorded gap", "记录的差距"), value: `${second} − ${first} = ${difference} s` },
        { label: t(locale, "What it means", "含义"), value: t(locale, halfway ? "Halfway lead; not final placing" : "Maya first · Jules second", halfway ? "半程领先；不是最终名次" : "Maya 第一 · Jules 第二") },
      ],
    };
  }
  const [runs, wickets] = moment.scoreboard.split("/").map(Number);
  const overs = moment.clock.split(" ")[0];
  const chase = cricketChase(161, runs, overs);
  return {
    headline: t(locale, moment.kind === "wicket" ? "A wicket changes the pressure, not the runs" : `${moment.scoreboard}: read the chase`, moment.kind === "wicket" ? "出局改变追分压力，跑分不变" : `${moment.scoreboard}：看懂追分`),
    answer: prefix + moment.summary[locale] + " " + t(locale,
      `${moment.scoreboard} means ${runs} runs and ${wickets} wickets lost. ${overs} overs means completed six-ball overs plus legal balls, not a decimal fraction. Valley's 160 makes the target 161 in this uninterrupted twenty-over example.`,
      `${moment.scoreboard} 表示 ${runs} 跑分、${wickets} 人出局。${overs} 回合表示已完成的 6 球回合加上有效投球数，并非十进制小数。此未受中断的 20 回合案例中，Valley 的 160 分使追分目标成为 161 分。`),
    breakdown: [
      { label: t(locale, "Runs / wickets lost", "跑分 / 已出局数"), value: `${runs} / ${wickets}` },
      { label: t(locale, "Wickets in hand", "可再失去的三柱门"), value: String(10 - wickets) },
      { label: t(locale, "Chase requirement at this moment", "此时的追分需求"), value: t(locale, `${chase.runsNeeded} runs from ${chase.ballsRemaining} legal balls`, `${chase.ballsRemaining} 次有效投球内还需 ${chase.runsNeeded} 分`) },
      { label: t(locale, "Required runs per six-ball over", "每 6 球回合所需得分"), value: chase.requiredRunRate?.toFixed(2) ?? t(locale, "No balls remain", "已无剩余有效投球") },
    ],
  };
}

function standingExplanation(match: MatchDetail, locale: Locale): Pick<ExplainResponse, "headline" | "answer" | "breakdown"> {
  const first = match.leaderboard[0];
  const second = match.leaderboard[1];
  const finished = match.status === "finished";
  let answer: string;
  if (match.sport === "cricket") {
    answer = t(locale,
      "The teams are at different innings stages: Valley finished on 160/7; Harbor is chasing at 140/4 after 17.4 overs. The table is not a final win/loss ranking. Harbor still needs 21 from 14 legal balls, so there is no recorded winner yet.",
      "两队处于不同局阶段：Valley 已以 160/7 完成该局；Harbor 在 17.4 回合后以 140/4 追分。榜单不是最终胜负排名。Harbor 还需在 14 次有效投球内得到 21 分，记录尚无胜者。");
  } else if (match.sport === "diving") {
    const gap = ((Math.round(Number(first.score) * 100) - Math.round(Number(second.score) * 100)) / 100).toFixed(2);
    answer = t(locale,
      `${first.name} ${finished ? "finished first" : "leads the saved standings"} on ${first.score}, ${gap} points ahead of ${second.name}'s ${second.score}. These are ${finished ? "final totals" : "totals after five rounds"}; the selected moment can be from an earlier dive. ${finished ? "The historical final is complete." : "One round remains, so this is not a final result."}`,
      `${first.name} 以 ${first.score} 分${finished ? "获得最终第一名" : "在保存的榜单中领先"}，比 ${second.name} 的 ${second.score} 分高 ${gap} 分。这些为${finished ? "最终总分" : "五轮后的累计总分"}；所选时刻可能对应更早的动作。${finished ? "历史决赛已结束。" : "还剩一轮，因此不是最终成绩。"}`);
  } else {
    answer = t(locale,
      "In the fictional final, Maya Brooks finishes first in 49.62; Jules Laurent is second in 49.70, 0.08 seconds behind. Lower finish time places ahead. This saved table is the final result, even when you select a halfway moment.",
      "在虚构决赛中，Maya Brooks 以 49.62 秒获得第一；Jules Laurent 以 49.70 秒获得第二，落后 0.08 秒。完赛时间较短者排名更高。即使选中半程时刻，此保存的榜单仍为最终结果。");
  }
  return {
    headline: t(locale, match.sport === "cricket" ? "The chase is still open" : finished ? "Read the final standings" : "Read the saved standings", match.sport === "cricket" ? "追分结果仍未确定" : finished ? "看懂最终排名" : "看懂保存的排名快照"),
    answer,
    breakdown: match.leaderboard.slice(0, 4).map((entry) => ({ label: `${entry.rank}. ${entry.name}`, value: entry.score, detail: entry.delta })),
  };
}

/** Pure, deterministic grounded engine. Optional model integration can wrap this. */
export function explainMatch(request: ExplainRequest): ExplainResponse {
  const match = getMatch(request.matchId);
  if (!match) throw new ExplanationError("Match not found.", 404);
  const momentId = request.momentId ?? match.currentMomentId;
  const moment = match.moments.find((entry) => entry.id === momentId);
  if (!moment) throw new ExplanationError("Moment not found in this match.", 404);
  const locale = request.locale;
  let focus = detectFocus(request.question);
  const sportNames = { diving: /\bdiving\b|跳水/i, swimming: /\bswimming\b|游泳/i, cricket: /\bcricket\b|板球/i };
  if (Object.entries(sportNames).some(([sport, phrase]) => sport !== match.sport && phrase.test(request.question))) focus = "unsupported";
  const base: ExplainResponse = {
    ...scoringExplanation(match, moment, locale),
    watchNext: watchNextForMoment(match, moment, locale),
    sourceIds: match.sources.map((source) => source.id),
    mode: "grounded-demo",
    dataMode: match.mode,
    updatedAt: match.updatedAt,
  };
  if (focus === "unsupported") {
    return {
      ...base,
      headline: t(locale, "That question is outside this saved case", "此问题超出了当前保存案例的范围"),
      answer: t(locale,
        "This prototype can explain this match's recorded score, judge calculation, rules, standings and what to watch next. It has no general knowledge, athlete biography, video analysis or live feed. Try “How was this score calculated?” or “Who leads this match?”",
        "此原型可以解释本场比赛记录的得分、裁判计分、规则、排名和接下来的看点。它未提供通用知识、运动员履历、视频分析或实时数据。可尝试“这个分数如何计算？”或“谁在领先？”"),
      breakdown: [],
    };
  }
  if (focus === "standings") return { ...base, ...standingExplanation(match, locale) };
  if (focus === "prediction") return {
    ...base,
    headline: t(locale, match.status === "finished" ? "The saved result is already final" : "The saved data cannot predict a winner", match.status === "finished" ? "保存的比赛结果已经确定" : "保存的数据无法预测胜者"),
    answer: t(locale, "This prototype does not calculate odds or predict future results. ", "此原型不计算赔率，也不预测未来结果。") + standingExplanation(match, locale).answer,
    breakdown: standingExplanation(match, locale).breakdown,
  };
  if (focus === "next") return {
    ...base,
    headline: match.watchNext.title[locale],
    answer: base.watchNext + " " + t(locale, "This cue uses the saved snapshot. Reloading does not update it from a live feed.", "此提示基于保存的快照。刷新不会从实时数据源更新。"),
    breakdown: [
      { label: t(locale, "Focus", "关注点"), value: match.sport === "cricket" ? scoringExplanation(match, moment, locale).breakdown[2].value : match.watchNext.target ?? match.watchNext.title[locale] },
      { label: t(locale, "Snapshot phase", "快照阶段"), value: match.sport === "cricket" ? moment.clock : match.phase[locale] },
    ],
  };
  if (focus === "rules") return {
    ...base,
    headline: t(locale, "The rule behind the moment", "这个时刻涉及的规则"),
    answer: match.rules.map((rule) => rule.body[locale]).join(" "),
    breakdown: match.rules.map((rule) => ({ label: rule.title[locale], value: rule.body[locale] })),
  };
  if (focus === "evidence") return {
    ...base,
    headline: t(locale, "What the record can and cannot establish", "记录能说明什么、不能说明什么"),
    answer: t(locale,
      match.sport === "diving"
        ? "The judge awards and difficulty explain the arithmetic, but this record has no video or judge comments. We cannot identify a splash, takeoff or body-position deduction, or tell why an individual judge chose their mark. "
        : match.sport === "swimming"
          ? "This fictional record contains finish times and no disqualification report. It cannot establish a technical fault or judging decision from the time alone. "
          : moment.kind === "wicket"
            ? "The selected fictional delivery log explicitly records Noah as bowled; there is no video or detailed umpire report. The demo cannot assess other possible penalties or decisions. "
            : "The selected fictional delivery log records the runs on this delivery. It supplies no video or detailed umpire report to establish an additional penalty or technical fault. ",
      match.sport === "diving"
        ? "裁判评分和难度系数能解释算分过程，但此记录没有视频或裁判评语。无法确定水花、起跳或姿态导致的扣分，也无法知道某位裁判为何给出该分数。 "
        : match.sport === "swimming"
          ? "此虚构记录包含完赛时间，没有取消资格报告。仅凭时间无法确定技术失误或裁判判罚。 "
          : moment.kind === "wicket"
            ? "所选虚构逐球记录明确记载 Noah 因三柱门被投球击倒而出局，但没有视频或详细裁判报告。演示无法评估其他可能的罚分或判罚。 "
            : "所选虚构逐球记录提供本球跑分，但没有视频或详细裁判报告以判断额外罚分或技术失误。 ") + moment.summary[locale],
  };
  return base;
}
