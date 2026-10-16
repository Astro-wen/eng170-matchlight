import assert from 'node:assert/strict';
import test from 'node:test';
import { AquaticsProviderError, fetchAquaticsEvent, findAquaticsEvents, resetAquaticsCache } from '../lib/analysis/world-aquatics';

const ID = 'ef62ff76-092c-4d34-882d-e247cd6a0310';
const ID2 = '6301246c-86e4-498e-b99d-b2b193d87bd1';
function response(value: unknown, init?: ResponseInit) { return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' }, ...init }); }
function event() {
  return { Id: ID, EventOfficialName: 'Olympic Games Paris 2024', DisciplineName: "Women's 3m Springboard", SportCode: 'DV', EventResultUtcDateTime: '2024-08-09T13:00:23', Heats: [
    { Name: 'Finals', PhaseName: 'Finals', Date: '2024-08-09', UtcDateTime: '2024-08-09T13:00:23', ResultStatus: 'OFFICIAL', SportCode: 'DV', Results: [
      { PersonId: '6dafbcbb-ef90-4cf4-b5f5-23134da47c96', FullName: 'CHEN Yiwen', NAT: 'CHN', Rank: 1, TotalPoints: '376.00', Dives: [
        { DiveOrder: 5, DiveNo: '5152B', DD: '3.0', DivePoints: '76.50', TotalPoints: '376.00', JudgesScores: [8.5, 8.5, 8, 9, 8.5, 8.5, 8.5].map((Score, index) => ({ Type: `J${index + 1}`, Score: String(Score) })) },
      ] },
    ] },
    { Name: 'Semifinals', Date: '2024-08-08', UtcDateTime: '2024-08-08T08:00:17', SportCode: 'DV', ResultStatus: 'OFFICIAL', Results: [{ FullName: 'CHEN Yiwen', TotalPoints: '360.85', NAT: 'CHN', Rank: 1 }] },
  ] };
}
function catalog(ids = [2943]) {
  return { pageInfo: { numPages: 1 }, content: ids.map((id) => ({ id, name: `Olympic Games Paris 2024 ${id}`, venueDateFrom: '2024-07-26T00:00:00Z', venueDateTo: '2024-08-11T00:00:00Z', disciplines: ['DV', 'SW'] })) };
}
function schedule() { return [{ Name: 'Final', PhaseName: 'Finals', Date: '2024-08-09', UtcDateTime: '2024-08-09T13:00:23', SportCode: 'DV', DisciplineId: ID, DisciplineName: "Women's 3m Springboard" }]; }
function simpleFetch(payload: unknown): typeof fetch { return async () => response(payload); }

test('Aquatics validates actual calendar dates, sports and safe phase IDs before making requests', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return response({}); };
  for (const eventId of ['../../secret', `${ID}?url=https://evil.test`, `wa-${ID}-h1000`, 'https://api.worldaquatics.com/fina/events/abc']) {
    await assert.rejects(fetchAquaticsEvent({ eventId }, fetcher), (e) => e instanceof AquaticsProviderError && e.code === 'INVALID_INPUT');
  }
  for (const date of ['2025-02-29', '2024-02-30', '2024-8-09', '2024-08-09&foo=bar']) {
    await assert.rejects(findAquaticsEvents({ sport: 'diving', date }, fetcher), (e) => e instanceof AquaticsProviderError && e.code === 'INVALID_INPUT');
  }
  assert.equal(calls, 0);
});

