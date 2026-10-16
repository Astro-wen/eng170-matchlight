import assert from 'node:assert/strict';
import { finalScoreConsistent } from '../lib/analysis/matching';
import test from 'node:test';
import { analyzePhoto } from '../lib/analysis/analyze';
import { resetEspnCache } from '../lib/analysis/espn';
import { resetEspnCricketCache } from '../lib/analysis/espn-cricket';
import type { AnalyzeRequest, PhotoFeatures } from '../lib/analysis/types';

const config = { openrouterKey: 'test-server-router', jevKey: 'test-server-decision', visionModel: 'test-vision', explanationModel: 'test-insights', jevModel: 'jev-latest' };
const imageDataUrl = 'data:image/jpeg;base64,' + Buffer.from('\xff\xd8\xff' + 'fixture'.repeat(20), 'latin1').toString('base64');
function features(overrides: Partial<PhotoFeatures> = {}): PhotoFeatures {
  return {
    sport: 'cricket', league: null, teams: ['Markhor IT Solutions', 'State Bank of Pakistan'], athletes: [],
    visibleText: ['MITS', 'SBP', '376 & 98/3', '344', '29 overs'], scores: ['376 & 98/3 (29 ov)', '344'],
    clock: '28.6 ov', period: 'Innings 3', explicitDate: null,
    observations: [{ label: 'Visible cricket score', detail: 'MITS 376 & 98/3 (29 ov), SBP 344', x: .72, y: .23 }],
    limitations: ['A single photograph does not identify the delivery.'], countries: [], eventLabel: null, round: null, difficulty: null,
    ...overrides,
  };
}
type Call = { url: string; body?: Record<string, any> };
function setup(options: { historical?: boolean; noBalls?: boolean; teamIdentifiers?: string[] } = {}) {
  resetEspnCache(); resetEspnCricketCache();
  const capturedAt = options.historical ? '2024-05-26T17:30:00.000Z' : new Date().toISOString();
  const start = new Date(Date.parse(capturedAt) - 3 * 86_400_000).toISOString();
  const end = new Date(Date.parse(capturedAt) + 86_400_000).toISOString();
  const request: AnalyzeRequest = { mode:"replay",imageDataUrl, capturedAt, timeZone: 'UTC', locale: 'en' };
  const historicFeatures = features({
    teams: ['Kolkata Knight Riders', 'Sunrisers Hyderabad'], visibleText: ['KKR', 'SRH', '114/2', '113', '10.3 ov'],
    scores: ['114/2 (10.3 ov)', '113 (18.3 ov)'], clock: '10.3 ov', period: 'Innings 2',
    observations: [{ label: 'Visible score', detail: 'KKR 114/2 (10.3 ov), SRH 113 (18.3 ov)', x: .7, y: .2 }],
  });
  const photoFeatures = options.historical ? historicFeatures : features(options.teamIdentifiers ? { teams: options.teamIdentifiers } : {});
  const teams = [
    { id: '1553774', displayName: 'Markhor IT Solutions', abbreviation: 'MITS', score: '376 & 98/3 (29 ov)', homeAway: 'home' },
    { id: '3110', displayName: 'State Bank of Pakistan', abbreviation: 'SBP', score: '344', homeAway: 'away' },
  ];
  const flat = {
    id: '1553799', name: 'Markhor IT Solutions v State Bank of Pakistan', date: start, endDate: end,
    status: 'in', fullStatus: { type: { state: 'in', description: 'Live' }, summary: 'Day four in progress', period: 3 }, competitors: teams,
  };
  const commentaries = options.noBalls ? {
    ad: { id: 'advert', shortText: '', text: '', preText: '<a>Play our daily games</a>' },
  } : {
    first: { id: 'c1', period: 3, shortText: 'Bowler to Batter, no run', over: { actual: '28.5' }, bbbTimestamp: Date.parse(capturedAt) - 120_000 },
    second: { id: 'c2', period: 3, shortText: 'Bowler to Batter, 1 run', over: { actual: '28.6' }, bbbTimestamp: Date.parse(capturedAt) - 60_000 },
  };
  const dynamicSummary = {
    header: {
      id: flat.id, name: flat.name, league: { id: '8836' }, leagues: [{ id: '8836' }],
      competitions: [{
        id: flat.id, date: start, status: flat.fullStatus,
        competitors: teams.map((team) => ({
          id: team.id, homeAway: team.homeAway, score: team.score,
          team: { id: team.id, displayName: team.displayName, abbreviation: team.abbreviation },
          linescores: [{ period: 3, isCurrent: 1, isBatting: team.id === '1553774', runs: team.id === '1553774' ? 98 : 0, wickets: team.id === '1553774' ? 3 : 0, overs: '29.0', target: 0 }],
        })), commentaries,
      }],
    },
  };
  const historicCompetition = {
    id: '1426312', date: '2024-05-26T14:00Z', status: { type: { state: 'post', completed: true, description: 'Final' } },
    competitors: [
      { id: '4341', homeAway: 'home', team: { id: '4341', displayName: 'Kolkata Knight Riders', abbreviation: 'KKR' }, score: '114/2 (10.3 ov)' },
      { id: '5143', homeAway: 'away', team: { id: '5143', displayName: 'Sunrisers Hyderabad', abbreviation: 'SRH' }, score: '113 (18.3 ov)' },
    ],
  };
  const historicEvent = { id: '1426312', name: 'Kolkata Knight Riders v Sunrisers Hyderabad', date: historicCompetition.date, status: historicCompetition.status, competitions: [historicCompetition] };
  const calls: Call[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input), body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    if (url === 'https://openrouter.ai/api/v1/chat/completions') {
      const schemaName = body.response_format.json_schema.name;
      const content = schemaName === 'photo_features' ? photoFeatures : { factIds: ['game-context'] };
      return Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });
    }
    if (url === 'https://api.typesafe.ai/v1/systemone') {
      const candidates = body.state.candidates as Array<{ id: string }>;
      assert.equal(candidates.length, 1);
      const choice = `event_${candidates[0].id}`;
      return Response.json({ model: 'jev-1.13.0', answers: { event: { type: 'choice', choice, confidence: .99, probabilities: { none: .01, [choice]: .99 } }, evidence: { type: 'noul', noul: .99 } } });
    }
    if (url.includes('/apis/personalized/v2/scoreboard/header')) {
      assert.equal(options.historical, undefined, 'Historical analysis must not request the current cricket snapshot.');
      return Response.json({ sports: [{ slug: 'cricket', id: '200', leagues: [{ id: '8836', name: "President's Trophy", events: [flat] }] }] });
    }
    if (url.includes('/sports/cricket/8048/scoreboard')) return Response.json({ events: options.historical ? [historicEvent] : [] });
    if (url.includes('/sports/cricket/8048/summary')) return Response.json({ header: { id: historicEvent.id, name: historicEvent.name, competitions: [historicCompetition] }, plays: [] });
    if (url.includes('/sports/cricket/8836/summary')) return Response.json(dynamicSummary);
    throw new Error(`Unexpected mock upstream: ${url}`);
  };
  return { request, fetcher, calls, photoFeatures };
}

