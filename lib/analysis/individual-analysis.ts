import type { AnalyzeRequest, AnalyzeResult, AnalysisSource } from './types';
import type { IndividualEvent, IndividualSearch, IndividualSummary, IndividualSport } from './individual-types';
import type { AnalysisConfig } from './config';
import { EspnProviderError } from './espn';
import { searchEspnOlympics, fetchEspnOlympicSummary } from './espn-olympics';
import { findAquaticsEvents, fetchAquaticsEvent } from './world-aquatics';
import { findOlympicEvents, fetchOlympicEvent } from './olympic-archive';
import { chooseEventWithJev } from './jev';
import { searchDates, individualEvidence, fullAthleteNameMatches, eventScopeMatches, eventScopeContradicts, eventTimeConsistent } from './matching';
import { individualMoment, individualPoints } from './individual-insights';
import { sportRulePoint } from './sport-rules';

const labels={diving:{en:'Diving',zh:'跳水'},swimming:{en:'Swimming',zh:'游泳'},gymnastics:{en:'Gymnastics',zh:'体操'},athletics:{en:'Athletics',zh:'田径'}};
export function arrangePoints(result:AnalyzeResult):AnalyzeResult {
  result.points=result.points.slice(0,6);
  for(let i=1;i<result.points.length;i++){
    const point=result.points[i];let tries=0;
    while(result.points.slice(0,i).some(p=>Math.abs(p.x-point.x)<.18&&Math.abs(p.y-point.y)<.16)&&tries<8){point.y=point.y+.2<=.9?point.y+.2:.15;tries++;}
  }
  return result;
}
export async function fetchIndividualSummary(selection:{league:string;eventId:string},fetcher:typeof fetch):Promise<IndividualSummary> {
  if(selection.league==='espn-olympics')return fetchEspnOlympicSummary(selection,fetcher);
  if(selection.league==='worldaquatics')return fetchAquaticsEvent(selection,fetcher);
  if(selection.league==='paris2024')return fetchOlympicEvent(selection,fetcher);
  throw new Error('Unsupported individual provider');
}
export function sameRecordedEvent(a:IndividualEvent,b:IndividualEvent):boolean {
  if(a.sport!==b.sport || Math.abs(Date.parse(a.date)-Date.parse(b.date))>36*60*60*1000)return false;
  if(eventScopeContradicts(a.name+' '+(a.phase||''),b)||eventScopeContradicts(b.name+' '+(b.phase||''),a))return false;
  const mark=(s:string|undefined)=>{if(s===undefined)return NaN;if(/^\d+(?:\.\d+)?$/.test(s))return Number(s);const time=/^(\d+):([0-5]\d(?:\.\d+)?)$/.exec(s);return time?Number(time[1])*60+Number(time[2]):NaN;};
  const same=a.competitors.filter(x=>Number.isFinite(mark(x.score))&&b.competitors.some(y=>fullAthleteNameMatches(x.name,y.name)&&Math.abs(mark(x.score)-mark(y.score))<.00001));
  return same.length>=2;
}

