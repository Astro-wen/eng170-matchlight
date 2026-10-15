import type { Locale } from "../match-types";

export interface AnalyzeRequest {
  imageDataUrl: string;
  capturedAt: string;
  timeZone: string;
  locale: Locale;
  hint?: string;
  selectedEvent?: { league: string; eventId: string };
}
export interface AnalysisSource { id: string; label: string; url: string; fetchedAt: string }
export interface AnalysisEvent {
  id: string; league: string; sport: string; name: string; date: string;
  status: "scheduled" | "live" | "final" | "unknown";
  statusDetail?: string; clock?: string; period?: number;
  teams: Array<{ id: string; name: string; abbreviation: string; score?: string; homeAway: "home" | "away" | "unknown"; logo?: string }>;
}
export interface PhotoFeatures {
  sport: string; league: string | null; visibleText: string[];
  teams: string[]; athletes: string[]; scores: string[];
  clock: string | null; period: string | null; explicitDate: string | null;
  observations: Array<{ label: string; detail: string; x: number; y: number }>;
  limitations: string[];
}
export interface AnalysisPoint {
  id: string; kind: "scene" | "score" | "moment" | "context";
  x: number; y: number; title: string; summary: string; detail: string;
  evidence: "photo" | "provider"; sourceIds: string[];
}
export interface AnalyzeResult {
  id: string; generatedAt: string; capturedAt: string;
  outcome: "matched" | "needs_confirmation" | "unmatched";
  matchMethod: "jev" | "vision" | "user" | "none";
  headline: string; message: string; features: PhotoFeatures;
  event: AnalysisEvent | null; candidates: AnalysisEvent[];
  points: AnalysisPoint[]; sources: AnalysisSource[];
  temporal: "live" | "historical" | "scheduled" | "unknown";
  moment: { label: string; detail: string; exact: boolean } | null;
  trace: Array<{ stage: "vision" | "scoreboard" | "decision" | "summary" | "insights"; status: "ok" | "unavailable" | "skipped"; detail: string }>;
  models: { vision: string; decision: string | null; explanation: string | null };
}
