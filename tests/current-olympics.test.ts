import assert from 'node:assert/strict';
import test from 'node:test';
import { EspnProviderError } from '../lib/analysis/espn';
import { discoverCurrentOlympics, fetchCurrentOlympicSummary, resetCurrentOlympicsCache } from '../lib/analysis/current-olympics';

const AS_OF = '2024-08-01T16:30:00.000Z';
function season(year = '2024') {
  return { year, type: 'summer', name: '2024 Paris', calendarStartDate: '2024-07-24T04:00Z', calendarEndDate: '2024-08-12T03:59Z' };
}
// Synthetic state transitions exercise the contract. Real 2024 responses now report post.
function competition(overrides: Record<string, unknown> = {}) {
  return {
    id: '12345', description: "Women's 3m Springboard, Final", date: '2024-08-01T16:00Z',
    discipline: { id: '16' }, competitionType: 'individual', types: [{ type: 'run', text: 'Final' }],
    olympicsStatus: { state: 'in', completed: false, description: 'In progress' },
    results: [{ athlete: { id: 'a1', firstName: 'Example', lastName: 'Diver' }, country: { abbreviation: 'CHN' }, place: 1, result: '240.30' }],
    ...overrides,
  };
}
function payload(date: string, competitions: unknown[]) { return { season: season(), day: { date }, competitions }; }
function response(value: unknown) { return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } }); }
function provider(competitions: unknown[], input?: { previous?: unknown[] }) {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push(String(url)); assert.equal(init?.redirect, 'manual'); assert.ok(init?.signal instanceof AbortSignal);
    const date = new URL(String(url)).searchParams.get('dates');
    return response(payload(date === '20240731' ? '2024-07-31' : '2024-08-01', date === '20240731' ? input?.previous ?? [] : competitions));
  };
  return { calls, fetcher };
}
async function code(promise: Promise<unknown>, expected: string) { await assert.rejects(promise, (error) => error instanceof EspnProviderError && error.code === expected); }

test('current Olympic discovery requires explicit in-progress state and carries current provenance', async () => {
  const { calls, fetcher } = provider([competition()]);
  const found = await discoverCurrentOlympics({ sport: 'diving', asOf: AS_OF }, fetcher);
  assert.equal(found.events.length, 1);
  assert.equal(found.events[0].id, 'espn-cur-summer-2024-20240801-12345');
  assert.equal(found.events[0].league, 'espn-current-olympics');
  assert.equal(found.events[0].provider, 'espn-olympics');
  assert.equal(found.events[0].dataMode, 'lookup');
  assert.equal(found.events[0].status, 'live');
  assert.equal(found.events[0].phase, 'Final');
  assert.equal(found.events[0].competitors[0].score, '240.30');
  assert.equal(found.events[0].teams.length, 0);
  assert.equal(found.limited, true);
  assert.equal(calls[0], 'https://site.api.espn.com/apis/site/v2/olympics/summer/2024/results?dates=20240801&lang=en&region=us');
  assert.ok(found.sources.every((source) => Number.isFinite(Date.parse(source.fetchedAt)) && source.kind === 'provider'));
  const summary = await fetchCurrentOlympicSummary({ eventId: found.events[0].id, asOf: AS_OF }, fetcher);
  assert.equal(summary.event.id, found.events[0].id);
  assert.deepEqual(summary.rounds, []);
  assert.match(summary.limitations.join(' '), /limited coverage/);
  assert.match(summary.limitations.join(' '), /No complete current Olympic schedule/);
});

test('post, completed, scheduled and availability flags cannot become a live event', async () => {
  const possibilities = [
    competition({ olympicsStatus: { state: 'post', completed: true, description: 'Medal Official' } }),
    competition({ olympicsStatus: { state: 'pre', completed: false } }),
    competition({ olympicsStatus: { state: 'in', completed: true } }),
    competition({ olympicsStatus: { state: 'in', completed: false, description: 'Suspended' } }),
    competition({ olympicsStatus: {}, timeValid: true, liveAvailable: true, summaryEvent: true, highlightsAvailable: true }),
  ];
  for (const fixture of possibilities) assert.deepEqual((await discoverCurrentOlympics({ sport: 'diving', asOf: AS_OF }, provider([fixture]).fetcher)).events, []);
});

test('current discovery rejects future starts, stale states and events with expired end times', async () => {
  for (const fixture of [
    competition({ date: '2024-08-01T16:31Z' }),
    competition({ date: '2024-07-31T20:00Z' }),
    competition({ endDate: '2024-08-01T16:20Z' }),
  ]) {
    const { fetcher } = provider([fixture], { previous: [fixture] });
    assert.deepEqual((await discoverCurrentOlympics({ sport: 'diving', asOf: AS_OF }, fetcher)).events, []);
  }
});

test('an explicit live event across UTC midnight can be discovered within eighteen hours', async () => {
  const asOf = '2024-08-01T02:00:00Z';
  const { fetcher } = provider([], { previous: [competition({ date: '2024-07-31T23:00Z' })] });
  const found = await discoverCurrentOlympics({ sport: 'diving', asOf }, fetcher);
  assert.equal(found.events[0].id, 'espn-cur-summer-2024-20240731-12345');
  assert.equal((await fetchCurrentOlympicSummary({ eventId: found.events[0].id, asOf }, fetcher)).event.status, 'live');
});

