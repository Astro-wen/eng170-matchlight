import assert from 'node:assert/strict';
import test from 'node:test';
import { EspnProviderError } from '../lib/analysis/espn';
import { fetchCricketScoreboard, fetchCricketSummary, resetEspnCricketCache } from '../lib/analysis/espn-cricket';

const today = new Date().toISOString().slice(0, 10);
function response(value: unknown, init?: ResponseInit) { return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' }, ...init }); }
function mock(value: unknown): typeof fetch { return async () => response(value); }
async function code(promise: Promise<unknown>, expected: string) { await assert.rejects(promise, (error) => error instanceof EspnProviderError && error.code === expected); }
function flatEvent() {
  return {
    id: '1554418', name: 'Oman v Canada', date: `${today}T05:30Z`, endDate: `${today}T23:59Z`,
    status: 'in', summary: 'Live', fullStatus: { type: { state: 'in', description: 'Innings break' }, summary: 'Canada won toss & batted', period: 1 },
    competitors: [
      { id: '37', displayName: 'Oman', abbreviation: 'OMA', score: '', homeAway: 'home', logo: 'https://a.espncdn.com/i/teamlogos/cricket/500/37.png' },
      { id: '17', displayName: 'Canada', abbreviation: 'CAN', score: '256 (50 ov)', homeAway: 'away' },
    ], links: [{ href: 'https://www.espn.in/cricket/series/19439/game/1554418', text: 'Summary' }, { href: 'https://bad.test/leak' }],
  };
}
function header(events: unknown[] = [flatEvent()]) { return { sports: [{ id: '200', slug: 'cricket', leagues: [{ id: '19439', name: "ICC Men's Cricket World Cup League 2", events }] }] }; }
function summary() {
  const flat = flatEvent();
  return {
    header: {
      id: flat.id, name: flat.name, league: { id: '19439' }, leagues: [{ id: '19439' }], links: flat.links,
      competitions: [{
        id: flat.id, date: flat.date, status: flat.fullStatus,
        competitors: flat.competitors.map((team) => ({
          id: team.id, homeAway: team.homeAway, score: team.score, team: { id: team.id, displayName: team.displayName, abbreviation: team.abbreviation },
          linescores: team.id === '17' ? [{ period: 1, isCurrent: 1, isBatting: true, runs: 256, wickets: 10, overs: '50.0', target: 0 }] : [{ period: 1, isCurrent: 1, isBatting: false, runs: 0, wickets: 0, overs: '50.0', target: 0 }],
        })),
        commentaries: {
          a: { id: '149060', shortText: 'Mujibur Ali to Zahid Shirzad, OUT', text: '', period: 1, over: { actual: '49.6' }, homeScore: '256/10', awayScore: '0', bbbTimestamp: 1792054820000 },
          b: { id: '149050', shortText: '', text: 'A full delivery outside off stump', period: 1, over: { actual: '49.5' }, homeScore: '256/9', awayScore: '0' },
          ad: { id: '999', shortText: '', text: '', preText: '<a href="/game">Play our games</a>', over: { actual: 0 }, bbbTimestamp: 0 },
        },
      }],
    },
    gameInfo: { venue: { fullName: 'Al Amerat Cricket Ground' } },
    leaders: [{ team: { id: '17' }, linescores: [{ period: 1, leaders: [{ displayName: 'Runs', leaders: [{ displayValue: '77', athlete: { displayName: 'Navneet Dhaliwal' } }] }] }] }],
    news: { articles: [{ headline: 'Match report' }] },
  };
}

test('current aggregate cricket discovers dynamic competitions and preserves real score strings', async () => {
  let requested = '';
  const fetcher: typeof fetch = async (url, init) => {
    requested = String(url); assert.equal(init?.redirect, 'manual'); assert.ok(init?.signal instanceof AbortSignal);
    return response(header());
  };
  const board = await fetchCricketScoreboard({ date: today }, fetcher);
  assert.equal(requested, 'https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=in&lang=en');
  assert.equal(board.league, 'cricket');
  assert.equal(board.events[0].league, 'cricket-19439');
  assert.equal(board.events[0].sport, 'cricket');
  assert.equal(board.events[0].id, '1554418');
  assert.equal(board.events[0].teams[1].name, 'Canada');
  assert.equal(board.events[0].teams[1].score, '256 (50 ov)');
  assert.equal(board.events[0].status, 'live');
  assert.equal(board.events[0].clock, undefined);
  assert.equal(board.events[0].links?.length, 1);
  assert.equal(board.sources[0].fetchedAt, board.fetchedAt);
  assert.equal(board.sources[0].url, requested);
});

test('multi-innings strings are preserved and date filtering includes ongoing multi-day matches', async () => {
  const start = new Date(`${today}T05:00Z`); start.setUTCDate(start.getUTCDate() - 3);
  const event = flatEvent(); event.date = start.toISOString(); event.competitors[0].score = '376 & 98/3 (29 ov)';
  const board = await fetchCricketScoreboard({ date: today }, mock(header([event])));
  assert.equal(board.events.length, 1);
  assert.equal(board.events[0].teams[0].score, '376 & 98/3 (29 ov)');
});

test('the aggregate header does not pretend to search historical captures', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; throw new Error('must not fetch'); };
  const result = await fetchCricketScoreboard({ date: '2024-05-26' }, fetcher);
  assert.deepEqual(result.events, []); assert.deepEqual(result.sources, []); assert.equal(calls, 0);
  for (const date of ['2024-02-30', '2026-13-01', '2026-10-15&url=https://bad.test']) await code(fetchCricketScoreboard({ date }, fetcher), 'INVALID_INPUT');
});

