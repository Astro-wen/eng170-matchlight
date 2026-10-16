import assert from 'node:assert/strict';
import test from 'node:test';
import { EspnProviderError } from '../lib/analysis/espn';
import { fetchEspnOlympicSummary, resetEspnOlympicsCache, searchEspnOlympics } from '../lib/analysis/espn-olympics';

function result(id: string, first: string, last: string, country: string, rank: number, score: string) {
  return { athlete: { id, firstName: first, lastName: last }, country: { abbreviation: country }, place: rank, result: score, resultGroup: country };
}
// Minimal field subsets verified against ESPN's public 2024 per-day JSON feed.
function diving() {
  return {
    id: '30401', description: "Women's 3m Springboard, Final", date: '2024-08-09T13:00Z',
    discipline: { id: '16' }, event: { id: '262' }, competitionType: 'individual',
    types: [{ text: 'Final', type: 'run' }], olympicsStatus: { completed: true, state: 'post', description: 'Medal Official' },
    results: [result('70424', 'Chen', 'Yiwen', 'CHN', 1, '376.00'), result('70293', 'Maddi', 'Keeney', 'AUS', 2, '343.10'), result('70420', 'Chang', 'Yani', 'CHN', 3, '318.75')],
  };
}
function day(date: string, competitions: unknown[]) { return { season: { year: '2024', type: 'summer' }, day: { date }, competitions }; }
function response(value: unknown, init?: ResponseInit) { return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' }, ...init }); }
function fetcher(value: unknown): typeof fetch { return async () => response(value); }
async function code(promise: Promise<unknown>, expected: string) { await assert.rejects(promise, (error) => error instanceof EspnProviderError && error.code === expected); }

test('ESPN Olympic tools preserve real medal result precision, countries, dates and provenance', async () => {
  let url = '';
  const mock: typeof fetch = async (input, init) => {
    url = String(input);
    assert.equal(init?.redirect, 'manual');
    assert.ok(init?.signal instanceof AbortSignal);
    return response(day('2024-08-09', [diving()]));
  };
  const found = await searchEspnOlympics({ sport: 'diving', date: '2024-08-09' }, mock);
  assert.equal(url, 'https://site.api.espn.com/apis/site/v2/olympics/summer/2024/results?dates=20240809&lang=en&region=us');
  const event = found.events[0];
  assert.equal(event.id, 'espn-olym-summer-2024-20240809-30401');
  assert.equal(event.dataMode, 'historical');
  assert.equal(event.status, 'final');
  assert.equal(event.phase, 'Final');
  assert.equal(event.competitors.length, 3);
  assert.deepEqual(event.competitors.map((p) => [p.name, p.country, p.rank, p.score]), [
    ['Chen Yiwen', 'CHN', 1, '376.00'], ['Maddi Keeney', 'AUS', 2, '343.10'], ['Chang Yani', 'CHN', 3, '318.75'],
  ]);
  const summary = await fetchEspnOlympicSummary({ eventId: event.id }, mock);
  assert.equal(summary.fetchedAt, found.sources[0].fetchedAt);
  assert.equal(summary.sources[0].url, url);
  assert.deepEqual(summary.rounds, []);
  assert.ok(summary.limitations.some((limitation) => /omit other finalists/.test(limitation)));
  assert.ok(summary.limitations.some((limitation) => /particular action/.test(limitation)));
});

test('all four Olympic sports use discipline IDs and locally filter ESPN responses that ignore filters', async () => {
  const base = diving();
  const make = (id: string, discipline: string, name: string, winner: ReturnType<typeof result>) => ({ ...base, id, discipline: { id: discipline }, date: '2024-08-04T19:55Z', description: name, results: [winner] });
  const mock = fetcher(day('2024-08-04', [
    make('30665', '3', "Men's 100m, Final", result('66546', 'Noah', 'Lyles', 'USA', 1, '9.784')),
    make('30599', '39', "Men's 1500m Freestyle, Final", result('64274', 'Bobby', 'Finke', 'USA', 1, '14:30.67')),
    make('30303', '21', "Men's Rings, Final", result('70320', 'Liu', 'Yang', 'CHN', 1, '15.300')),
    { ...base, date: '2024-08-04T13:00Z' },
  ]));
  for (const sport of ['athletics', 'swimming', 'gymnastics', 'diving'] as const) {
    const found = await searchEspnOlympics({ sport, date: '2024-08-04' }, mock);
    assert.equal(found.events.length, 1);
    assert.equal(found.events[0].sport, sport);
  }
  assert.equal((await searchEspnOlympics({ sport: 'athletics', date: '2024-08-04' }, mock)).events[0].competitors[0].score, '9.784');
});

test('Olympic query searches names, nationality and event without inventing candidates', async () => {
  const mock = fetcher(day('2024-08-09', [diving()]));
  assert.equal((await searchEspnOlympics({ sport: 'diving', date: '2024-08-09', query: 'CHEN Springboard' }, mock)).events.length, 1);
  assert.equal((await searchEspnOlympics({ sport: 'diving', date: '2024-08-09', query: 'Simone Biles' }, mock)).events.length, 0);
});

test('relay and synchronised entries group repeated team results rather than rank every athlete separately', async () => {
  const fixture = { ...diving(), competitionType: 'group', results: [
    result('a', 'Chang', 'Yani', 'CHN', 1, '337.68'), result('b', 'Chen', 'Yiwen', 'CHN', 1, '337.68'),
    result('c', 'Sarah', 'Bacon', 'USA', 2, '314.64'), result('d', 'Kassidy', 'Cook', 'USA', 2, '314.64'),
  ] };
  const found = await searchEspnOlympics({ sport: 'diving', date: '2024-08-09' }, fetcher(day('2024-08-09', [fixture])));
  assert.equal(found.events[0].competitors.length, 2);
  assert.equal(found.events[0].competitors[0].name, 'Chang Yani, Chen Yiwen');
  assert.equal(found.events[0].competitors[0].athleteId, undefined);
  assert.equal(found.events[0].competitors[0].score, '337.68');
});

test('future/out-of-window captures never fetch archived Olympic results as live data', async () => {
  let calls = 0;
  const mock: typeof fetch = async () => { calls++; throw new Error('must not request'); };
  for (const date of ['2026-10-15', '2028-07-15', '2024-07-23', '2024-08-12']) {
    const found = await searchEspnOlympics({ sport: 'swimming', date }, mock);
    assert.deepEqual(found, { events: [], sources: [], limited: true });
  }
  assert.equal(calls, 0);
});

test('Olympic input paths, season, event and actual calendar dates are strictly validated', async () => {
  let calls = 0;
  const mock: typeof fetch = async () => { calls++; return response({}); };
  for (const date of ['2024-02-30', '2024-13-01', '../20240809', '2024-08-09&url=https://bad.test']) await code(searchEspnOlympics({ sport: 'diving', date }, mock), 'INVALID_INPUT');
  for (const sport of ['constructor', '../../diving', 'cricket']) await code(searchEspnOlympics({ sport: sport as 'diving', date: '2024-08-09' }, mock), 'INVALID_INPUT');
  for (const eventId of ['https://bad.test', 'espn-olym-summer-2028-20280715-1', 'espn-olym-summer-2024-20240899-1', 'espn-olym-summer-2024-20240809-1/../../x']) await code(fetchEspnOlympicSummary({ eventId }, mock), 'INVALID_INPUT');
  assert.equal(calls, 0);
});

test('mismatched ESPN dates, seasons and event IDs fail without substituting a different event', async () => {
  for (const payload of [day('2024-08-08', [diving()]), { ...day('2024-08-09', [diving()]), season: { year: '2028', type: 'summer' } }, { ...day('2024-08-09', [diving()]), competitions: null }]) {
    await code(searchEspnOlympics({ sport: 'diving', date: '2024-08-09' }, fetcher(payload)), 'UPSTREAM_INVALID');
  }
  await code(fetchEspnOlympicSummary({ eventId: 'espn-olym-summer-2024-20240809-99999' }, fetcher(day('2024-08-09', [diving()]))), 'UPSTREAM_INVALID');
});

test('the day cache is shared across sports and summaries, isolated per provider, and clone-safe', async () => {
  resetEspnOlympicsCache();
  let calls = 0;
  const mock: typeof fetch = async () => { calls++; return response(day('2024-08-09', [diving()])); };
  const first = await searchEspnOlympics({ sport: 'diving', date: '2024-08-09' }, mock);
  first.events[0].competitors[0].score = '999';
  await searchEspnOlympics({ sport: 'swimming', date: '2024-08-09' }, mock);
  const summary = await fetchEspnOlympicSummary({ eventId: first.events[0].id }, mock);
  assert.equal(calls, 1);
  assert.equal(summary.event.competitors[0].score, '376.00');
  assert.equal((await searchEspnOlympics({ sport: 'diving', date: '2024-08-09' }, fetcher(day('2024-08-09', [])))).events.length, 0);
});

test('parallel first lookups of one Olympic day share an in-flight request', async () => {
  resetEspnOlympicsCache();
  let calls = 0;
  const mock: typeof fetch = async () => { calls++; await Promise.resolve(); return response(day('2024-08-09', [diving()])); };
  const [a, b] = await Promise.all([
    searchEspnOlympics({ sport: 'diving', date: '2024-08-09' }, mock),
    fetchEspnOlympicSummary({ eventId: 'espn-olym-summer-2024-20240809-30401' }, mock),
    searchEspnOlympics({ sport: 'swimming', date: '2024-08-09' }, mock),
    searchEspnOlympics({ sport: 'athletics', date: '2024-08-09' }, mock),
  ]);
  assert.equal(calls, 1);
  a.events[0].competitors[0].score = '999';
  assert.equal(b.event.competitors[0].score, '376.00');
});

test('ESPN Olympic redirects, malformed JSON, oversized streams and aborts return bounded errors', async () => {
  await code(searchEspnOlympics({ sport: 'diving', date: '2024-08-09' }, async () => new Response(null, { status: 302, headers: { location: 'https://bad.test' } })), 'UPSTREAM_HTTP');
  await code(searchEspnOlympics({ sport: 'diving', date: '2024-08-09' }, async () => new Response('<html>not json</html>')), 'UPSTREAM_INVALID');
  await code(searchEspnOlympics({ sport: 'diving', date: '2024-08-09' }, async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))), 'UPSTREAM_INVALID');
  await code(searchEspnOlympics({ sport: 'diving', date: '2024-08-09' }, async () => { throw new DOMException('aborted', 'AbortError'); }), 'UPSTREAM_TIMEOUT');
});
