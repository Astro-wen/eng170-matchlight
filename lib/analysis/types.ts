import type { Locale } from "../match-types";
import type { EventCompetitor } from './individual-types';

export interface AnalyzeRequest {
  mode?: 'live' | 'replay';
  imageDataUrl: string;
  capturedAt: string;
  timeZone: string;
  locale: Locale;
  hint?: string;
  selectedEvent?: { league: string; eventId: string };
}
export interface AnalysisSource { id: string; label: string; url: string; fetchedAt: string; kind?: 'provider' | 'rule' | 'profile' }
export interface AnalysisEvent {
  id: string; league: string; sport: string; name: string; date: string;
  status: "scheduled" | "live" | "final" | "unknown";
  statusDetail?: string; clock?: string; period?: number;
  provider?: 'espn' | 'worldaquatics' | 'olympic-archive' | 'espn-olympics';
  competitors?: EventCompetitor[]; phase?: string; dataMode?: 'historical' | 'lookup';
  teams: Array<{ id: string; name: string; abbreviation: string; score?: string; homeAway: "home" | "away" | "unknown"; logo?: string }>;
}
export interface PhotoFeatures {
  sport: string; league: string | null; visibleText: string[];
  teams: string[]; athletes: string[]; scores: string[];
  clock: string | null; period: string | null; explicitDate: string | null;
  observations: Array<{ label: string; detail: string; x: number; y: number }>;
  limitations: string[];
  countries?: string[]; eventLabel?: string | null; round?: number | null; difficulty?: number | null;
}
export interface AnalysisPoint {
  id: string; kind: "scene" | "score" | "moment" | "context" | "rule" | "athlete";
  x: number; y: number; title: string; summary: string; detail: string;
  evidence: "photo" | "provider" | "rule"; sourceIds: string[];
  athlete?: EventCompetitor;
}
export interface AnalyzeResult {
  mode?: 'live' | 'replay';
  discovery?: {checkedAt:string;activeCount:number;status:'matched'|'ambiguous'|'empty'|'unavailable'|'unsupported';detail:string};
  statistics?: Array<{label:string;value:string;subject?:string}>;
  id: string; generatedAt: string; capturedAt: string;
  outcome: "matched" | "needs_confirmation" | "unmatched";
  matchMethod: "jev" | "vision" | "user" | "none" | "current";
  headline: string; message: string; features: PhotoFeatures;
  event: AnalysisEvent | null; candidates: AnalysisEvent[];
  points: AnalysisPoint[]; sources: AnalysisSource[];
  temporal: "live" | "historical" | "scheduled" | "unknown";
  moment: { label: string; detail: string; exact: boolean } | null;
  trace: Array<{ stage: "vision" | "scoreboard" | "decision" | "summary" | "insights"; status: "ok" | "unavailable" | "skipped"; detail: string }>;
  coverage?: { sport: string; label: string; detail: string };
  limitations?: string[];
  models: { vision: string; decision: string | null; explanation: string | null };
}
