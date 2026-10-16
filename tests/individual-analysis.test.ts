import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePhoto } from '../lib/analysis/analyze';
import { individualMoment, individualPoints } from '../lib/analysis/individual-insights';
import { individualEvidence, fullAthleteNameMatches, eventScopeMatches } from '../lib/analysis/matching';
import { sportRulePoint, TARGET_SPORTS } from '../lib/analysis/sport-rules';
import { sameRecordedEvent } from '../lib/analysis/individual-analysis';
import type { PhotoFeatures } from '../lib/analysis/types';
import type { IndividualEvent, IndividualSummary } from '../lib/analysis/individual-types';
import { GET as coverage } from '../app/api/coverage/route';
const feature:PhotoFeatures={sport:'diving',league:null,visibleText:['CHEN Yiwen','76.50','3.0',"Women's 3m Springboard Final"],teams:[],athletes:['CHEN Yiwen'],scores:['76.50','376.00'],clock:null,period:'Final',explicitDate:null,observations:[{label:'Athlete name',detail:'CHEN Yiwen printed on the scoreboard',x:.3,y:.4}],limitations:[],countries:['CHN'],eventLabel:"Women's 3m springboard final",round:5,difficulty:3};
const athlete={id:'a',name:'CHEN Yiwen',country:'CHN',rank:1,score:'376.00'};
const event:IndividualEvent={id:'espn-olym-summer-2024-20240809-30401',league:'espn-olympics',provider:'espn-olympics',sport:'diving',name:"Paris 2024 · Women's 3m Springboard Final",date:'2024-08-09T13:00:00Z',status:'final',dataMode:'historical',teams:[],competitors:[athlete,{id:'b',name:'Maddison KEENEY',country:'AUS',rank:2,score:'343.10'}]};
const summary:IndividualSummary={event,fetchedAt:'2026-10-15T09:00:00Z',sources:[{id:'source',label:'Official records',url:'https://api.worldaquatics.com/fina/events/ef62ff76-092c-4d34-882d-e247cd6a0310',fetchedAt:'2026-10-15T09:00:00Z'}],rounds:[{athleteId:'a',athleteName:'CHEN Yiwen',round:5,score:'76.50',total:'376.00',difficulty:3,judgeScores:[8.5,8.5,8,9,8.5,8.5,8.5]}],limitations:[]};
const config={openrouterKey:'router-test',jevKey:'jev-test',visionModel:'vision-test',explanationModel:'facts-test',jevModel:'jev-latest'};
const request={mode:"replay" as const,imageDataUrl:'data:image/jpeg;base64,'+Buffer.from('\xff\xd8\xff'+ 'x'.repeat(100),'latin1').toString('base64'),capturedAt:'2024-08-09T15:00:00Z',timeZone:'Europe/Paris',locale:'en' as const};
function upstream(features=feature){
 const calls:string[]=[];const fetcher=(async(input:string|URL|Request,init?:RequestInit)=>{
  const url=String(input);calls.push(url);
  if(url.includes('openrouter.ai'))return Response.json({choices:[{message:{content:JSON.stringify(features)}}]});
  if(url.includes('api.typesafe.ai'))return Response.json({model:'jev-1.13.0',answers:{event:{type:'choice',choice:'event_'+event.id,confidence:.98,probabilities:{none:.02,['event_'+event.id]:.98}},evidence:{type:'noul',noul:.98}}});
  if(url.includes('/olympics/summer/2024/results')){
   const date=new URL(url).searchParams.get('dates')!;const day=`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
   return Response.json({season:{year:2024,type:'summer'},day:{date:day},competitions:day!=='2024-08-09'?[]:[{id:'30401',date:event.date,description:"Women's 3m Springboard Final",discipline:{id:'16'},competitionType:'individual',olympicsStatus:{completed:true,state:'post',description:'Final'},results:event.competitors.map(p=>({athlete:{id:p.id,displayName:p.name},country:{abbreviation:p.country},place:p.rank,result:p.score}))}]});
  }
  return new Response('',{status:503});
 }) as typeof fetch;return{fetcher,calls};
}
test('all five target sports have official-reference rule points, including unmatched photos',async()=>{
 for(const sport of TARGET_SPORTS){for(const locale of ['en','zh'] as const){const rule=sportRulePoint(sport,locale)!;assert.equal(rule.point.evidence,'rule');assert.match(rule.source.url,/^https:\/\//);assert.ok(rule.point.detail.length>40);}}
 const {fetcher}=upstream({...feature,athletes:[],eventLabel:null});const result=await analyzePhoto(request,config,fetcher);assert.equal(result.outcome,'needs_confirmation');assert.ok(result.points.some(p=>p.evidence==='rule'));assert.equal(result.event,null);
});
test('individual matching requires a full printed name plus score or event scope; no face/country shortcut',()=>{
 assert.equal(fullAthleteNameMatches('Yiwen CHEN','CHEN Yiwen'),true);assert.equal(fullAthleteNameMatches('CHEN','CHEN Yiwen'),false);
 assert.equal(individualEvidence(feature,event),true);assert.equal(individualEvidence({...feature,athletes:[],teams:['CHN']},event),false);
 assert.equal(individualEvidence({...feature,athletes:['CHEN'],eventLabel:null,scores:[]},event),false);
 assert.equal(eventScopeMatches("Men's 3m Springboard Final",event),false);assert.equal(eventScopeMatches("Women's 10m platform final",event),false);
 assert.equal(individualEvidence({...feature,eventLabel:"Women's 10m Platform Final"},event),false);
 assert.equal(individualEvidence({...feature,eventLabel:"Women's 3m Springboard Semifinal"},event),false);
 assert.equal(individualEvidence({...feature,athletes:['CHEN Yiwen','Maddison KEENEY']},event),true);
});
test('ESPN Olympic response flows through JEV to historical athlete/country/result/rule points',async()=>{
 const {fetcher,calls}=upstream();const result=await analyzePhoto(request,config,fetcher);
 assert.equal(result.outcome,'matched');assert.equal(result.matchMethod,'jev');assert.equal(result.temporal,'historical');assert.equal(result.event?.provider,'espn-olympics');
 assert.ok(result.points.some(p=>p.athlete?.name==='CHEN Yiwen'&&p.athlete.country==='CHN'));assert.ok(result.points.some(p=>p.evidence==='rule'));assert.ok(result.sources.some(s=>s.url.includes('site.api.espn.com')));
 assert.ok(calls.some(s=>s.includes('api.typesafe.ai')));assert.equal(result.moment,null);assert.ok(result.trace.some(s=>s.detail.includes('Supplementary')&&s.status==='unavailable'));
});
test('manual individual confirmation uses the selected real provider and remains labeled user',async()=>{
 const {fetcher,calls}=upstream({...feature,athletes:[],eventLabel:null});const result=await analyzePhoto({...request,selectedEvent:{league:'espn-olympics',eventId:event.id}},config,fetcher);
 assert.equal(result.outcome,'matched');assert.equal(result.matchMethod,'user');assert.equal(result.event?.id,event.id);assert.equal(result.moment,null);
 assert.ok(calls.some(url=>url.startsWith('https://api.worldaquatics.com/fina/competitions?')));
});
test('high JEV confidence cannot override a visibly conflicting event scope',async()=>{
 const {fetcher}=upstream({...feature,eventLabel:"Women's 10m Platform Final"});const result=await analyzePhoto(request,config,fetcher);assert.equal(result.outcome,'needs_confirmation');assert.equal(result.event,null);assert.equal(result.matchMethod,'none');
});
test('unique dive record reproduces seven-judge arithmetic without assigning physical deduction reasons',()=>{
 const moment=individualMoment(feature,summary,'en')!;assert.equal(moment.exact,true);assert.match(moment.detail,/25.5/);assert.match(moment.detail,/76.50/);assert.match(moment.detail,/do not establish/);
 assert.equal(individualMoment({...feature,scores:['76.60']},summary,'en'),null);assert.equal(individualMoment({...feature,difficulty:3.4},summary,'en'),null);assert.equal(individualMoment({...feature,athletes:[]},summary,'en'),null);
 assert.equal(individualMoment(feature,{...summary,rounds:[...summary.rounds,{...summary.rounds[0],round:4}]},'en')?.exact,true);
 assert.equal(individualMoment({...feature,round:null},{...summary,rounds:[...summary.rounds,{...summary.rounds[0],round:4}]},'en'),null);
});
test('independent sources merge only with two matching full-name and numeric-result records',()=>{
 assert.equal(sameRecordedEvent(event,{...event,id:'other'}),true);assert.equal(sameRecordedEvent(event,{...event,competitors:[athlete]}),false);assert.equal(sameRecordedEvent(event,{...event,competitors:event.competitors.map(p=>({...p,score:'1'}))}),false);
 assert.equal(sameRecordedEvent(event,{...event,name:"Women's 3m Springboard Semifinal"}),false);
 const swim={...event,sport:'swimming',name:"Men's 1500m Freestyle Final",competitors:event.competitors.map((p,i)=>({...p,score:i?'14:34.55':'14:30.67'}))};assert.equal(sameRecordedEvent(swim,swim),true);
});
test('coverage states all five connected scopes without promising universal live feeds',async()=>{
 const result=await(await coverage()).json() as {liveGuarantee:boolean;sports:Array<{sport:string;currentEventFeed:boolean}>};assert.equal(result.liveGuarantee,false);assert.deepEqual(result.sports.map((s:{sport:string})=>s.sport),[...TARGET_SPORTS]);assert.equal(result.sports.find((s:{sport:string})=>s.sport==='athletics')?.currentEventFeed,false);
});
test('available scores remain visible when the provider has not assigned rankings yet',()=>{
 const points=individualPoints({...feature,athletes:[]},{...summary,event:{...event,status:'live',dataMode:'lookup',competitors:[{id:'a',name:'Example Diver',score:'76.50'}]}},'en');const score=points.find(p=>p.kind==='score');assert.match(score?.detail??'',/Example Diver · 76.50/);assert.doesNotMatch(score?.detail??'',/did not supply/);
});