test('empty current dates without a day field are valid and do not substitute Paris 2024 events', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url) => {
    calls++; assert.ok(String(url).includes('dates=20261015'));
    return response({ season: season(), competitions: [] });
  };
  const found = await discoverCurrentOlympics({ sport: 'swimming', asOf: '2026-10-15T10:00:00Z' }, fetcher);
  assert.deepEqual(found.events, []); assert.equal(found.sources.length, 1); assert.equal(found.limited, true); assert.equal(calls, 1);
});

test('mismatched Games, dates and missing metadata fail rather than inventing coverage', async () => {
  for (const data of [
    { ...payload('2024-08-01', [competition()]), season: season('2020') },
    payload('2024-07-31', [competition()]),
    { season: season(), competitions: [competition()] },
    { competitions: [] },
    { season: { ...season(), type: 'winter' }, competitions: [] },
  ]) await code(discoverCurrentOlympics({ sport: 'diving', asOf: AS_OF }, async () => response(data)), 'UPSTREAM_INVALID');
});

test('all four sports filter the same day data by actual Olympic discipline IDs', async () => {
  const fixtures = ['16', '39', '3', '21', '22', '23'].map((id, i) => competition({ id: String(10000 + i), discipline: { id } }));
  const { fetcher } = provider(fixtures);
  for (const [sport, expected] of [['diving', 1], ['swimming', 1], ['athletics', 1], ['gymnastics', 3]] as const) {
    assert.equal((await discoverCurrentOlympics({ sport, asOf: AS_OF }, fetcher)).events.length, expected);
  }
});

test('summary IDs cannot route to arbitrary hosts, stale dates, another Games or another event', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return response(payload('2024-08-01', [competition()])); };
  for (const eventId of ['https://bad.test', 'espn-cur-summer-2024-20240801-1/../../secret', 'espn-cur-summer-2020-20240801-12345', 'espn-cur-summer-2024-20240729-12345', 'espn-cur-summer-2024-20240230-12345']) await code(fetchCurrentOlympicSummary({ eventId, asOf: AS_OF }, fetcher), 'INVALID_INPUT');
  assert.equal(calls, 0);
  await code(fetchCurrentOlympicSummary({ eventId: 'espn-cur-summer-2024-20240801-999', asOf: AS_OF }, fetcher), 'UPSTREAM_INVALID');
});

test('summary checks current time even when the same ID has a cached live response', async () => {
  const { fetcher, calls } = provider([competition()]);
  const found = await discoverCurrentOlympics({ sport: 'diving', asOf: AS_OF }, fetcher);
  const count = calls.length;
  await code(fetchCurrentOlympicSummary({ eventId: found.events[0].id, asOf: '2024-08-02T12:00:00Z' }, fetcher), 'UPSTREAM_INVALID');
  await code(fetchCurrentOlympicSummary({ eventId: found.events[0].id, asOf: '2026-10-15T10:00:00Z' }, fetcher), 'INVALID_INPUT');
  assert.equal(calls.length, count);
});

test('concurrent sport lookups share each day request and return independent records', async () => {
  resetCurrentOlympicsCache();
  const { fetcher, calls } = provider([competition()]);
  const [first, second] = await Promise.all([
    discoverCurrentOlympics({ sport: 'diving', asOf: AS_OF }, fetcher), discoverCurrentOlympics({ sport: 'diving', asOf: AS_OF }, fetcher),
    discoverCurrentOlympics({ sport: 'swimming', asOf: AS_OF }, fetcher), discoverCurrentOlympics({ sport: 'athletics', asOf: AS_OF }, fetcher),
  ]);
  assert.equal(calls.length, 2);
  first.events[0].competitors[0].score = '999';
  assert.equal(second.events[0].competitors[0].score, '240.30');
});

test('current lookup bounds input, fixed-host redirects, bodies and future API failures', async () => {
  for (const asOf of ['yesterday', '2024-02-30T12:00:00Z', '2024-08-01&url=https://bad.test']) await code(discoverCurrentOlympics({ sport: 'diving', asOf }, async () => response({})), 'INVALID_INPUT');
  await code(discoverCurrentOlympics({ sport: 'constructor' as 'diving', asOf: AS_OF }, async () => response({})), 'INVALID_INPUT');
  await code(discoverCurrentOlympics({ sport: 'diving', asOf: AS_OF }, async () => new Response(null, { status: 302, headers: { location: 'https://bad.test' } })), 'UPSTREAM_HTTP');
  await code(discoverCurrentOlympics({ sport: 'diving', asOf: AS_OF }, async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))), 'UPSTREAM_INVALID');
  await code(discoverCurrentOlympics({ sport: 'diving', asOf: AS_OF }, async () => { throw new DOMException('aborted', 'AbortError'); }), 'UPSTREAM_TIMEOUT');
  await assert.rejects(discoverCurrentOlympics({ sport: 'diving', asOf: '2028-07-20T12:00:00Z' }, async (url) => {
    assert.match(String(url), /summer\/2028\/results\?dates=20280720/);
    return new Response(null, { status: 500 });
  }), (error) => error instanceof EspnProviderError && error.code === 'UPSTREAM_HTTP' && error.upstreamStatus === 500);
});