test('upstream pre-start, final and cancelled statuses are kept distinct from live', async () => {
  for (const [rawStatus, expected, noScore] of [
    [{ type: { state: 'in', description: 'Live' }, summary: 'Starts at 19:00 local time' }, 'scheduled', true],
    [{ type: { state: 'pre' } }, 'scheduled', false],
    [{ type: { state: 'post', completed: true } }, 'final', false],
    [{ type: { state: 'in', description: 'Match abandoned' } }, 'unknown', false],
  ] as const) {
    const event = { ...flatEvent(), fullStatus: rawStatus };
    if (noScore) for (const competitor of event.competitors) competitor.score = '';
    assert.equal((await fetchCricketScoreboard({}, mock(header([event])))).events[0].status, expected);
  }
});

test('cricket summary verifies league/event identity and preserves ball, innings and score semantics', async () => {
  let requested = '';
  const fetcher: typeof fetch = async (url) => { requested = String(url); return response(summary()); };
  const result = await fetchCricketSummary({ league: 'cricket-19439', eventId: '1554418' }, fetcher);
  assert.equal(requested, 'https://site.api.espn.com/apis/site/v2/sports/cricket/19439/summary?event=1554418&lang=en&region=in');
  assert.equal(result.event.teams[1].score, '256 (50 ov)');
  assert.equal(result.event.clock, '50.0 ov');
  assert.equal(result.event.venue, 'Al Amerat Cricket Ground');
  assert.equal(result.plays.length, 2);
  assert.equal(result.plays[1].text, '49.6 ov · Mujibur Ali to Zahid Shirzad, OUT');
  assert.equal(result.plays[0].period, 1);
  assert.equal(result.plays[0].homeScore, undefined);
  assert.equal(result.plays[0].awayScore, undefined);
  assert.equal(result.plays[1].wallclock, '2026-10-15T09:00:20.000Z');
  assert.equal(result.plays[0].text, '49.5 ov · A full delivery outside off stump');
  assert.equal(result.statistics?.find((stat) => stat.label === 'Innings 1 overs')?.value, '50.0');
  assert.equal(result.statistics?.length, 4);
  assert.ok(result.statistics?.every((stat) => stat.teamId === '17'));
  assert.equal(result.leaders?.[0].category, 'Innings 1 Runs');
  assert.equal(result.sources[0].fetchedAt, result.fetchedAt);
});

test('cricket summaries never substitute a different upstream league or event', async () => {
  const wrongLeague = summary(); wrongLeague.header.league.id = '8836'; wrongLeague.header.leagues = [{ id: '8836' }];
  const wrongEvent = summary(); wrongEvent.header.id = '123';
  const wrongCompetition = summary(); wrongCompetition.header.competitions[0].id = '123';
  for (const payload of [wrongLeague, wrongEvent, wrongCompetition]) await code(fetchCricketSummary({ league: 'cricket-19439', eventId: '1554418' }, mock(payload)), 'UPSTREAM_INVALID');
});

test('numeric cricket IDs cannot modify the fixed upstream host or path', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return response({}); };
  for (const league of ['https://bad.test', 'cricket-../x', 'cricket-1?url=evil', 'cricket-1234567890123456']) await code(fetchCricketSummary({ league, eventId: '1' }, fetcher), 'INVALID_INPUT');
  for (const eventId of ['../x', '1&league=3', '', '1234567890123456']) await code(fetchCricketSummary({ league: 'cricket-19439', eventId }, fetcher), 'INVALID_INPUT');
  assert.equal(calls, 0);
});

test('cricket cache deduplicates parallel header requests and gives isolated records', async () => {
  resetEspnCricketCache(); let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; await Promise.resolve(); return response(header()); };
  const [first, second] = await Promise.all([fetchCricketScoreboard({}, fetcher), fetchCricketScoreboard({ date: today }, fetcher)]);
  assert.equal(calls, 1);
  first.events[0].teams[1].score = '999';
  assert.equal(second.events[0].teams[1].score, '256 (50 ov)');
});

test('empty cricket schedules are valid but broken header shapes do not become no fixtures', async () => {
  assert.deepEqual((await fetchCricketScoreboard({}, mock({ sports: [] }))).events, []);
  for (const payload of [{}, { sports: [{ slug: 'cricket' }] }, header([{ id: 'bad' }])]) await code(fetchCricketScoreboard({}, mock(payload)), 'UPSTREAM_INVALID');
});

test('cricket redirects, malformed JSON, oversized bodies and aborts are rejected', async () => {
  await code(fetchCricketScoreboard({}, async () => new Response(null, { status: 302, headers: { location: 'https://bad.test' } })), 'UPSTREAM_HTTP');
  await code(fetchCricketScoreboard({}, async () => new Response('<html>')), 'UPSTREAM_INVALID');
  await code(fetchCricketScoreboard({}, async () => new Response('x'.repeat(5 * 1024 * 1024 + 1))), 'UPSTREAM_INVALID');
  await code(fetchCricketScoreboard({}, async () => { throw new DOMException('aborted', 'AbortError'); }), 'UPSTREAM_TIMEOUT');
});
