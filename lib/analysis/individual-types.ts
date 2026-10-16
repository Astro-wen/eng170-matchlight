import type { AnalysisEvent, AnalysisSource } from './types';

export type IndividualSport = 'diving' | 'swimming' | 'gymnastics' | 'athletics';
export interface EventCompetitor {
  id: string; name: string; country?: string; rank?: number; score?: string;
  athleteId?: string; profileUrl?: string; image?: string;
}
export interface IndividualEvent extends AnalysisEvent {
  provider: 'worldaquatics' | 'olympic-archive' | 'espn-olympics';
  competitors: EventCompetitor[];
  phase?: string;
  dataMode: 'historical' | 'lookup';
}
export interface IndividualRound {
  athleteId: string; athleteName: string; country?: string; round: number;
  score: string; total?: string; difficulty?: number; judgeScores?: number[];
  actionCode?: string;
}
export interface IndividualSummary {
  event: IndividualEvent; fetchedAt: string; sources: AnalysisSource[];
  rounds: IndividualRound[];
  limitations: string[];
}
export interface IndividualSearch {
  events: IndividualEvent[]; sources: AnalysisSource[]; limited?: boolean;
}