test('photo analysis routes aggregate cricket through JEV and its dynamic ESPN summary', async () => {
  const { request, fetcher, calls } = setup();
  const result = await analyzePhoto(request, config, fetcher);
  assert.equal(result.outcome, 'matched');
  assert.equal(result.matchMethod, 'jev');
  assert.equal(result.event?.league, 'cricket-8836');
  assert.equal(result.event?.id, '1553799');
  assert.equal(result.models.decision, 'jev-1.13.0');
  const headerIndex = calls.findIndex((call) => call.url.includes('/apis/personalized/v2/scoreboard/header'));
  const decisionIndex = calls.findIndex((call) => call.url === 'https://api.typesafe.ai/v1/systemone');
  const summaryIndex = calls.findIndex((call) => call.url.includes('/sports/cricket/8836/summary?event=1553799'));
  assert.ok(headerIndex >= 0 && decisionIndex > headerIndex && summaryIndex > decisionIndex);
  assert.equal(calls.filter((call) => call.url.includes('/apis/personalized/v2/scoreboard/header')).length, 1);
  assert.equal(calls[decisionIndex].body?.state.candidates[0].teams[0].score, '376 & 98/3 (29 ov)');
  for (const call of calls.filter((call) => !call.url.includes('openrouter.ai'))) assert.ok(!JSON.stringify(call.body ?? null).includes(imageDataUrl));
  assert.ok(!JSON.stringify(result).includes(config.openrouterKey));
  assert.ok(!JSON.stringify(result).includes(config.jevKey));
});

