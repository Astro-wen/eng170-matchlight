import { randomUUID } from 'node:crypto';
import type { AnalyzeRequest, AnalyzeResult, AnalysisSource } from './types';
import { type AnalysisConfig } from './config';
import { ESPN_LEAGUES, fetchScoreboard, fetchEventSummary, type EspnEvent } from './espn';
import { chooseEventWithJev } from './jev';
import { readPhoto } from './vision';
import { gameInsights, locateMoment, photoPoints } from './insights';
import { eventTimeConsistent, finalScoreConsistent, searchDates, visibleTeamCount } from './matching';

export async function analyzePhoto(request: AnalyzeRequest, config: AnalysisConfig, fetcher: typeof fetch = fetch): Promise<AnalyzeResult> {
  const zh = request.locale === 'zh';
  const trace: AnalyzeResult['trace'] = [];
  const features = await readPhoto(request, config, ESPN_LEAGUES.map(x=>x.key), fetcher);
  trace.push({stage:'vision',status:'ok',detail:config.visionModel});
  const result: AnalyzeResult = {
    id:randomUUID(), generatedAt:new Date().toISOString(), capturedAt:request.capturedAt, outcome:'unmatched',matchMethod:'none',
    headline: zh ? '画面里的线索' : 'Clues in your photo', message:'', features,event:null,candidates:[],points:photoPoints(features), sources:[],temporal:'unknown',moment:null,trace,
    models:{vision:config.visionModel,decision:null,explanation:null},
  };
  let selected: EspnEvent | undefined;
  const sources = new Map<string, AnalysisSource>();
  if (request.selectedEvent) {
    const summary = await fetchEventSummary(request.selectedEvent, fetcher);
    selected = summary.event;
    trace.push({stage:'decision',status:'ok',detail:'User-confirmed event'});
    result.matchMethod = 'user';
    return finish(summary);
  }
  const leagues = features.league ? [features.league] : ESPN_LEAGUES.filter(x=>x.sport === features.sport.toLowerCase()).slice(0,2).map(x=>x.key);
  if (!leagues.length) {
    result.message = zh ? '看到了运动画面，但这个项目还没有接入赛事数据。可以识别画面线索，暂时无法确认比赛或实时比分。' : 'This sport does not have a connected event feed yet. The visible clues are available, but the game and live score are unconfirmed.';
    trace.push({stage:'scoreboard',status:'skipped',detail:'No supported event feed for the visible sport'});
    return result;
  }
  const dates = searchDates(request, features);
  const queries = leagues.flatMap(league=>dates.map(date=>({league,date}))).slice(0,6);
  const boards = await Promise.allSettled(queries.map(query=>fetchScoreboard(query,fetcher)));
  const candidates = new Map<string, EspnEvent>(); let successful = 0;
  boards.forEach((board,i)=>{
    if (board.status === 'fulfilled') { successful++; board.value.events.forEach(event=>candidates.set(`${event.league}:${event.id}`, event)); board.value.sources.forEach(s=>sources.set(s.id,s)); }
    trace.push({stage:'scoreboard',status:board.status==='fulfilled'?'ok':'unavailable',detail:`ESPN ${queries[i].league} ${queries[i].date}`});
  });
  const ranked = [...candidates.values()].sort((a,b)=>visibleTeamCount(features,b)-visibleTeamCount(features,a));
  const identified = ranked.filter(e=>visibleTeamCount(features,e)>0);
  result.candidates = (identified.length ? identified : ranked).slice(0,12);
  result.sources = [...sources.values()];
  if (!result.candidates.length) {
    result.message = zh ? successful ? '这个日期附近没有找到吻合的比赛。请补充球队、联赛或调整拍摄时间；旧视频需要选择原比赛日期。' : '赛事数据暂时没有响应。画面线索已保留，请稍后重试。' : successful ? 'No matching games were found near this date. Add a team or league hint, or change the capture date for a replay.' : 'The event feed did not respond. Your visible clues are available; please retry.';
    return result;
  }
  result.outcome = 'needs_confirmation';
  if (config.jevKey) {
    try {
      const decision = await chooseEventWithJev({features,candidates:result.candidates,capturedAt:request.capturedAt,hint:request.hint},{apiKey:config.jevKey,model:config.jevModel},fetcher);
      result.models.decision = decision.model;
      trace.push({stage:'decision',status:'ok',detail:decision.model});
      const chosen = result.candidates.find(e=>e.id===decision.eventId);
      // A model confidence number alone cannot establish event identity. Two independent
      // visible team identifiers and a unique candidate on these dates are required.
      if (chosen && decision.confidence >= .8 && decision.evidence >= .8 && visibleTeamCount(features,chosen) >= 2 && eventTimeConsistent(request,features,chosen) && finalScoreConsistent(features,chosen) && result.candidates.filter(e=>visibleTeamCount(features,e)>=2).length === 1) { selected=chosen; result.matchMethod='jev'; }
    } catch { trace.push({stage:'decision',status:'unavailable',detail:'TypeSafe decision unavailable; confirmation required'}); }
  } else {
    trace.push({stage:'decision',status:'skipped',detail:'TypeSafe is not configured'});
    const unique = result.candidates.filter(e=>visibleTeamCount(features,e)>=2);
    if (unique.length===1 && eventTimeConsistent(request,features,unique[0]) && finalScoreConsistent(features,unique[0])) {selected=unique[0];result.matchMethod='vision';}
  }
  if (!selected) {
    result.message = zh ? '找到了候选比赛，画面线索还不足以自动确认。选择你正在看的比赛，或补充线索后重新分析。' : 'Possible games found. The visible clues are not strong enough to confirm one automatically. Choose your game or add a hint and try again.';
    return result;
  }
  try { return await finish(await fetchEventSummary({league:selected.league,eventId:selected.id},fetcher)); }
  catch {
    trace.push({stage:'summary',status:'unavailable',detail:'ESPN event detail unavailable'});
    result.matchMethod='none';result.message=zh?'已找到候选比赛，但详情没有加载成功。请重试。':'A possible game was found, but its details did not load. Please retry.';
    return result;
  }

  async function finish(summary: Awaited<ReturnType<typeof fetchEventSummary>>): Promise<AnalyzeResult> {
    const event = summary.event;
    summary.sources.forEach(s=>sources.set(s.id,s)); result.sources=[...sources.values()];
    trace.push({stage:'summary',status:'ok',detail:`ESPN ${event.league} ${event.id}`});
    result.outcome='matched'; result.event=event;result.candidates=[];
    const captureNearNow = Math.abs(Date.now()-Date.parse(request.capturedAt))<4*60*60*1000;
    result.temporal=event.status==='final'?'historical':event.status==='scheduled'?'scheduled':event.status==='live' && captureNearNow && Math.abs(Date.now()-Date.parse(event.date))<86_400_000?'live':'unknown';
    result.moment=locateMoment(features,summary,request.locale);
    const insights=await gameInsights(request,features,summary,config,fetcher);
    result.points=[...result.points.slice(0,2),...insights.points];
    // Keep tap targets distinct when a photo observation and an event fact share an anchor.
    for(let i=1;i<result.points.length;i++){
      const point=result.points[i];let tries=0;
      while(result.points.slice(0,i).some(p=>Math.abs(p.x-point.x)<.18 && Math.abs(p.y-point.y)<.16) && tries<8){
        point.y=point.y+.2<=.9?point.y+.2:.15;tries++;
      }
    }
    result.models.explanation=insights.generated?config.explanationModel:null;
    trace.push({stage:'insights',status:insights.generated?'ok':'unavailable',detail:insights.generated?config.explanationModel:'Using verified ESPN facts; insight selection unavailable'});
    result.headline=event.name;
    result.message=zh ? result.matchMethod==='user'?'已关联你确认的比赛。点击照片上的看点查看解释。':result.moment?.exact?'已匹配比赛和画面上的回合。点击看点，了解这一刻。':'已匹配比赛。具体回合尚未确认；照片线索与赛事记录分别标注。' : result.matchMethod==='user'?'Linked to the game you confirmed. Tap a point to understand more.':result.moment?.exact?'Game and visible play matched. Tap a point to understand this moment.':'Game matched. The exact play is unconfirmed; photo clues and event records are labeled separately.';
    result.generatedAt=new Date().toISOString();
    return result;
  }
}