test('Official final preserves actual Chen Yiwen score, complete judge panel, DD and provenance', async () => {
  const result = await fetchAquaticsEvent({ eventId: `wa-${ID}-h0` }, async (url, init) => {
    assert.equal(String(url), `https://api.worldaquatics.com/fina/events/${ID}`);
    assert.equal(init?.redirect, 'manual'); assert.ok(init?.signal instanceof AbortSignal);
    return response(event());
  });
  assert.equal(result.event.dataMode, 'historical'); assert.equal(result.event.status, 'final');
  assert.equal(result.event.date, '2024-08-09T13:00:23.000Z');
  assert.equal(result.event.competitors[0].score, '376.00');
  const dive = result.rounds[0];
  assert.equal(dive.score, '76.50'); assert.equal(dive.total, '376.00'); assert.equal(dive.difficulty, 3);
  assert.deepEqual(dive.judgeScores, [8.5, 8.5, 8, 9, 8.5, 8.5, 8.5]);
  assert.equal(dive.actionCode, '5152B'); assert.equal(dive.round, 5);
  const sorted = [...dive.judgeScores!].sort((a, b) => a - b);
  assert.equal(sorted.slice(2, 5).reduce((a, b) => a + b, 0) * dive.difficulty!, Number(dive.score));
  assert.equal(result.sources[0].fetchedAt, result.fetchedAt);
  assert.ok(result.limitations.some((s) => s.includes('reason for a deduction')));
});

test('Phase IDs and dates stay distinct instead of applying final scores to semifinals', async () => {
  const result = await fetchAquaticsEvent({ eventId: `wa-${ID}-h1` }, simpleFetch(event()));
  assert.equal(result.event.phase, 'Semifinals'); assert.equal(result.event.date, '2024-08-08T08:00:17.000Z');
  assert.equal(result.event.competitors[0].score, '360.85'); assert.equal(result.rounds.length, 0);
  const invalid = event(); delete (invalid.Heats[1] as Partial<typeof invalid.Heats[1]>).UtcDateTime;
  await assert.rejects(fetchAquaticsEvent({ eventId: `wa-${ID}-h1` }, simpleFetch(invalid)), (e) => e instanceof AquaticsProviderError && e.code === 'UPSTREAM_INVALID');
  await assert.rejects(fetchAquaticsEvent({ eventId: `wa-${ID}-h99` }, simpleFetch(event())), (e) => e instanceof AquaticsProviderError && e.code === 'NOT_FOUND');
});

test('Missing judges, difficulty, rank and scores are not coerced to zero', async () => {
  const data = event(), result = data.Heats[0].Results[0];
  assert.ok('Dives' in result);
  const dive = result.Dives[0];
  (dive as Record<string, unknown>).DD = ''; (dive.JudgesScores[2] as Record<string, unknown>).Score = null;
  (result as Record<string, unknown>).Rank = null; (result as Record<string, unknown>).TotalPoints = null;
  const summary = await fetchAquaticsEvent({ eventId: ID }, simpleFetch(data));
  assert.equal(summary.rounds[0].difficulty, undefined); assert.equal(summary.rounds[0].judgeScores, undefined);
  assert.equal(summary.event.competitors[0].rank, undefined); assert.equal(summary.event.competitors[0].score, undefined);
});

test('Swimming times and cumulative splits remain strings with no invented diving fields', async () => {
  const data = { Id: ID2, SportCode: 'SW', EventName: 'World Aquatics Championships - Singapore 2025', DisciplineName: "Women's 50m Freestyle", Heats: [
    { Name: 'Finals', Date: '2025-08-03', UtcDateTime: '2025-08-03T11:23:54', ResultStatus: 'OFFICIAL', Results: [{ FullName: 'HARRIS Meg', NAT: 'AUS', Rank: 1, Time: '24.02', Splits: [{ Order: 1, Distance: '50m', Time: '24.02' }] }] },
  ] };
  const result = await fetchAquaticsEvent({ eventId: `wa-${ID2}-h0` }, simpleFetch(data));
  assert.equal(result.event.sport, 'swimming'); assert.equal(result.event.competitors[0].score, '24.02');
  assert.equal(result.rounds[0].score, '24.02'); assert.equal(result.rounds[0].actionCode, '50m');
  assert.equal(result.rounds[0].difficulty, undefined); assert.equal(result.rounds[0].judgeScores, undefined);
});