export async function analyzeIndividual(request:AnalyzeRequest,config:AnalysisConfig,result:AnalyzeResult,fetcher:typeof fetch):Promise<AnalyzeResult> {
  const features=result.features,sport=features.sport as IndividualSport,zh=request.locale==='zh';
  const dates=searchDates(request,features);const sources=new Map<string,AnalysisSource>(result.sources.map(s=>[s.id,s]));
  result.coverage={sport,label:labels[sport]?.[request.locale]||sport,detail:zh?'ESPN 巴黎 2024 成绩；水上项目补充官方记录。查询时间与比赛时间分别显示。':'ESPN Paris 2024 results, with official aquatic records where available. Lookup time and event time are separate.'};
  let candidates:IndividualEvent[]=[];let successes=0;let aquatics:IndividualSearch|undefined;
  const collect=(value:IndividualSearch)=>{successes++;candidates.push(...value.events);value.sources.forEach(s=>sources.set(s.id,s));};
  if(request.selectedEvent){result.matchMethod='user';return finish(await fetchIndividualSummary(request.selectedEvent,fetcher));}
  const boards=await Promise.allSettled(dates.map(date=>searchEspnOlympics({sport,date},fetcher)));
  boards.forEach((board,i)=>{if(board.status==='fulfilled')collect(board.value);result.trace.push({stage:'scoreboard',status:board.status==='fulfilled'?'ok':'unavailable',detail:`ESPN Olympics ${dates[i]}${board.status==='rejected'&&board.reason instanceof EspnProviderError?` (${board.reason.code}${board.reason.upstreamStatus?` ${board.reason.upstreamStatus}`:''})`:''}`});});
  if(!candidates.some(e=>individualEvidence(features,e))&&(sport==='diving'||sport==='swimming')){
    try{aquatics=await findAquaticsEvents({sport,date:dates[0],query:[features.eventLabel,...features.athletes].filter(Boolean).join(' ').slice(0,1000)},fetcher);collect(aquatics);result.trace.push({stage:'scoreboard',status:'ok',detail:`World Aquatics ${dates[0]}`});}
    catch{result.trace.push({stage:'scoreboard',status:'unavailable',detail:'World Aquatics lookup unavailable'});}
  }
  if(!candidates.some(e=>individualEvidence(features,e))){
    try{collect(await findOlympicEvents({sport,date:dates[0]},fetcher));result.trace.push({stage:'scoreboard',status:'ok',detail:`Paris 2024 archive ${dates[0]}`});}
    catch{result.trace.push({stage:'scoreboard',status:'unavailable',detail:'Paris 2024 archive unavailable'});}
  }
  const unique=[...new Map(candidates.map(c=>[c.id,c])).values()];
  // A provider can describe the same final under a second ID. Keep ESPN first.
  candidates=[];
  for(const candidate of unique){if(!candidates.some(e=>sameRecordedEvent(e,candidate)))candidates.push(candidate);}
  const rank=(e:IndividualEvent)=>Number(individualEvidence(features,e))*100+Number(eventScopeMatches(features.eventLabel,e))*10+Number(e.competitors.some(c=>features.athletes.some(n=>fullAthleteNameMatches(n,c.name))));
  candidates.sort((a,b)=>rank(b)-rank(a));
  result.candidates=candidates.slice(0,12);result.sources=[...sources.values()];
  if(!result.candidates.length){
    result.message=zh?successes?'这个日期未找到可确认的比赛。可检查原比赛日期或补充画面上的选手姓名；先点开规则看点。':'赛事数据暂时未能完成查询。画面线索和规则已保留，可稍后重试。':successes?'No confirmed event was found for this date. Check the original event date or add a readable athlete name. You can still explore the rule point.':'The event lookup did not complete. Photo clues and rules remain available; please retry.';
    return arrangePoints(result);
  }
  result.outcome='needs_confirmation';let selected:IndividualEvent|undefined;
  const strong=candidates.filter(e=>individualEvidence(features,e)&&eventTimeConsistent(request,features,e));
  if(config.jevKey){
    try{
      const decision=await chooseEventWithJev({features,candidates:result.candidates.map(e=>({...e,competitors:(e.competitors||[]).filter(c=>features.athletes.some(n=>fullAthleteNameMatches(n,c.name))).concat(e.competitors||[]).filter((c,i,a)=>a.findIndex(v=>v.id===c.id)===i).slice(0,24)})),capturedAt:request.capturedAt,hint:request.hint},{apiKey:config.jevKey,model:config.jevModel},fetcher);
      result.models.decision=decision.model;result.trace.push({stage:'decision',status:'ok',detail:decision.model});
      if(strong.length===1&&decision.eventId===strong[0].id&&decision.confidence>=.8&&decision.evidence>=.8){selected=strong[0];result.matchMethod='jev';}
    }catch{result.trace.push({stage:'decision',status:'unavailable',detail:'TypeSafe decision unavailable; confirmation required'});}
  }else if(strong.length===1){selected=strong[0];result.matchMethod='vision';result.trace.push({stage:'decision',status:'skipped',detail:'TypeSafe is not configured'});}
  if(!selected){result.message=zh?'找到了可能的赛事，仍需确认具体项目或选手。请按照片内容选择比赛，或补充可读姓名与项目后重试。':'Possible events found. Confirm the event shown in the photo, or add a readable athlete name and event label before retrying.';return arrangePoints(result);}
  try{return await finish(await fetchIndividualSummary({league:selected.league,eventId:selected.id},fetcher));}
  catch{result.matchMethod='none';result.trace.push({stage:'summary',status:'unavailable',detail:'Event details unavailable'});result.message=zh?'找到了候选赛事，但详情查询失败，请重试。':'A possible event was found, but its details did not load. Please retry.';return arrangePoints(result);}

  async function finish(summary:IndividualSummary):Promise<AnalyzeResult>{
    const resultSport=summary.event.sport as IndividualSport;
    if(summary.event.provider==='espn-olympics'&&(resultSport==='diving'||resultSport==='swimming')){
      try{
        aquatics??=await findAquaticsEvents({sport:resultSport,date:summary.event.date.slice(0,10),query:summary.event.name.slice(0,1000)},fetcher);
        const agrees=aquatics.events.filter(e=>sameRecordedEvent(summary.event,e));
        if(agrees.length===1){
          const official=await fetchAquaticsEvent({eventId:agrees[0].id},fetcher);
          summary={...summary,event:{...summary.event,competitors:official.event.competitors},rounds:official.rounds,sources:[...summary.sources,...official.sources],limitations:[...summary.limitations,...official.limitations]};
          result.trace.push({stage:'summary',status:'ok',detail:'World Aquatics official detail verified against ESPN placings'});
        }
      }catch{result.trace.push({stage:'summary',status:'unavailable',detail:'Supplementary official aquatic detail unavailable'});}
    }
    summary.sources.forEach(s=>sources.set(s.id,s));const rule=sportRulePoint(resultSport,request.locale);if(rule)sources.set(rule.source.id,rule.source);
    result.sources=[...sources.values()];result.outcome='matched';result.event=summary.event;result.candidates=[];
    result.temporal=summary.event.dataMode==='historical'||summary.event.status==='final'?'historical':summary.event.status==='scheduled'?'scheduled':'unknown';
    result.headline=summary.event.name;result.moment=individualMoment(features,summary,request.locale);
    result.points=[...result.points.filter(p=>p.evidence==='photo').slice(0,result.moment?1:2),...individualPoints(features,summary,request.locale)];
    result.limitations=summary.limitations;
    result.coverage!.detail=zh?summary.event.provider==='espn-olympics'?'ESPN 奥运成绩，已按原赛事日期查询。':'已查询公开赛事记录，数据源与时间见下方。':summary.event.provider==='espn-olympics'?'ESPN Olympic results, queried for the original event date.':'Public event records retrieved; sources and timestamps are shown below.';
    result.trace.push({stage:'summary',status:'ok',detail:`${summary.event.provider} ${summary.event.id}`});
    result.message=zh?result.moment?'已匹配比赛与这一跳的评分记录。点开看点，了解选手和计分。':'已关联赛事成绩。点击选手、成绩和规则看点；单张照片未确认具体动作。':result.moment?'Event and dive scoring record matched. Tap to explore the athlete and calculation.':'Event results linked. Explore athletes, results and rules; the exact pictured action is unconfirmed.';
    result.generatedAt=new Date().toISOString();return arrangePoints(result);
  }
}