test('an ongoing multi-day cricket match is live for a current capture while score notation survives', async () => {
  const { request, fetcher } = setup();
  const result = await analyzePhoto(request, config, fetcher);
  assert.ok(Date.parse(request.capturedAt) - Date.parse(result.event!.date) > 48 * 60 * 60 * 1000);
  assert.equal(result.temporal, 'live');
  assert.equal(result.event?.status, 'live');
  assert.equal(result.event?.teams[0].score, '376 & 98/3 (29 ov)');
  const score = result.points.find((point) => point.id === 'game-score');
  assert.match(score?.summary ?? '', /MITS 376 & 98\/3 \(29 ov\)/);
  assert.match(score?.detail ?? '', /lookup time/);
  assert.ok(result.sources.some((source) => source.url.includes('/sports/cricket/8836/summary')));
});

test('available ball records stay separate from the delivery shown and include a sourced cricket rule', async () => {
  const { request, fetcher } = setup();
  const result = await analyzePhoto(request, config, fetcher);
  const ball = result.points.find((point) => point.id === 'game-context');
  assert.equal(ball?.title, 'Available ball record');
  assert.match(ball?.detail ?? '', /28\.6 ov · Bowler to Batter, 1 run/);
  assert.match(ball?.detail ?? '', /not confirmed as the delivery shown in the photo/);
  assert.equal(ball?.evidence, 'provider');
  assert.ok(ball?.sourceIds.length);
  assert.equal(result.moment, null);
  assert.doesNotMatch(result.message, /Game and visible play matched/);
  const rule = result.points.find((point) => point.kind === 'rule');
  assert.equal(rule?.title, 'Runs, wickets and overs');
  assert.match(rule?.detail ?? '', /not a decimal/);
  assert.ok(result.sources.some((source) => rule?.sourceIds.includes(source.id) && source.url === 'https://www.lords.org/mcc/about-the-laws-of-cricket'));
});

test('missing actual ball commentary does not manufacture a delivery from promotional text', async () => {
  const { request, fetcher } = setup({ noBalls: true });
  const result = await analyzePhoto(request, config, fetcher);
  assert.equal(result.outcome, 'matched');
  const context = result.points.find((point) => point.id === 'game-context');
  assert.equal(context?.title, 'Game context');
  assert.match(context?.detail ?? '', /exact action in this photo is not confirmed/);
  assert.doesNotMatch(JSON.stringify(result), /daily games/);
});

test('historical cricket lookup uses the IPL archive and never reads the current aggregate header', async () => {
  const { request, fetcher, calls } = setup({ historical: true });
  const result = await analyzePhoto(request, config, fetcher);
  assert.ok(calls.some((call) => call.url.includes('/sports/cricket/8048/scoreboard?dates=20240526')));
  assert.ok(!calls.some((call) => call.url.includes('/apis/personalized/v2/scoreboard/header')));
  assert.equal(result.outcome, 'matched');
  assert.equal(result.event?.league, 'ipl');
  assert.equal(result.event?.teams[0].score, '114/2 (10.3 ov)');
  assert.equal(result.temporal, 'historical');
  assert.ok(result.points.some((point) => point.kind === 'rule'));
});

test('high-confidence JEV cannot auto-identify cricket when only one team is visible', async () => {
  const { request, fetcher, calls } = setup({ teamIdentifiers: ['Markhor IT Solutions'] });
  const result = await analyzePhoto(request, config, fetcher);
  assert.equal(result.outcome, 'needs_confirmation');
  assert.equal(result.event, null);
  assert.ok(!calls.some((call) => call.url.includes('/sports/cricket/8836/summary')));
});
test('a printed cricket final checks complete compound score strings without decimal coercion',async()=>{
  const {request,fetcher,photoFeatures}=setup({historical:true});const result=await analyzePhoto(request,config,fetcher);assert.ok(result.event);
  assert.equal(finalScoreConsistent({...photoFeatures,period:'Final'},result.event!),true);
  assert.equal(finalScoreConsistent({...photoFeatures,period:'Final',scores:['114/3 (10.3 ov)','113 (18.3 ov)']},result.event!),false);
});
