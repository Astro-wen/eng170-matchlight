export type Locale = "en" | "zh";
export type LocalizedText = Record<Locale, string>;
export type Sport = "diving" | "swimming" | "cricket";
export type DataMode = "demo" | "historical" | "live";

export interface Source {
  id: string;
  label: string;
  url?: string;
  kind: "demo" | "official-rule" | "provider";
  note: LocalizedText;
}
export interface MatchSummary {
  id: string;
  sport: Sport;
  title: LocalizedText;
  subtitle: LocalizedText;
  venue: string;
  date: string;
  mode: DataMode;
  status: "in_progress" | "finished";
  phase: LocalizedText;
  heroImage: string;
  updatedAt: string;
  sources: Source[];
}
export interface Stat {
  label: LocalizedText;
  value: string;
}
export interface Moment {
  id: string;
  label: LocalizedText;
  clock: string;
  athlete: string;
  country: string;
  summary: LocalizedText;
  scoreboard: string;
  stats: Stat[];
  scoring?: { judgeScores: number[]; difficulty: number };
  kind: "score" | "lead-change" | "finish" | "wicket";
}
export interface Standing {
  id: string;
  name: string;
  country: string;
  rank: number;
  score: string;
  delta?: string;
}
export interface Rule {
  id: string;
  title: LocalizedText;
  body: LocalizedText;
  sourceId: string;
}
export interface WatchNext {
  title: LocalizedText;
  description: LocalizedText;
  athlete?: string;
  target?: string;
}
export interface MatchDetail extends MatchSummary {
  leaderboard: Standing[];
  moments: Moment[];
  rules: Rule[];
  watchNext: WatchNext;
  currentMomentId: string;
}
export interface ExplainRequest {
  matchId: string;
  momentId?: string;
  question: string;
  locale: Locale;
}
export interface ExplainResponse {
  headline: string;
  answer: string;
  breakdown: Array<{ label: string; value: string; detail?: string }>;
  watchNext: string;
  sourceIds: string[];
  mode: "grounded-demo" | "ai";
  dataMode: DataMode;
  updatedAt: string;
}
