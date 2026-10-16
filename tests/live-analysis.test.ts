import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePhoto } from '../lib/analysis/analyze';
import { discoverLiveEvents, isCurrentEvent } from '../lib/analysis/live-discovery';
import { validateAnalyzeRequest } from '../lib/analysis/request';
import type { AnalyzeRequest, PhotoFeatures, AnalysisEvent } from '../lib/analysis/types';
import { GET as liveEvents } from '../app/api/live-events/route';
const config={openrouterKey:'test-router',jevKey:'test-jev',visionModel:'vision-test',explanationModel:'facts-test',jevModel:'jev-latest'};
const features:PhotoFeatures={sport:'basketball',league:'nba',visibleText:[],teams:[],athletes:[],scores:[],clock:null,period:null,explicitDate:null,observations:[{label:'Basketball',detail:'A basketball game is visible.',x:.3,y:.4}],limitations:[]};
const imageDataUrl='data:image/jpeg;base64,'+Buffer.from('\xff\xd8\xff'+'x'.repeat(100),'latin1').toString('base64');
const request:AnalyzeRequest={imageDataUrl,capturedAt:'2024-06-18T00:30:00Z',timeZone:'UTC',locale:'en'};
function makeEvent(id='1',state='in',age=60_000){const date=new Date(Date.now()-age).toISOString();const status={type:{state,completed:state==='post',description:state==='in'?'In Progress':state==='post'?'Final':'Scheduled'},displayClock:'12:00',period:2};return{id,name:id==='1'?'Boston Celtics at Dallas Mavericks':'Chicago Bulls at Miami Heat',date,status,competitions:[{id,date,status,competitors:[{id:'a'+id,homeAway:'home',team:{id:'a'+id,displayName:id==='1'?'Dallas Mavericks':'Miami Heat',abbreviation:id==='1'?'DAL':'MIA'},score:'50'},{id:'b'+id,homeAway:'away',team:{id:'b'+id,displayName:id==='1'?'Boston Celtics':'Chicago Bulls',abbreviation:id==='1'?'BOS':'CHI'},score:'48'}]}]};}
function upstream(options:{events?:ReturnType<typeof makeEvent>[];features?:PhotoFeatures;outage?:boolean;summaryFinal?:boolean;decisionFails?:boolean}={}){
 const events=options.events??[makeEvent()],calls:Array<{url:string;body:any}>=[];
 const fetcher:typeof fetch=async(input,init)=>{const url=String(input),body=init?.body?JSON.parse(String(init.body)):undefined;calls.push({url,body});
 if(url.includes('openrouter.ai'))return Response.json({choices:[{message:{content:JSON.stringify(body.response_format.json_schema.name==='photo_features'?(options.features??features):{factIds:['game-context']})}}]});
 if(url.includes('api.typesafe.ai')){if(options.decisionFails)return new Response('',{status:503});const candidates=body.state.candidates;const chosen=candidates[0].id;return Response.json({model:'jev-1.13.0',answers:{event:{type:'choice',choice:'event_'+chosen,confidence:.99,probabilities:Object.fromEntries([['none',.01],...candidates.map((c:any)=>['event_'+c.id,c.id===chosen ? .99 : 0])])},evidence:{type:'noul',noul:.99}}});}
 if(url.includes('/scoreboard'))return options.outage?new Response('',{status:503}):Response.json({events});
 if(url.includes('/summary')){const id=new URL(url).searchParams.get('event');const selected=events.find(e=>e.id===id)!;const e=options.summaryFinal?makeEvent(selected.id,'post'):selected;return Response.json({header:{id:e.id,name:e.name,competitions:e.competitions},plays:[],boxscore:{players:[]}});}
 throw new Error('Unexpected URL');
 };return{fetcher,calls};
}
test('live is the default, searches server-now rather than capture date, and links one current event from sport context',async()=>{
 assert.equal(validateAnalyzeRequest(request).mode,'live');const {fetcher,calls}=upstream();const result=await analyzePhoto(request,config,fetcher);
 assert.equal(result.mode,'live');assert.equal(result.outcome,'matched');assert.equal(result.matchMethod,'current');assert.equal(result.temporal,'live');assert.equal(result.event?.id,'1');assert.equal(result.moment,null);assert.equal(result.discovery?.activeCount,1);
 const date=new Date().toISOString().slice(0,10).replaceAll('-','');assert.ok(calls.some(c=>c.url.includes('dates='+date)));assert.ok(!calls.some(c=>c.url.includes('dates=20240618')));
 assert.equal(calls.find(c=>c.url.includes('typesafe'))?.body.state.liveContext.activeCount,1);assert.ok(result.statistics?.some(s=>s.label==='Current score'));assert.match(result.limitations?.join(' ')??'',/does not independently prove/);
 for(const call of calls.filter(c=>!c.url.includes('openrouter')))assert.ok(!JSON.stringify(call.body??null).includes(imageDataUrl));
});
test('multiple live events with only the sport remain ambiguous without invoking a confident selector',async()=>{
 const {fetcher,calls}=upstream({events:[makeEvent('1'),makeEvent('2')]});const result=await analyzePhoto({...request,mode:'live'},config,fetcher);
 assert.equal(result.outcome,'needs_confirmation');assert.equal(result.discovery?.status,'ambiguous');assert.equal(result.discovery?.activeCount,2);assert.equal(result.event,null);assert.ok(!calls.some(c=>c.url.includes('typesafe')||c.url.includes('/summary')));
});
test('visible teams distinguish simultaneous current events before fetching details',async()=>{
 const {fetcher}=upstream({events:[makeEvent('1'),makeEvent('2')],features:{...features,teams:['Dallas Mavericks','Boston Celtics']}});const result=await analyzePhoto(request,config,fetcher);
 assert.equal(result.outcome,'matched');assert.equal(result.event?.id,'1');assert.equal(result.discovery?.activeCount,2);
});
test('scheduled, old, final, and unknown events never become current from a clock alone',async()=>{
 const old=makeEvent('1','in',3*86_400_000);const {fetcher,calls}=upstream({events:[old,makeEvent('2','pre'),makeEvent('3','post'),makeEvent('4','unknown')]});const result=await analyzePhoto(request,config,fetcher);
 assert.equal(result.outcome,'unmatched');assert.equal(result.discovery?.status,'empty');assert.equal(result.event,null);assert.ok(!calls.some(c=>c.url.includes('typesafe')||c.url.includes('/summary')));
});
test('a failed feed is unavailable rather than no current games',async()=>{
 const {fetcher}=upstream({outage:true});const result=await analyzePhoto(request,config,fetcher);assert.equal(result.discovery?.status,'unavailable');assert.match(result.message,/could not finish/);
});
test('explicit old dates and contradictory teams cannot be resolved by model confidence',async()=>{
 for(const changed of [{...features,explicitDate:'2024-06-18',visibleText:['2024-06-18']},{...features,teams:['Los Angeles Lakers']}]){const {fetcher,calls}=upstream({features:changed});const result=await analyzePhoto(request,config,fetcher);assert.equal(result.outcome,'needs_confirmation');assert.equal(result.event,null);assert.ok(!calls.some(c=>c.url.includes('typesafe')));}
});
test('manual current confirmation is re-discovered and cannot fetch a foreign archived ID',async()=>{
 const {fetcher,calls}=upstream();const result=await analyzePhoto({...request,selectedEvent:{league:'nba',eventId:'401656363'}},config,fetcher);assert.equal(result.event,null);assert.ok(!calls.some(c=>c.url.includes('/summary')));
 const ok=upstream();const confirmed=await analyzePhoto({...request,selectedEvent:{league:'nba',eventId:'1'}},config,ok.fetcher);assert.equal(confirmed.matchMethod,'user');assert.equal(confirmed.outcome,'matched');
});
test('manual selection cannot bypass conflicting printed dates or teams',async()=>{
 const {fetcher,calls}=upstream({features:{...features,teams:['Los Angeles Lakers'],visibleText:['2024-06-18'],explicitDate:'2024-06-18'}});const result=await analyzePhoto({...request,selectedEvent:{league:'nba',eventId:'1'}},config,fetcher);assert.equal(result.event,null);assert.equal(result.candidates.length,0);assert.ok(!calls.some(c=>c.url.includes('/summary')));
});
test('a live-to-final change while loading details never keeps the live label',async()=>{
 const {fetcher}=upstream({summaryFinal:true});const result=await analyzePhoto(request,config,fetcher);assert.equal(result.outcome,'needs_confirmation');assert.equal(result.temporal,'unknown');assert.equal(result.event,null);assert.equal(result.discovery?.status,'unavailable');
});
test('decision outage retains candidates and never silently upgrades to an automatic match',async()=>{
 const {fetcher}=upstream({decisionFails:true});const result=await analyzePhoto(request,config,fetcher);assert.equal(result.outcome,'needs_confirmation');assert.equal(result.event,null);
});
test('discovery route accepts only a supported sport, never a caller-supplied historical clock or URL',async()=>{
 for(const suffix of ['sport=diving&asOf=2024-08-09','sport=https://bad.test','sport=unknown','sport=cricket&url=https://bad.test'])assert.equal((await liveEvents(new Request('https://example.test/api/live-events?'+suffix))).status,400);
 const e:AnalysisEvent={id:'1',league:'nba',sport:'basketball',name:'x',date:new Date().toISOString(),status:'live',teams:[]};assert.equal(isCurrentEvent({...e,dataMode:'historical'},new Date().toISOString()),false);
 const {fetcher}=upstream();assert.equal((await discoverLiveEvents({sport:'not-a-sport'},fetcher)).status,'unsupported');
 assert.throws(()=>validateAnalyzeRequest({...request,mode:'whatever'}));
});

