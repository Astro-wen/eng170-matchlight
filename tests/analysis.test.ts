import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePhoto } from '../lib/analysis/analyze';
import { validateAnalyzeRequest } from '../lib/analysis/request';
import { locateMoment } from '../lib/analysis/insights';
import { eventTimeConsistent, searchDates, visibleTeamCount } from '../lib/analysis/matching';
import { analysisConfig } from '../lib/analysis/config';
import { resetEspnCache } from '../lib/analysis/espn';
import type { PhotoFeatures, AnalyzeRequest } from '../lib/analysis/types';
const features: PhotoFeatures = {sport:'basketball',league:'nba',visibleText:['BOS','DAL','2','0','Q1','11:40'],teams:['Boston Celtics','Dallas Mavericks'],athletes:[],scores:['2','0'],clock:'11:40',period:'Q1',explicitDate:null,observations:[{label:'Visible score',detail:'BOS 2, DAL 0',x:.7,y:.2}],limitations:[]};
const imageDataUrl='data:image/jpeg;base64,'+Buffer.from('\xff\xd8\xff'+ 'x'.repeat(100),'latin1').toString('base64');
const request: AnalyzeRequest = {mode:"replay",imageDataUrl,capturedAt:'2024-06-18T01:00:00.000Z',timeZone:'America/Los_Angeles',locale:'en'};
const config={openrouterKey:'server-only-router-key',jevKey:'server-only-jev-key',visionModel:'test-vision',explanationModel:'test-explain',jevModel:'jev-latest'};
const competition={id:'401656363',date:'2024-06-18T00:30Z',status:{type:{completed:true,state:'post',description:'Final'},displayClock:'0.0',period:4},competitors:[{homeAway:'home',team:{id:'2',displayName:'Boston Celtics',abbreviation:'BOS'},score:'106'},{homeAway:'away',team:{id:'6',displayName:'Dallas Mavericks',abbreviation:'DAL'},score:'88'}]};
const event={id:'401656363',name:'Dallas Mavericks at Boston Celtics',date:'2024-06-18T00:30Z',competitions:[competition],status:competition.status};
function mockProvider(options:{features?:PhotoFeatures;choice?:string;scoreboardFails?:boolean;proseFails?:boolean}={}) {
 const calls:Array<{url:string;body?:Record<string,unknown>}>=[];
 const fetcher=(async (input: string|URL|Request,init?:RequestInit)=>{
  const url=String(input); const body=init?.body?JSON.parse(String(init.body)):undefined;calls.push({url,body});
  if(url.includes('openrouter.ai')) {
   if(body.response_format.json_schema.name==='photo_features')return Response.json({choices:[{message:{content:JSON.stringify(options.features||features)}}]});
   if(options.proseFails)return new Response('',{status:503});
   return Response.json({choices:[{message:{content:JSON.stringify({factIds:['game-context']})}}]});
  }
  if(url.includes('api.typesafe.ai')) return Response.json({model:'jev-1.13.0',answers:{event:{type:'choice',choice:options.choice||'event_401656363',confidence:.99,probabilities:{none:.01,'event_401656363':.99}},evidence:{type:'noul',noul:.99}}});
  if(url.includes('/scoreboard'))return options.scoreboardFails?new Response('',{status:503}):Response.json({events:[event]});
  if(url.includes('/summary'))return Response.json({header:{id:'401656363',name:event.name,competitions:[competition]},plays:[{id:'p1',text:'Jrue Holiday makes driving layup (Jayson Tatum assists)',clock:{displayValue:'11:40'},period:{number:1},homeScore:2,awayScore:0}]});
  throw new Error('Unexpected URL');
 }) as typeof fetch;
 return {fetcher,calls};
}
test('real agent chain uses visual clues, ESPN, JEV and a verified play without sending image to ESPN/JEV',async()=>{
 resetEspnCache();const {fetcher,calls}=mockProvider();const result=await analyzePhoto(request,config,fetcher);
 assert.equal(result.outcome,'matched');assert.equal(result.matchMethod,'jev');assert.equal(result.event?.id,'401656363');assert.equal(result.temporal,'historical');assert.equal(result.moment?.exact,true);
 assert.match(result.moment?.detail||'',/Holiday/);assert.equal(result.points.length,3);assert.ok(result.points.some(p=>p.evidence==='provider'&&p.sourceIds.length>0));
 assert.ok(calls.some(c=>c.url.includes('api.typesafe.ai')));assert.ok(calls.some(c=>c.url.includes('/summary')));
 for(const call of calls.filter(c=>!c.url.includes('openrouter.ai')))assert.ok(!JSON.stringify(call).includes(imageDataUrl));
 const serialized=JSON.stringify(result);assert.ok(!serialized.includes(config.openrouterKey));assert.ok(!serialized.includes(config.jevKey));assert.ok(!serialized.includes(imageDataUrl));
});
test('missing visible identity never auto-matches even when JEV claims high confidence',async()=>{
 const {fetcher}=mockProvider({features:{...features,teams:[],visibleText:[]}});const result=await analyzePhoto(request,config,fetcher);
 assert.equal(result.outcome,'needs_confirmation');assert.equal(result.event,null);assert.ok(result.candidates.length>0);assert.equal(result.points[0].evidence,'photo');
});
test('unsupported sport preserves observations and makes no ESPN/JEV calls',async()=>{
 const {fetcher,calls}=mockProvider({features:{...features,sport:'archery',league:null,teams:[]}});const result=await analyzePhoto(request,config,fetcher);
 assert.equal(result.outcome,'unmatched');assert.equal(result.event,null);assert.equal(calls.length,1);assert.match(result.message,/does not have a connected/);
});
test('provider outage is explicit, not confused with a successful empty lookup',async()=>{
 const {fetcher}=mockProvider({scoreboardFails:true});const result=await analyzePhoto(request,config,fetcher);
 assert.equal(result.outcome,'unmatched');assert.match(result.message,/did not respond/);assert.ok(result.trace.some(t=>t.status==='unavailable'));
});
test('user confirmation fetches and labels the chosen event and prose failure preserves provider facts',async()=>{
 const {fetcher}=mockProvider({features:{...features,teams:[],clock:null,period:null},proseFails:true});const result=await analyzePhoto({...request,selectedEvent:{league:'nba',eventId:'401656363'}},config,fetcher);
 assert.equal(result.matchMethod,'user');assert.equal(result.outcome,'matched');assert.equal(result.moment,null);assert.equal(result.models.explanation,null);assert.match(result.points.at(-1)?.detail||'',/not confirmed/);
});
test('moment association requires period, clock and BOTH scores, not capture time alone',()=>{
 const summary={event:{id:'1',league:'nba',sport:'basketball',name:'game',date:'2024-06-18T00:30Z',status:'final' as const,teams:[]},fetchedAt:'now',sources:[],plays:[{id:'p',text:'play',clock:'11:40',period:1,homeScore:2,awayScore:0}]};
 assert.equal(locateMoment({...features,scores:['3','0']},summary,'en'),null);assert.equal(locateMoment({...features,period:null},summary,'en'),null);assert.equal(locateMoment(features,summary,'en')?.exact,true);
});
test('search dates use local capture date with neighboring schedule days; no famous-event preset',()=>{
 assert.deepEqual(searchDates(request,features),['2024-06-17','2024-06-16','2024-06-18']);assert.deepEqual(searchDates(request,{...features,explicitDate:'2024-06-10'}),['2024-06-10','2024-06-09','2024-06-11']);
});
test('request validates actual image signatures, bytes, timestamps, locale, timezone and IDs',()=>{
 assert.equal(validateAnalyzeRequest(request).capturedAt,request.capturedAt);
 for(const v of [{...request,imageDataUrl:'data:image/jpeg;base64,'+Buffer.from('not a jpeg'.repeat(20)).toString('base64')},{...request,imageDataUrl:'https://attacker.invalid/photo'},{...request,timeZone:'not/a-zone'},{...request,capturedAt:'yesterday'},{...request,selectedEvent:{league:'nba',eventId:'../secrets'}},{...request,locale:'xx'}])assert.throws(()=>validateAnalyzeRequest(v));
});
test('keyless runtime is explicit and server configuration never substitutes front-end variables',()=>{
 assert.equal(analysisConfig({NEXT_PUBLIC_OPENROUTER_API_KEY:'unsafe'}),null);assert.equal(analysisConfig({OPENROUTER_API_KEY:'secret'})?.visionModel,'google/gemini-3-flash-preview');
});

