import type { AnalysisEvent, AnalyzeRequest, PhotoFeatures } from './types';
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
export function visibleTeamCount(features: PhotoFeatures, event: AnalysisEvent): number {
  const distinct = new Set<number>();
  for (const label of features.teams) {
    const a = normalize(label);
    const possible = event.teams.map((team,index)=>({team,index})).filter(({team})=>{
      const name=normalize(team.name), abbr=normalize(team.abbreviation);
      return a.length>=2 && (a===abbr || a===name || a.length>=3 && (name.includes(a)||a.includes(name)));
    });
    if (possible.length===1) distinct.add(possible[0].index);
  }
  return distinct.size;
}
export function searchDates(request: AnalyzeRequest, features: PhotoFeatures): string[] {
  const date = new Date(request.capturedAt);
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: request.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const base = features.explicitDate || local;
  const center = new Date(base + 'T12:00:00Z');
  if (!Number.isFinite(center.getTime())) return [date.toISOString().slice(0, 10)];
  // Sports feeds use league-local schedule dates. Adjacent date covers cross-midnight broadcasts.
  return [base, new Date(center.getTime() - 86_400_000).toISOString().slice(0, 10), new Date(center.getTime() + 86_400_000).toISOString().slice(0, 10)];
}
export function periodNumber(raw: string | null): number | null {
  if (!raw) return null;
  const match = /(?:Q|quarter|period|第)?\s*([1-9])(?:st|nd|rd|th)?/i.exec(raw);
  if (match) return Number(match[1]);
  if (/first|第一/i.test(raw)) return 1;
  if (/second|第二/i.test(raw)) return 2;
  if (/third|第三/i.test(raw)) return 3;
  if (/fourth|第四/i.test(raw)) return 4;
  return null;
}
export function clockSeconds(raw?: string | null): number | null {
  if (!raw) return null;
  const m = /^(\d{1,2}):(\d{2}(?:\.\d+)?)$/.exec(raw.trim());
  if (m && Number(m[2]) < 60) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d+(?:\.\d+)?$/.test(raw.trim())) return Number(raw);
  return null;
}

export function eventTimeConsistent(request: AnalyzeRequest, features: PhotoFeatures, event: AnalysisEvent): boolean {
  const base=features.explicitDate ? Date.parse(features.explicitDate+'T12:00:00Z') : Date.parse(request.capturedAt);
  return event.status!=='scheduled' && Number.isFinite(base) && Date.parse(event.date)<=Date.parse(request.capturedAt)+15*60*1000 && Math.abs(Date.parse(event.date)-base)<=48*60*60*1000;
}
export function finalScoreConsistent(features: PhotoFeatures, event: AnalysisEvent): boolean {
  const printedFinal=/^(final|full.?time|完场|终场|最终)$/i.test(features.period||'') || features.visibleText.some(t=>/^(final|full.?time|完场|终场|最终)$/i.test(t.trim()));
  if (!printedFinal) return true;
  if (event.status!=='final' || event.teams.length!==2) return false;
  const visible=features.scores.flatMap(s=>s.match(/\d+(?:\.\d+)?/g)||[]);
  for(const team of event.teams){const i=visible.indexOf(team.score||'');if(i<0)return false;visible.splice(i,1);}
  return true;
}