test('A fetched archive and stale IsLive flag cannot become a live event', async () => {
  const data = event() as ReturnType<typeof event> & { IsLive?: boolean }; data.IsLive = true;
  assert.equal((await fetchAquaticsEvent({ eventId: ID }, simpleFetch(data))).event.status, 'final');
  data.Heats[0].ResultStatus = 'PROVISIONAL';
  const result = await fetchAquaticsEvent({ eventId: ID }, simpleFetch(data));
  assert.equal(result.event.status, 'unknown'); assert.equal(result.event.dataMode, 'lookup');
});

test('Search uses fresh date-window catalog and official schedule; no wrong-day semifinal', async () => {
  const urls: string[] = [];
  const result = await findAquaticsEvents({ sport: 'diving', date: '2024-08-09', query: 'CHEN Yiwen 76.50' }, async (url) => {
    urls.push(String(url));
    if (String(url).includes('/competitions?')) { const params = new URL(String(url)).searchParams; assert.equal(params.get('disciplines'), 'DV'); assert.equal(params.get('venueDateFrom'), '2024-08-09T00:00:00+00:00'); return response(catalog()); }
    if (String(url).endsWith('/schedule')) return response(schedule());
    return response(event());
  });
  assert.equal(urls.length, 3); assert.equal(result.events.length, 1); assert.equal(result.limited, false);
  assert.equal(result.events[0].id, `wa-${ID}-h0`); assert.equal(result.events[0].competitors[0].name, 'CHEN Yiwen');
});

test('Empty days return no events and never substitute Paris or another historical fixture', async () => {
  const result = await findAquaticsEvents({ sport: 'swimming', date: '2026-10-15' }, simpleFetch({ content: [], pageInfo: { numPages: 1 } }));
  assert.deepEqual(result.events, []); assert.equal(result.limited, false); assert.equal(result.sources.length, 1);
});

test('Bounded search uses at most six upstream calls and explicitly marks omitted disciplines', async () => {
  let calls = 0;
  const scheduleData = [ID, ID2, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'].map((id) => ({ ...schedule()[0], DisciplineId: id }));
  const result = await findAquaticsEvents({ sport: 'diving', date: '2024-08-09' }, async (url) => {
    calls++;
    if (String(url).includes('/competitions?')) return response(catalog([2943, 4725, 3]));
    if (String(url).endsWith('/schedule')) return response(scheduleData);
    const id = String(url).split('/').at(-1)!; return response({ ...event(), Id: id });
  });
  assert.equal(calls, 6); assert.equal(result.limited, true);
});

test('Cache preserves original fetchedAt and isolates each returned normalized record', async () => {
  resetAquaticsCache(); let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return response(event()); };
  const a = await fetchAquaticsEvent({ eventId: ID }, fetcher); a.event.competitors[0].score = '999'; a.rounds[0].judgeScores![0] = 0;
  const b = await fetchAquaticsEvent({ eventId: ID }, fetcher);
  assert.equal(calls, 1); assert.equal(a.fetchedAt, b.fetchedAt); assert.equal(b.event.competitors[0].score, '376.00'); assert.equal(b.rounds[0].judgeScores![0], 8.5);
});

test('Redirects, oversized and malformed JSON are rejected without following other hosts', async () => {
  for (const fetcher of [
    async () => new Response('', { status: 302, headers: { location: 'https://evil.test/' } }),
    async () => new Response('{}', { headers: { 'content-length': '5000000' } }),
    async () => new Response('{bad'),
    async () => response({ Heats: [] }),
    async () => response({ ...event(), Id: ID2 }),
  ] as typeof fetch[]) await assert.rejects(fetchAquaticsEvent({ eventId: ID }, fetcher), AquaticsProviderError);
});

test('A failed secondary schedule yields limited coverage, not a silent preset', async () => {
  const result = await findAquaticsEvents({ sport: 'diving', date: '2024-08-09' }, async (url) => {
    if (String(url).includes('/competitions?')) return response(catalog([2943, 4725]));
    if (String(url).endsWith('/4725/schedule')) return new Response('', { status: 503 });
    if (String(url).endsWith('/schedule')) return response(schedule());
    return response(event());
  });
  assert.equal(result.limited, true); assert.equal(result.events.length, 1);
});