test('one shared city or duplicate label cannot identify two independent teams',()=>{
 const e={...event,id:'1',league:'nba',sport:'basketball',status:'final' as const,teams:[{id:'l',name:'Los Angeles Lakers',abbreviation:'LAL',homeAway:'home' as const},{id:'c',name:'Los Angeles Clippers',abbreviation:'LAC',homeAway:'away' as const}]};
 assert.equal(visibleTeamCount({...features,teams:['Los Angeles']},e),0);
 assert.equal(visibleTeamCount({...features,teams:['LAL','Los Angeles Lakers']},e),1);
 assert.equal(visibleTeamCount({...features,teams:['LAL','LAC']},e),2);
});
test('multiple actions at the same clock and score retain explicit ambiguity',()=>{
 const summary={event:{id:'1',league:'nba',sport:'basketball',name:'game',date:'2024-06-18T00:30Z',status:'final' as const,teams:[]},fetchedAt:'now',sources:[],plays:[{id:'p1',text:'Player enters',clock:'11:40',period:1,homeScore:2,awayScore:0},{id:'p2',text:'Other player enters',clock:'11:40',period:1,homeScore:2,awayScore:0}]};
 const moment=locateMoment(features,summary,'en');assert.equal(moment?.exact,false);assert.match(moment?.detail||'',/Several actions/);
 assert.equal(locateMoment({...features,clock:'0:00.4'}, {...summary,plays:[{...summary.plays[0],clock:'0:00.9'}]},'en'),null);
});

