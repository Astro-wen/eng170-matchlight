import assert from 'node:assert/strict';
import test from 'node:test';
import { findOlympicEvents, fetchOlympicEvent, OlympicArchiveError, resetOlympicArchiveCache } from '../lib/analysis/olympic-archive';
import type { IndividualSport } from '../lib/analysis/individual-types';

function response(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' }, ...init });
}
function fixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 16756, day: '2024-08-09', discipline_name: 'Diving', event_name: 'Women 3m Springboard',
    detailed_event_name: "Women's 3m Springboard Final", start_date: '2024-08-09T15:00:00+02:00',
    status: 'Finished', is_live: 0,
    competitors: [
      { country_id: 'China', country_flag_url: 'https://codante.s3.amazonaws.com/codante-apis/olympic-games/flags/CHN.png', competitor_name: 'CHEN Yiwen', position: 0, result_position: '1', result_mark: '376.00' },
      { country_id: 'Austrália', country_flag_url: 'https://codante.s3.amazonaws.com/codante-apis/olympic-games/flags/AUS.png', competitor_name: 'Maddison KEENEY', position: 1, result_position: '2', result_mark: '343.10' },
      { country_id: 'Suécia', country_flag_url: 'https://codante.s3.amazonaws.com/codante-apis/olympic-games/flags/SWE.png', competitor_name: 'Emilia NILSSON GARIP', position: 8, result_position: '', result_mark: '279.40' },
    ], ...overrides,
  };
}
function mockFetch(payload: unknown): typeof fetch { return async () => response(payload); }
async function rejectsCode(promise: Promise<unknown>, code: OlympicArchiveError['code']): Promise<void> {
  await assert.rejects(promise, (error) => error instanceof OlympicArchiveError && error.code === code);
}

test('archive accepts only configured sports, valid calendar dates, bounded text and fixed numeric event IDs', async () => {
  let requests = 0;
  const fetcher: typeof fetch = async () => { requests++; return response({ data: [] }); };
  for (const sport of ['basketball', 'constructor', '__proto__', 'https://example.com'] as unknown as IndividualSport[]) {
    await rejectsCode(findOlympicEvents({ sport, date: '2024-08-09' }, fetcher), 'UNSUPPORTED_SPORT');
  }
  for (const date of ['2024-02-30', '2025-02-29', '2024-8-09', '2024-08-09&url=https://example.com']) {
    await rejectsCode(findOlympicEvents({ sport: 'diving', date }, fetcher), 'INVALID_INPUT');
  }
  for (const eventId of ['', '../1', 'paris-../1', 'https://example.com', '1?x=2', '0', '1234567890']) {
    await rejectsCode(fetchOlympicEvent({ eventId }, fetcher), 'INVALID_INPUT');
  }
  await rejectsCode(findOlympicEvents({ sport: 'diving', date: '2024-08-09', query: 'a'.repeat(121) }, fetcher), 'INVALID_INPUT');
  await rejectsCode(findOlympicEvents({ sport: 'diving', date: '2024-08-09', query: 'CHEN\nYiwen' }, fetcher), 'INVALID_INPUT');
  assert.equal(requests, 0);
});

test('current and out-of-coverage dates return explicitly limited empty results without looking up 2024 events', async () => {
  const fetcher: typeof fetch = async () => { throw new Error('Network must not be used'); };
  for (const date of ['2026-10-15', '2024-07-23', '2024-08-12', '2028-07-15']) {
    assert.deepEqual(await findOlympicEvents({ sport: 'athletics', date }, fetcher), { events: [], sources: [], limited: true });
  }
});

test('actual diving record preserves archive date, totals, known ranks, countries and original source timestamp', async () => {
  let requestUrl = '';
  const fetcher: typeof fetch = async (url, init) => {
    requestUrl = String(url); assert.equal(init?.redirect, 'manual'); assert.ok(init?.signal instanceof AbortSignal);
    return response({ data: [fixture()], meta: { last_page: 1 } });
  };
  const result = await findOlympicEvents({ sport: 'diving', date: '2024-08-09' }, fetcher);
  assert.equal(requestUrl, 'https://apis.codante.io/olympic-games/events?discipline=DIV&date=2024-08-09&page=1');
  const event = result.events[0];
  assert.equal(event.id, 'paris-16756'); assert.equal(event.league, 'paris2024'); assert.equal(event.provider, 'olympic-archive');
  assert.equal(event.date, '2024-08-09T15:00:00+02:00'); assert.equal(event.status, 'final'); assert.equal(event.dataMode, 'historical');
  assert.deepEqual(event.teams, []); assert.equal(event.phase, 'Final');
  assert.equal(event.competitors[0].score, '376.00'); assert.equal(event.competitors[1].country, 'AUS');
  assert.equal(event.competitors[0].rank, 1); assert.equal(event.competitors[2].rank, undefined);
  assert.equal(result.sources[0].url, requestUrl); assert.match(result.sources[0].label, /historical/i);
  assert.ok(Number.isFinite(Date.parse(result.sources[0].fetchedAt)));
});

