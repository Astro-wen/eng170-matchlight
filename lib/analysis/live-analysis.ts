import type { AnalyzeRequest, AnalyzeResult, AnalysisEvent, PhotoFeatures } from './types';
import type { AnalysisConfig } from './config';
import { discoverLiveEvents, isCurrentEvent } from './live-discovery';
import { chooseEventWithJev, JevError } from './jev';
import { eventScopeContradicts, eventScopeMatches, fullAthleteNameMatches, finalScoreConsistent, visibleTeamCount } from './matching';
import { fetchEventSummary } from './espn';
import { fetchCricketSummary } from './espn-cricket';
import { fetchAquaticsEvent } from './world-aquatics';
import { fetchCurrentOlympicSummary } from './current-olympics';
import { gameInsights, locateMoment } from './insights';
import { individualPoints, individualMoment } from './individual-insights';
import { arrangePoints } from './individual-analysis';
import type { IndividualSummary } from './individual-types';

const key = (event: AnalysisEvent) => `${event.league}:${event.id}`;
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function liveCompatible(features: PhotoFeatures, event: AnalysisEvent, checkedAt: string): boolean {
  if (features.sport !== event.sport || !isCurrentEvent(event, checkedAt) || eventScopeContradicts(features.eventLabel, event)) return false;
  // An explicitly old printed date cannot silently become a current broadcast.
  if (features.explicitDate && Math.abs(Date.parse(features.explicitDate+'T12:00:00Z')-Date.parse(checkedAt))>36*3_600_000) return false;
  if (!finalScoreConsistent(features, event)) return false;
  if (event.teams.length && features.teams.some(label => !event.teams.some(team => {
    const text=normalize(label),name=normalize(team.name),abbr=normalize(team.abbreviation);
    return text.length>=2 && (text===abbr||text===name||text.length>=3&&(name.includes(text)||text.includes(name)));
  }))) return false;
  return true;
}

function distinguishingEvidence(features: PhotoFeatures, event: AnalysisEvent): number {
  const people=event.competitors?.filter(person=>features.athletes.some(name=>fullAthleteNameMatches(name,person.name))).length??0;
  return 10*(visibleTeamCount(features,event)+people)+Number(eventScopeMatches(features.eventLabel,event));
}

