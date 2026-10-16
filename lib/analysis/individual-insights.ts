import type { Locale } from '../match-types';
import { scoreIndividualDive } from '../matches/scoring';
import { countryInfo } from '../countries';
import { getAthleteMedia } from '../athlete-media';
import type { AnalysisPoint, AnalyzeResult, PhotoFeatures } from './types';
import type { EventCompetitor, IndividualSummary } from './individual-types';
import { fullAthleteNameMatches } from './matching';
import { sportRulePoint } from './sport-rules';

export function selectVisibleCompetitor(features:PhotoFeatures,competitors:EventCompetitor[]) {
  const people=competitors.filter(c=>features.athletes.some(a=>fullAthleteNameMatches(a,c.name)));
  return people.length===1?people[0]:null;
}
function supportedScore(value:string,scores:string[]) {
  const target=Number(value);return Number.isFinite(target)&&scores.some(s=>{const n=/^\d+(?:\.\d+)?$/.test(s.trim())?Number(s):null;return n!==null&&Math.abs(n-target)<.00001;});
}
export function individualMoment(features:PhotoFeatures,summary:IndividualSummary,locale:Locale): AnalyzeResult['moment'] {
  const person=selectVisibleCompetitor(features,summary.event.competitors);
  if(!person)return null;
  const possible=summary.rounds.filter(r=>fullAthleteNameMatches(r.athleteName,person.name)&&
    (features.round==null||features.round===r.round)&&supportedScore(r.score,features.scores)&&
    (features.difficulty==null||r.difficulty!==undefined&&Math.abs(features.difficulty-r.difficulty)<.00001));
  if(possible.length!==1)return null;
  const round=possible[0];
  if(summary.event.sport==='diving'&&round.judgeScores?.length===7&&round.difficulty){
    try{
      const scored=scoreIndividualDive(round.judgeScores,round.difficulty);
      if(Math.abs(Number(scored.formatted)-Number(round.score))>.001)return null;
      const label=locale==='zh'?`第 ${round.round} 跳 · ${round.score} 分`:`Dive ${round.round} · ${round.score} points`;
      const detail=locale==='zh'?`${person.name}：七位裁判评分中去掉两个最高和两个最低分，保留三项合计 ${scored.sum.toFixed(1)}，乘以难度 ${round.difficulty.toFixed(1)}，得到 ${scored.formatted} 分。此跳后的累计分为 ${round.total??'未提供'}。评分记录不能说明具体扣分原因。`:`${person.name}: remove the two highest and two lowest of seven judge awards. The retained three total ${scored.sum.toFixed(1)}; multiplied by difficulty ${round.difficulty.toFixed(1)}, this gives ${scored.formatted} points. Running total after this dive: ${round.total??'not supplied'}. These marks do not establish physical deduction reasons.`;
      return {label,detail,exact:true};
    }catch{return null;}
  }
  // A swimming split or a coincidentally equal score is not a pictured action.
  return null;
}
export function individualPoints(features:PhotoFeatures,summary:IndividualSummary,locale:Locale):AnalysisPoint[] {
  const zh=locale==='zh',live=summary.event.status==='live';const ids=summary.sources.map(s=>s.id);
  const person=selectVisibleCompetitor(features,summary.event.competitors);
  const podium=summary.event.competitors.filter(p=>p.rank!==undefined||p.score!==undefined).slice(0,3);
  const standingText=podium.map(p=>`${p.rank!==undefined?`${p.rank}. `:''}${p.name}${p.country?` (${p.country})`:''}${p.score!==undefined?` · ${p.score}`:''}`).join('\n');
  const points:AnalysisPoint[]=[{id:'event-results',kind:'score',x:.75,y:.3,title:live?(zh?'当前排名':'Current standings'):(zh?'官方成绩':'Event results'),summary:person?`${person.name} · ${person.score??(zh?'未提供成绩':'score unavailable')}`:(live?(zh?'数据源提供的当前成绩':'Available current standings'):(zh?'已公布的比赛结果':'Published results')),detail:(standingText||(zh?'数据源未提供名次或成绩。':'The provider did not supply placings or marks.'))+(zh?'\n这是该场赛事的记录，可能与照片中的中途成绩不同。':'\nThese event records can differ from an intermediate score in the photo.'),evidence:'provider',sourceIds:ids}];
  if(person){
    const media=getAthleteMedia(person.name);const athlete={...person,...(media?{image:media.src,profileUrl:media.sourceUrl}:{})};
    points.push({id:'event-athlete',kind:'athlete',x:.35,y:.45,title:zh?'认识这位选手':'Meet the athlete',summary:person.name,detail:`${person.country?countryInfo(person.country,locale).name:''}${person.rank!==undefined?` · ${zh?'官方名次':'Recorded place'} #${person.rank}`:''}${person.score!==undefined?` · ${zh?'成绩':'Result'} ${person.score}`:''}`,evidence:'provider',sourceIds:ids,athlete});
  }
  const moment=individualMoment(features,summary,locale);
  if(moment)points.push({id:'event-moment',kind:'moment',x:.72,y:.68,title:zh?'这一跳怎么算':'This dive, explained',summary:moment.label,detail:moment.detail,evidence:'provider',sourceIds:ids});
  const rule=sportRulePoint(summary.event.sport,locale);if(rule)points.push(rule.point);
  return points;
}