test('2024 is_live flags and incomplete statuses cannot claim live or scheduled coverage in the present', async () => {
  for (const [status, expected] of [['Finished', 'final'], ['Running', 'unknown'], ['Scheduled', 'unknown'], ['', 'unknown']]) {
    const summary = await fetchOlympicEvent({ eventId: '16756' }, mockFetch({ data: fixture({ status, is_live: 1 }) }));
    assert.equal(summary.event.status, expected); assert.equal(summary.event.dataMode, 'historical');
    assert.deepEqual(summary.rounds, []); assert.match(summary.limitations.join(' '), /not a live feed/);
    assert.equal(summary.sources[0].fetchedAt, summary.fetchedAt);
  }
});

test('gymnastics marks with ambiguous apparatus scope are omitted rather than displayed as all-around totals', async () => {
  const summary = await fetchOlympicEvent({ eventId: 'paris-15494' }, mockFetch({ data: fixture({
    id: 15494, day: '2024-08-01', start_date: '2024-08-01T18:15:00+02:00', discipline_name: 'Artistic Gymnastics',
    detailed_event_name: "Women's All-Around Final", competitors: [
      { country_id: 'Japão', competitor_name: 'NAKAMURA Haruka', position: 1, result_position: '', result_mark: '13.700' },
      { country_id: 'EUA', country_flag_url: 'https://codante.s3.amazonaws.com/codante-apis/olympic-games/flags/USA.png', competitor_name: 'Simone BILES', position: 0, result_position: '1', result_mark: '14.133' },
    ],
  }) }));
  assert.equal(summary.event.sport, 'gymnastics'); assert.equal(summary.event.competitors[0].score, undefined);
  assert.equal(summary.event.competitors[1].score, undefined); assert.equal(summary.event.competitors[1].rank, 1);
  assert.equal(summary.event.competitors[1].country, 'USA'); assert.deepEqual(summary.rounds, []);
  assert.match(summary.limitations.join(' '), /apparatus marks or all-around totals/);
});

test('countries come from a valid code or the allowlisted archive flag path; empty and non-numeric ranks stay unknown', async () => {
  const summary = await fetchOlympicEvent({ eventId: '16756' }, mockFetch({ data: fixture({ competitors: [
    { competitor_name: '<b>Athlete A</b>', country_id: 'Australia', country_flag_url: 'https://evil.example/flags/AUS.png', result_position: '', result_mark: '' },
    { competitor_name: 'Athlete B', country_id: 'Brasil', country_flag_url: 'https://codante.s3.amazonaws.com/codante-apis/olympic-games/flags/BRA.png?fake=1', result_position: 'DNF', result_mark: 'DNF' },
    { competitor_name: 'Athlete C', country_id: 'GBR', result_position: '0' },
    { competitor_name: 'Athlete D', country_id: 'EUA', country_flag_url: 'https://codante.s3.amazonaws.com/codante-apis/olympic-games/flags/USA.png', result_position: '3' },
  ] }) }));
  const rows = summary.event.competitors;
  assert.equal(rows[0].name, 'Athlete A'); assert.equal(rows[0].country, undefined); assert.equal(rows[0].score, undefined);
  assert.equal(rows[1].country, undefined); assert.equal(rows[1].rank, undefined); assert.equal(rows[1].score, 'DNF');
  assert.equal(rows[2].country, 'GBR'); assert.equal(rows[2].rank, undefined);
  assert.equal(rows[3].country, 'USA'); assert.equal(rows[3].rank, 3);
});

test('pagination keeps filters on the fixed origin and local query matches athlete names without accepting upstream links', async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input)); urls.push(url.href);
    assert.equal(url.origin, 'https://apis.codante.io'); assert.equal(url.searchParams.get('discipline'), 'DIV');
    assert.equal(url.searchParams.get('date'), '2024-08-09');
    const page = Number(url.searchParams.get('page'));
    return response({ data: [fixture({ id: 16755 + page })], links: { next: 'https://evil.example/key' }, meta: { last_page: 5 } });
  };
  const result = await findOlympicEvents({ sport: 'diving', date: '2024-08-09', query: 'Yiwen CHEN' }, fetcher);
  assert.equal(urls.length, 3); assert.equal(result.events.length, 3); assert.equal(result.sources.length, 3); assert.equal(result.limited, true);
  const miss = await findOlympicEvents({ sport: 'diving', date: '2024-08-09', query: 'Unknown athlete' }, fetcher);
  assert.equal(miss.events.length, 0); assert.equal(urls.length, 3); // cached pages reused, not re-requested
});

