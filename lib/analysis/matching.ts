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
  const window=event.sport==='cricket'&&event.status==='live'?7*86_400_000:48*60*60*1000;
  return event.status!=='scheduled' && Number.isFinite(base) && Date.parse(event.date)<=Date.parse(request.capturedAt)+15*60*1000 && Math.abs(Date.parse(event.date)-base)<=window;
}
export function finalScoreConsistent(features: PhotoFeatures, event: AnalysisEvent): boolean {
  const printedFinal=/^(final|full.?time|完场|终场|最终)$/i.test(features.period||'') || features.visibleText.some(t=>/^(final|full.?time|完场|终场|最终)$/i.test(t.trim()));
  if (!printedFinal) return true;
  if (event.status!=='final' || event.teams.length!==2) return false;
  if(event.sport==='cricket'){
    const compact=(s:string)=>s.toLowerCase().replace(/\s+/g,'');
    const visible=features.scores.map(compact);
    for(const team of event.teams){if(!team.score)return false;const i=visible.indexOf(compact(team.score));if(i<0)return false;visible.splice(i,1);}
    return true;
  }
  const visible=features.scores.flatMap(s=>s.match(/\d+(?:\.\d+)?/g)||[]);
  for(const team of event.teams){const i=visible.indexOf(team.score||'');if(i<0)return false;visible.splice(i,1);}
  return true;
}

export function fullAthleteNameMatches(visible: string, recorded: string): boolean {
  const words=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).sort();
  const a=words(visible),b=words(recorded);
  return a.length>=2 && a.length===b.length && a.every((part,index)=>part===b[index]);
}
export function eventScopeContradicts(label: string | null | undefined,event:AnalysisEvent):boolean {
  if(!label)return false;
  const a=label.toLowerCase().replace(/(\d)\s*-\s*m\b/g,'$1m'),b=(event.name+' '+(event.phase||'')).toLowerCase();
  const category=(s:string,patterns:RegExp[])=>patterns.findIndex(p=>p.test(s));
  const conflicts=(patterns:RegExp[])=>{const left=category(a,patterns),right=category(b,patterns);return left>=0&&right>=0&&left!==right;};
  if(conflicts([/\bwom[ae]n(?:['’]s|s)?\b|女子/,/\bmen(?:['’]s|s)?\b|男子/]))return true;
  if(conflicts([/semi.?final|半决赛/,/quarter.?final|四分之一/,/qualification|prelim|预赛|资格赛/,/(?<!semi[ -]?)(?<!quarter[ -]?)\bfinals?\b|(?<!半)决赛/]))return true;
  const distance=(s:string)=>/\b(\d+(?:\.\d+)?)\s*m(?:et(?:re|er)s?)?\b/i.exec(s)?.[1];
  if(distance(a)&&distance(b)&&Number(distance(a))!==Number(distance(b)))return true;
  if(event.sport==='diving'&&conflicts([/springboard|跳板/,/platform|跳台/]))return true;
  if(event.sport==='swimming'&&conflicts([/freestyle|自由泳/,/backstroke|仰泳/,/breaststroke|蛙泳/,/butterfly|蝶泳/,/medley|混合泳/]))return true;
  if(event.sport==='gymnastics'&&conflicts([/all[ -]?around|全能/,/floor|自由体操/,/vault|跳马/,/uneven|高低杠/,/balance beam|平衡木/,/parallel bars|双杠/,/horizontal bar|high bar|单杠/,/pommel|鞍马/,/rings|吊环/,/trampoline|蹦床/,/rhythmic|艺术体操/]))return true;
  return false;
}
export function eventScopeMatches(label: string | null | undefined, event: AnalysisEvent): boolean {
  if(!label)return false;
  if(eventScopeContradicts(label,event))return false;
  const a=label.toLowerCase(),b=(event.name+' '+(event.phase||'')).toLowerCase();
  const women=(s:string)=>/\bwom[ae]n(?:'s|s)?\b|女子/.test(s);
  const men=(s:string)=>/\bmen(?:'s|s)?\b|男子/.test(s);
  if(women(a)&&men(b)||men(a)&&women(b))return false;
  if(/semi.?final|半决赛/.test(a)&&/\bfinals?\b/.test(b)&&!/semi.?final/.test(b))return false;
  if(/\bfinals?\b|决赛/.test(a)&&!/semi.?final|半决赛/.test(a)&&/semi.?final|qualification|prelim/.test(b))return false;
  const distance=(s:string)=>/\b(\d+(?:\.\d+)?)\s*m(?:et(?:re|er)s?)?\b/i.exec(s)?.[1];
  if(distance(a)&&distance(b)&&Number(distance(a))!==Number(distance(b)))return false;
  const ignored=new Set(['the','and','women','womens','woman','men','mens','s','final','finals','olympic','olympics','summer','paris','2024','individual']);
  const words=(a.match(/[a-z0-9]+/g)||[]).filter(t=>!ignored.has(t)&&t.length>=2);
  const normalized=normalize(b);
  return words.length>0 && words.every(t=>normalized.includes(t));
}
export function individualEvidence(features: PhotoFeatures, event: AnalysisEvent): boolean {
  if(eventScopeContradicts(features.eventLabel,event))return false;
  const matches=(event.competitors||[]).filter(c=>features.athletes.some(name=>fullAthleteNameMatches(name,c.name)));
  if(matches.length===0)return false;
  const visibleNumbers=features.scores.flatMap(s=>s.match(/\d+(?:\.\d+)?/g)||[]).map(Number);
  const scoreMatch=matches.some(({score})=>score!==undefined && /^\d+(?:\.\d+)?$/.test(score) && visibleNumbers.includes(Number(score)));
  return eventScopeMatches(features.eventLabel,event) || scoreMatch;
}