test('analysis endpoint rejects cross-site requests and holds concurrent slots before awaits',async()=>{
 const old=process.env.OPENROUTER_API_KEY;process.env.OPENROUTER_API_KEY='test-not-a-real-key';
 try{
  const {POST}=await import('../app/api/analyze/route');
  assert.equal((await POST(new Request('https://matchlight.test/api/analyze',{method:'POST',headers:{origin:'https://other.test','content-type':'application/json'},body:'{}'}))).status,403);
  const controllers:ReadableStreamDefaultController<Uint8Array>[]=[];
  const pending=Array.from({length:4},()=>{
   const stream=new ReadableStream<Uint8Array>({start(controller){controllers.push(controller);}});
   return POST(new Request('https://matchlight.test/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:stream,duplex:'half'} as RequestInit));
  });
  assert.equal((await POST(new Request('https://matchlight.test/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}))).status,429);
  controllers.forEach(c=>{c.enqueue(new TextEncoder().encode('{}'));c.close();});
  for(const response of await Promise.all(pending))assert.equal(response.status,400);
 }finally{if(old===undefined)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=old;}
});

test('a printed final requires matching provider final scores',async()=>{
 const {fetcher}=mockProvider({features:{...features,period:'Final',scores:['107','88']}});
 const result=await analyzePhoto(request,config,fetcher);assert.equal(result.outcome,'needs_confirmation');assert.equal(result.event,null);
});

test('automatic matching never treats a future scheduled matchup as the pictured action',()=>{
 const e={id:'1',league:'nba',sport:'basketball',name:'game',date:'2024-06-19T00:30Z',status:'scheduled' as const,teams:[]};
 assert.equal(eventTimeConsistent(request,features,e),false);
 assert.equal(eventTimeConsistent(request,features,{...e,status:'live'}),false);
});