test('cached source times remain truthful and caller mutation cannot poison later candidate or summary results', async () => {
  resetOlympicArchiveCache(); let requests = 0;
  const fetcher: typeof fetch = async () => { requests++; return response({ data: fixture() }); };
  const first = await fetchOlympicEvent({ eventId: 'paris-16756' }, fetcher);
  const fetchedAt = first.fetchedAt;
  first.event.competitors[0].score = '999.00'; first.sources[0].fetchedAt = '1970-01-01T00:00:00Z';
  const second = await fetchOlympicEvent({ eventId: '16756' }, fetcher);
  assert.equal(requests, 1); assert.equal(second.event.competitors[0].score, '376.00');
  assert.equal(second.fetchedAt, fetchedAt); assert.equal(second.sources[0].fetchedAt, fetchedAt);
  const realNow = Date.now;
  try { Date.now = () => realNow() + 60_001; await fetchOlympicEvent({ eventId: '16756' }, fetcher); }
  finally { Date.now = realNow; }
  assert.equal(requests, 2);
});

test('explicit final and gender search terms distinguish actual finals from semi-finals and women from men', async () => {
  const fetcher = mockFetch({ data: [
    fixture({ id: 16117, discipline_name: 'Athletics', detailed_event_name: "Men's 100m Final" }),
    fixture({ id: 16105, discipline_name: 'Athletics', detailed_event_name: "Men's 100m Semi-Final" }),
    fixture({ id: 16118, discipline_name: 'Athletics', detailed_event_name: "Women's 100m Final" }),
  ] });
  const result = await findOlympicEvents({ sport: 'athletics', date: '2024-08-09', query: "Men's 100m Final" }, fetcher);
  assert.deepEqual(result.events.map((event) => event.id), ['paris-16117']);
});

test('candidate lists reject mismatched sports and dates, and summary rejects another ID or non-archive records', async () => {
  const result = await findOlympicEvents({ sport: 'diving', date: '2024-08-09' }, mockFetch({ data: [
    fixture(), fixture({ id: 16757, day: '2024-08-08', start_date: '2024-08-08T15:00:00+02:00' }),
    fixture({ id: 16758, discipline_name: 'Athletics' }), fixture({ id: 'not-an-id' }),
  ] }));
  assert.equal(result.events.length, 1); assert.equal(result.limited, true);
  for (const bad of [fixture({ id: 16757 }), fixture({ day: '2026-08-09', start_date: '2026-08-09T15:00:00+02:00' }), fixture({ discipline_name: 'Football' })]) {
    await rejectsCode(fetchOlympicEvent({ eventId: '16756' }, mockFetch({ data: bad })), 'UPSTREAM_INVALID');
  }
});

test('malformed, oversized, redirected, failed, missing and timed-out responses never become successful empty coverage', async () => {
  for (const payload of [{}, { data: null }, { data: 'error' }, { data: {} }]) {
    await rejectsCode(findOlympicEvents({ sport: 'diving', date: '2024-08-09' }, mockFetch(payload)), 'UPSTREAM_INVALID');
  }
  for (const status of [301, 403, 429, 500]) {
    const fetcher: typeof fetch = async () => response({ error: 'Upstream failed' }, { status });
    await rejectsCode(findOlympicEvents({ sport: 'diving', date: '2024-08-09' }, fetcher), 'UPSTREAM_HTTP');
  }
  const malformed: typeof fetch = async () => new Response('{bad');
  await rejectsCode(fetchOlympicEvent({ eventId: '16756' }, malformed), 'UPSTREAM_INVALID');
  const advertised: typeof fetch = async () => new Response('{}', { headers: { 'content-length': String(2 * 1024 * 1024 + 1) } });
  await rejectsCode(fetchOlympicEvent({ eventId: '16756' }, advertised), 'UPSTREAM_INVALID');
  const streamed: typeof fetch = async () => new Response('a'.repeat(2 * 1024 * 1024 + 1));
  await rejectsCode(fetchOlympicEvent({ eventId: '16756' }, streamed), 'UPSTREAM_INVALID');
  const timeout: typeof fetch = async () => { throw new DOMException('Timed out', 'AbortError'); };
  await rejectsCode(fetchOlympicEvent({ eventId: '16756' }, timeout), 'UPSTREAM_TIMEOUT');
  assert.deepEqual((await findOlympicEvents({ sport: 'diving', date: '2024-08-09' }, mockFetch({ data: [] }))).events, []);
  let attempts = 0;
  const recover: typeof fetch = async () => response({ data: ++attempts === 1 ? fixture({ id: 16757 }) : fixture() });
  await rejectsCode(fetchOlympicEvent({ eventId: '16756' }, recover), 'UPSTREAM_INVALID');
  assert.equal((await fetchOlympicEvent({ eventId: '16756' }, recover)).event.id, 'paris-16756');
  assert.equal(attempts, 2); // an invalid detail cannot poison the cache
});