export async function analyzeLive(request: AnalyzeRequest, config: AnalysisConfig, result: AnalyzeResult, fetcher: typeof fetch): Promise<AnalyzeResult> {
  const zh=request.locale==='zh',features=result.features;
  result.mode='live';
  const search=await discoverLiveEvents({sport:features.sport,league:features.league,query:[features.eventLabel,...features.athletes].filter(Boolean).join(' ').slice(0,1000)},fetcher);
  result.sources.push(...search.sources);
  result.trace.push({stage:'scoreboard',status:search.status==='ok'?'ok':search.status==='unsupported'?'skipped':'unavailable',detail:`Current-event discovery: ${search.events.length} active; ${search.failedProviders.length} failed providers`});
  const discovery=result.discovery={checkedAt:search.checkedAt,activeCount:search.events.length,status:'empty' as NonNullable<AnalyzeResult['discovery']>['status'],detail:''};
  const coverageNote=search.limited?(zh?'查询范围受已接入数据源限制。':'Coverage is limited to the connected feeds.'):(zh?'赛事状态来自当前数据查询。':'Event state comes from the current provider lookup.');
  result.coverage={sport:features.sport,label:zh?'当前赛事':'Current events',detail:coverageNote};
  result.limitations=[zh?'数据更新可能存在延迟；当前赛况不一定与照片中的进度相同。':'Provider updates can be delayed; the current record may differ from the photo’s progress.'];
  if(search.status!=='ok'){
    discovery.status=search.status;
    result.message=search.status==='unsupported'?(zh?'已识别画面项目，但还没有可查询的当前赛事数据源。可以先查看照片线索与规则。':'The sport is visible, but a current-event feed is not connected yet. Explore the photo clues and rules.'):(zh?'当前赛事查询未能完成，暂时无法判断是否有比赛正在进行。请稍后重试。':'Current-event lookup could not finish. We cannot yet tell whether a match is in progress. Please retry.');
    discovery.detail=result.message;return arrangePoints(result);
  }
  if(!search.events.length){
    result.message=zh?'已查询当前赛事，在已核实的数据中尚未确认有正在进行的这类比赛。可以稍后重试，或切到回放模式查看历史比赛。':'No in-progress event was confirmed in the verified provider records. Try again later, or choose Replay for an older match.';
    discovery.detail=result.message;return arrangePoints(result);
  }
  const compatible=search.events.filter(event=>liveCompatible(features,event,search.checkedAt)).sort((a,b)=>Number(distinguishingEvidence(features,b))-Number(distinguishingEvidence(features,a)));
  const best=compatible[0]?distinguishingEvidence(features,compatible[0]):0;
  const distinct=compatible.filter(event=>best>0&&distinguishingEvidence(features,event)===best);
  // Current context can associate a single candidate from the visible sport alone.
  // Several active candidates require a visible distinguishing clue, never model confidence alone.
  const eligible=compatible.length===1?compatible:distinct.length===1?distinct:[];
  result.candidates=compatible.slice(0,12);
  result.outcome='needs_confirmation';discovery.status='ambiguous';
  let selected:AnalysisEvent|undefined;
  if(request.selectedEvent){
    selected=compatible.find(event=>key(event)===`${request.selectedEvent!.league}:${request.selectedEvent!.eventId}`);
    if(selected)result.matchMethod='user';
  }else if(config.jevKey&&eligible.length===1){
    try{
      const decision=await chooseEventWithJev({features,capturedAt:request.capturedAt,hint:request.hint,liveContext:{checkedAt:search.checkedAt,activeCount:search.events.length},candidates:compatible.slice(0,12).map(event=>({...event,name:event.name.slice(0,240),competitors:event.competitors?.slice(0,24).map(c=>({name:c.name.slice(0,160),country:c.country,score:c.score}))}))},{apiKey:config.jevKey,model:config.jevModel},fetcher);
      result.models.decision=decision.model;result.trace.push({stage:'decision',status:'ok',detail:`${decision.model}: choice=${decision.eventId??'none'} confidence=${decision.confidence.toFixed(3)} compatibility=${decision.evidence.toFixed(3)}`});
      if(decision.eventId===eligible[0].id&&decision.confidence>=.8&&decision.evidence>=.8){selected=eligible[0];result.matchMethod='current';}
    }catch(error){result.trace.push({stage:'decision',status:'unavailable',detail:`Current-event decision unavailable (${error instanceof JevError?error.code:'error'}); confirmation required`});}
  }else if(!config.jevKey&&eligible.length===1){selected=eligible[0];result.matchMethod='current';}
  if(!selected){
    result.message=!compatible.length?(zh?'当前赛事与照片中的日期、队名或项目线索不符。可以补充线索，或切到回放模式。':'Current events conflict with the printed date, teams or event scope in your photo. Edit the clues or choose Replay.'):(zh?`查到 ${search.events.length} 场正在进行的比赛，仍需确认照片对应哪场。请选择候选，或补充画面中的项目、队名与国家线索。`:`Found ${search.events.length} in-progress event(s). Confirm which one you are watching, or add visible event, team or country clues.`);
    discovery.detail=result.message;return arrangePoints(result);
  }
  try{
    let summary:IndividualSummary|Awaited<ReturnType<typeof fetchEventSummary>>;
    if(selected.league==='worldaquatics')summary=await fetchAquaticsEvent({eventId:selected.id,fresh:true},fetcher);
    else if(selected.league==='espn-current-olympics')summary=await fetchCurrentOlympicSummary({eventId:selected.id},fetcher);
    else if(selected.league.startsWith('cricket-'))summary=await fetchCricketSummary({league:selected.league,eventId:selected.id},fetcher);
    else summary=await fetchEventSummary({league:selected.league,eventId:selected.id},fetcher);
    if(key(summary.event)!==key(selected)||!isCurrentEvent(summary.event,new Date().toISOString())){
      result.matchMethod='none';discovery.status='unavailable';result.message=zh?'赛事状态在查询详情时发生了变化，暂时无法确认仍在进行。请刷新查询。':'The event state changed while loading details. Its in-progress status is no longer confirmed. Please check again.';discovery.detail=result.message;return arrangePoints(result);
    }
    result.event=summary.event;result.outcome='matched';result.temporal='live';result.candidates=[];
    const sources=new Map([...result.sources,...summary.sources].map(source=>[source.id,source]));result.sources=[...sources.values()];
    result.statistics=[{label:zh?'比赛进度':'Event progress',value:summary.event.statusDetail||('phase' in summary.event?summary.event.phase:undefined)||summary.event.clock||'In progress'},...(summary.event.clock?[{label:zh?'赛事时钟':'Event clock',value:summary.event.clock}]:[])];
    const photo=result.points.filter(point=>point.evidence==='photo').slice(0,1),rules=result.points.filter(point=>point.evidence==='rule');
    if('rounds' in summary){
      result.points=[...photo,...individualPoints(features,summary,request.locale)];result.moment=individualMoment(features,summary,request.locale);
      result.statistics.push(...summary.event.competitors.map(person=>({label:zh?'当前成绩':'Recorded result',subject:person.name,value:[person.country,person.rank!==undefined?`#${person.rank}`:null,person.score].filter(Boolean).join(' · ')||'—'})),...summary.rounds.map(round=>({label:`${summary.event.sport==='swimming'?(zh?'分段':'Split'):(zh?'跳次':'Dive')} ${round.round}${summary.event.sport==='swimming'&&round.actionCode?` · ${round.actionCode}`:''}`,subject:round.athleteName,value:[round.score,summary.event.sport==='diving'?round.actionCode:null,round.difficulty!==undefined?`DD ${round.difficulty}`:null,round.total?`${zh?'累计':'Total'} ${round.total}`:null,round.judgeScores?`${zh?'裁判':'Judges'} ${round.judgeScores.join(', ')}`:null].filter(Boolean).join(' · ')})));
      result.limitations.push(...summary.limitations);
    }else{
      const insights=await gameInsights(request,features,summary,config,fetcher);result.models.explanation=insights.generated?config.explanationModel:null;
      result.points=[...photo,...insights.points,...rules];result.moment=locateMoment(features,summary,request.locale);
      result.statistics.push(...summary.event.teams.map(team=>({label:zh?'当前比分':'Current score',subject:team.name,value:team.score??'—'})),...(summary.statistics||[]).map(stat=>({label:stat.label,value:stat.value,subject:summary.event.teams.find(team=>team.id===stat.teamId)?.name})),...(summary.leaders||[]).map(leader=>({label:leader.category,value:leader.value,subject:leader.athlete})));
    }
    result.headline=summary.event.name;discovery.status='matched';
    discovery.detail=zh?`已从当前候选关联赛事。${coverageNote}`:`Linked an event from the current candidates. ${coverageNote}`;
    result.message=zh?'已关联当前赛事并取得赛况。点开照片上的看点，查看选手、成绩和比赛背景。':'Current event linked and details retrieved. Tap the photo points for competitors, scores and context.';
    if(result.matchMethod==='current')result.limitations.push(zh?'此次关联依据当前直播场景与画面线索；它不证明照片属于该赛事或某个具体动作。':'This association uses the current-live context and visible clues; it does not independently prove the photograph belongs to this event or a specific action.');
    result.trace.push({stage:'summary',status:'ok',detail:`Current ${selected.league} ${selected.id}`});
    result.generatedAt=new Date().toISOString();return arrangePoints(result);
  }catch{
    result.matchMethod='none';discovery.status='unavailable';result.message=zh?'已找到当前赛事，但详情暂时没有加载成功。请重试。':'A current event was found, but its details did not load. Please retry.';discovery.detail=result.message;
    result.trace.push({stage:'summary',status:'unavailable',detail:'Current event details unavailable'});return arrangePoints(result);
  }
}