// Synthetic LIVE transition on the real World Aquatics schema; never presented as an actual live event.
test('a diving photo with no printed name discovers the sole current official phase and retrieves full score breakdowns',async()=>{
 const id='ef62ff76-092c-4d34-882d-e247cd6a0310',now=new Date(),start=new Date(now.getTime()-5*60_000).toISOString();
 const original=upstream({features:{...features,sport:'diving',league:null}});const calls:string[]=[];
 const fetcher:typeof fetch=async(input,init)=>{const url=String(input);calls.push(url);
 if(url.includes('/olympics/'))return Response.json({season:{year:String(Math.floor(now.getUTCFullYear()/4)*4),type:'summer'},competitions:[]});
 if(url.includes('/fina/results/live'))return Response.json({pageInfo:{numPages:1},content:[{officialName:'World Aquatics Cup',schedule:[{disciplineId:id,sportCode:'DV',utcDateTime:start,resultStatus:'LIVE',disciplineName:"Women's 3m Springboard",phaseName:'Final'}]}]});
 if(url.includes('/fina/events/'))return Response.json({Id:id,EventName:'World Aquatics Cup',DisciplineName:"Women's 3m Springboard",SportCode:'DV',Heats:[{Name:'Final',SportCode:'DV',UtcDateTime:start,ResultStatus:'LIVE',Results:[{PersonId:'athlete1',FullName:'Example Diver',NAT:'CHN',Rank:1,TotalPoints:'76.50',Dives:[{DiveOrder:1,DivePoints:'76.50',TotalPoints:'76.50',DD:3,JudgesScores:[8.5,8.5,8.5,8.5,8.5,8.5,8.5].map(Score=>({Score}))}]}]}]});
 if(url.includes('api.typesafe.ai')){const body=JSON.parse(String(init?.body)),chosen=body.state.candidates[0].id;return Response.json({model:'jev-1.13.0',answers:{event:{type:'choice',choice:'event_'+chosen,confidence:.99,probabilities:{none:.01,['event_'+chosen]:.99}},evidence:{type:'noul',noul:.99}}});}
 return original.fetcher(input,init);
 };
 const result=await analyzePhoto(request,config,fetcher);assert.equal(result.outcome,'matched');assert.equal(result.matchMethod,'current');assert.equal(result.temporal,'live');assert.equal(result.event?.provider,'worldaquatics');assert.equal(result.discovery?.activeCount,1);assert.equal(result.moment,null);
 assert.ok(result.points.some(p=>p.title==='Current standings'));assert.ok(result.points.some(p=>p.evidence==='rule'));
 assert.ok(result.statistics?.some(s=>s.subject==='Example Diver'&&s.value.includes('DD 3')&&s.value.includes('Judges')));assert.ok(calls.some(s=>s.includes('/results/live')));assert.ok(!calls.some(s=>s.includes('apis.codante.io')||s.includes('dates=20240809')));
});
