import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverCurrentAquatics, resetCurrentAquaticsCache } from '../lib/analysis/current-aquatics';
import { AquaticsProviderError, fetchAquaticsEvent, resetAquaticsCache } from '../lib/analysis/world-aquatics';

const ID = 'f9b3fca8-8dde-47b3-be64-4a0ef9eba887';
const AS_OF = '2026-10-15T09:53:00Z';
function json(value: unknown, init?: ResponseInit) { return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' }, ...init }); }

// A real subset fetched from the official /fina/results/live endpoint on 2026-10-15.
// Planned finals contain athlete names, which must not turn the start list into live results.
function astanaStrip() {
  return { pageInfo: { page: 0, numPages: 1, pageSize: 1, numEntries: 1 }, content: [{
    id: 5199, providerId: 'daad9c29-9c31-4c97-a1f7-d17eb839da2a', officialName: 'World Aquatics Swimming World Cup 2026',
    venueDateFrom: '2026-10-15T00:00:00Z', venueDateTo: '2026-10-17T00:00:00Z',
    location: { countryCode: 'KAZ', countryName: 'Kazakhstan', city: 'Astana' }, disciplines: ['SW'],
    schedule: [{ name: 'Heat 1', date: '2026-10-15', utcDateTime: '2026-10-15T05:09:00', disciplineName: "Men's 100m Freestyle", phaseName: 'Heats', resultStatus: 'OFFICIAL', disciplineId: ID, sportCode: 'SW' },
      { name: 'Final', date: '2026-10-15', utcDateTime: '2026-10-15T13:12:00', disciplineName: "Men's 100m Freestyle", phaseName: 'Finals', resultStatus: 'START_LIST', disciplineId: ID, sportCode: 'SW' }],
  }] };
}
function astanaDiscipline() {
  return { Id: ID, EventName: 'World Aquatics Swimming World Cup 2026', DisciplineName: "Men's 100m Freestyle", SportCode: 'SW', LastChange: '0001-01-01T00:00:00', Heats: [
    { Name: 'Final', SportCode: 'SW', UtcDateTime: '2026-10-15T13:12:00', ResultStatus: 'START_LIST', Results: [{ FullName: 'ZHIDKOV Roman', FirstName: 'Roman', LastName: 'ZHIDKOV', NAT: 'RUS', ResultId: 'R1690832' }] },
    { Name: 'Heats Summary', SportCode: 'SW', UtcDateTime: '2026-10-15T05:09:00', ResultStatus: 'OFFICIAL', IsSummary: true, Results: [] },
    { Name: 'Heat 1', SportCode: 'SW', UtcDateTime: '2026-10-15T05:09:00', ResultStatus: 'OFFICIAL', Results: [{ FullName: 'BALTEMIR Mansur', FirstName: 'Mansur', LastName: 'BALTEMIR', NAT: 'KAZ', Time: '50.14', ResultId: 'R1921665' }] },
  ] };
}
function currentStrip(status = 'LIVE', start = '2026-10-15T09:30:00') {
  const data = astanaStrip(); data.content[0].schedule = [{ ...data.content[0].schedule[0], resultStatus: status, utcDateTime: start }]; return data;
}
function currentDiscipline(status = 'LIVE', start = '2026-10-15T09:30:00') {
  const data = astanaDiscipline(); data.Heats = [{ ...data.Heats[2], UtcDateTime: start, ResultStatus: status }]; return data;
}
function upstream(strip: unknown, phase: unknown) {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); calls.push(url);
    assert.equal(new URL(url).origin, 'https://api.worldaquatics.com'); assert.equal(init?.redirect, 'manual'); assert.ok(init?.signal instanceof AbortSignal);
    return json(url.includes('/results/live?') ? strip : phase);
  };
  return { fetcher, calls };
}

test('real official Astana strip subset yields completed heats and future start lists, with no active race', async () => {
  const { fetcher, calls } = upstream(astanaStrip(), astanaDiscipline());
  const result = await discoverCurrentAquatics({ sport: 'swimming', asOf: AS_OF }, fetcher);
  assert.deepEqual(result.events, []); assert.equal(result.schedule.length, 2); assert.equal(calls.length, 2);
  assert.equal(result.schedule.find(e => e.id.endsWith('-h0'))?.status, 'scheduled');
  assert.equal(result.schedule.find(e => e.id.endsWith('-h2'))?.status, 'final');
  assert.equal(result.schedule.find(e => e.id.endsWith('-h0'))?.competitors[0].score, undefined);
  assert.equal(result.limited, false); assert.equal(result.sources.length, 2);
  assert.equal(new URL(calls[0]).searchParams.get('venueDateFrom'), '2026-10-14T00:00:00Z');
  assert.equal(new URL(calls[0]).searchParams.get('venueDateTo'), '2026-10-16T23:59:00Z');
});

test('only a recent explicit non-summary phase LIVE becomes an active candidate', async () => {
  const { fetcher } = upstream(currentStrip(), currentDiscipline());
  const result = await discoverCurrentAquatics({ sport: 'swimming', asOf: AS_OF }, fetcher);
  assert.equal(result.events.length, 1); assert.equal(result.events[0].status, 'live');
  assert.equal(result.events[0].dataMode, 'lookup'); assert.equal(result.events[0].id, `wa-${ID}-h0`);
  assert.deepEqual(result.schedule, []); assert.match(result.events[0].statusDetail!, /pictured action unconfirmed/);
});

test('competition IsLive, an elapsed start list and UNOFFICIAL marks cannot establish in-progress status', async () => {
  for (const status of ['START_LIST', 'UNOFFICIAL', '']) {
    const strip = currentStrip(status), phase = currentDiscipline(status);
    (strip.content[0] as Record<string, unknown>).IsLive = true;
    const { fetcher } = upstream(strip, phase);
    const result = await discoverCurrentAquatics({ sport: 'swimming', asOf: AS_OF }, fetcher);
    assert.deepEqual(result.events, []); assert.equal(result.schedule[0].status, 'unknown');
  }
});

test('the fresh phase response overrides stale strip LIVE, and official results are historical', async () => {
  for (const status of ['OFFICIAL', 'START_LIST']) {
    const { fetcher } = upstream(currentStrip(), currentDiscipline(status));
    const result = await discoverCurrentAquatics({ sport: 'swimming', asOf: AS_OF }, fetcher);
    assert.deepEqual(result.events, []); assert.equal(result.schedule[0].status, status === 'OFFICIAL' ? 'final' : 'unknown');
    if (status === 'OFFICIAL') assert.equal(result.schedule[0].dataMode, 'historical');
  }
});

test('stale, future and aggregate-summary LIVE labels do not produce active phases', async () => {
  for (const [time, summary] of [['2026-10-14T13:00:00', false], ['2026-10-15T10:00:00', false], ['2026-10-15T09:30:00', true]] as const) {
    const phase = currentDiscipline('LIVE', time); phase.Heats[0].IsSummary = summary;
    const { fetcher } = upstream(currentStrip('LIVE', '2026-10-15T09:30:00'), phase);
    const result = await discoverCurrentAquatics({ sport: 'swimming', asOf: AS_OF }, fetcher);
    assert.equal(result.events.length, 0);
  }
  const summary = currentDiscipline(); summary.Heats[0].Name = 'Heats Summary';
  assert.equal((await discoverCurrentAquatics({ sport: 'swimming', asOf: AS_OF }, upstream(currentStrip(), summary).fetcher)).events.length, 0);
});

test('explicit nested heat LIVE is discoverable across UTC midnight while unrelated sports are excluded', async () => {
  const strip = currentStrip('OFFICIAL', '2026-10-14T23:45:00');
  (strip.content[0].schedule[0] as Record<string, unknown>).events = { Heats: [{ Name: 'Heat 1', ResultStatus: 'LIVE', UtcDateTime: '2026-10-14T23:45:00' }] };
  const { fetcher } = upstream(strip, currentDiscipline('LIVE', '2026-10-14T23:45:00'));
  assert.equal((await discoverCurrentAquatics({ sport: 'swimming', asOf: '2026-10-15T00:10:00Z' }, fetcher)).events.length, 1);
  assert.equal((await discoverCurrentAquatics({ sport: 'diving', asOf: AS_OF }, fetcher)).events.length, 0);
});

test('bounded discovery prioritizes LIVE, deduplicates disciplines and labels omitted schedules', async () => {
  const strip = astanaStrip(); strip.content[0].schedule = Array.from({ length: 6 }, (_, i) => ({ ...strip.content[0].schedule[0], disciplineId: `00000000-0000-0000-0000-00000000000${i}`, resultStatus: i === 5 ? 'LIVE' : 'START_LIST', utcDateTime: i === 5 ? '2026-10-15T09:30:00' : '2026-10-15T13:00:00' }));
  strip.content[0].schedule.push({ ...strip.content[0].schedule[5] });
  const calls: string[] = [];
  const result = await discoverCurrentAquatics({ sport: 'swimming', asOf: AS_OF }, async (url) => {
    calls.push(String(url));
    return json(String(url).includes('/results/live?') ? strip : { ...currentDiscipline(), Id: String(url).split('/').at(-1) });
  });
  assert.equal(calls.length, 5); assert.equal(result.limited, true); assert.ok(calls.some(u => u.endsWith('00000000-0000-0000-0000-000000000005')));
});

test('empty current feed and failed detail requests never acquire archived or invented live events', async () => {
  const empty = await discoverCurrentAquatics({ sport: 'diving', asOf: AS_OF }, async () => json({ pageInfo: { numPages: 0 }, content: [] }));
  assert.deepEqual(empty.events, []); assert.deepEqual(empty.schedule, []); assert.equal(empty.limited, false);
  assert.notEqual(empty.failed, true);
  const partial = await discoverCurrentAquatics({ sport: 'swimming', asOf: AS_OF }, async (url) => String(url).includes('/results/live?') ? json(currentStrip()) : new Response('', { status: 503 }));
  assert.deepEqual(partial.events, []); assert.deepEqual(partial.schedule, []); assert.equal(partial.limited, true); assert.equal(partial.failed, true);
});

test('one failed phase remains distinguishable when another live phase succeeds', async () => {
  const other = '00000000-0000-0000-0000-000000000001', strip = currentStrip();
  strip.content[0].schedule.push({ ...strip.content[0].schedule[0], disciplineId: other });
  const result = await discoverCurrentAquatics({ sport: 'swimming', asOf: AS_OF }, async (url) => {
    if (String(url).includes('/results/live?')) return json(strip);
    return String(url).endsWith(other) ? new Response('', { status: 503 }) : json(currentDiscipline());
  });
  assert.equal(result.events.length, 1); assert.equal(result.failed, true); assert.equal(result.limited, true);
});

test('current-feed cache retains original lookup timestamps and callers cannot mutate later responses', async () => {
  resetCurrentAquaticsCache(); resetAquaticsCache();
  const { fetcher, calls } = upstream(currentStrip(), currentDiscipline());
  const a = await discoverCurrentAquatics({ sport: 'swimming', asOf: AS_OF }, fetcher);
  a.events[0].name = 'corrupted'; a.sources[0].fetchedAt = 'fake';
  const b = await discoverCurrentAquatics({ sport: 'swimming', asOf: AS_OF }, fetcher);
  assert.equal(calls.length, 2); assert.notEqual(b.events[0].name, 'corrupted'); assert.notEqual(b.sources[0].fetchedAt, 'fake');
  assert.equal(a.sources[1].fetchedAt, b.sources[1].fetchedAt);
});

test('input validation rejects arbitrary URLs, impossible dates and oversized query text before fetching', async () => {
  let calls = 0; const fetcher: typeof fetch = async () => { calls++; return json({}); };
  for (const input of [{ sport: 'https://evil.test' }, { sport: 'swimming', asOf: '2025-02-29T00:00:00Z' }, { sport: 'swimming', asOf: 'not-a-time' }, { sport: 'diving', query: 'x'.repeat(1001) }] as Array<{ sport: 'diving' | 'swimming'; asOf?: string; query?: string }>) {
    await assert.rejects(discoverCurrentAquatics(input, fetcher), (e) => e instanceof AquaticsProviderError && e.code === 'INVALID_INPUT');
  }
  assert.equal(calls, 0);
});

test('redirects, malformed JSON and oversized live-feed payloads produce typed, body-free failures', async () => {
  for (const fetcher of [
    async () => new Response('', { status: 302, headers: { location: 'https://evil.test/' } }),
    async () => new Response('{bad'),
    async () => json({ unexpected: [] }),
    async () => new Response('{}', { headers: { 'content-length': '5000000' } }),
    async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1)); controller.close(); } })),
    async () => { throw new DOMException('untrusted response detail', 'AbortError'); },
  ] as typeof fetch[]) await assert.rejects(discoverCurrentAquatics({ sport: 'swimming', asOf: AS_OF }, fetcher), (e) => e instanceof AquaticsProviderError && !e.message.includes('untrusted'));
});

test('summary refresh can change explicit recent LIVE to final or unknown without retaining live state', async () => {
  const time = new Date(Date.now() - 60_000).toISOString();
  let status = 'LIVE', calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return json(currentDiscipline(status, time)); };
  resetAquaticsCache(); assert.equal((await fetchAquaticsEvent({ eventId: `wa-${ID}-h0` }, fetcher)).event.status, 'live');
  status = 'OFFICIAL'; assert.equal((await fetchAquaticsEvent({ eventId: `wa-${ID}-h0` }, fetcher)).event.status, 'live'); assert.equal(calls, 1);
  const final = await fetchAquaticsEvent({ eventId: `wa-${ID}-h0`, fresh: true }, fetcher);
  assert.equal(final.event.status, 'final'); assert.equal(calls, 2); assert.equal(final.sources[0].fetchedAt, final.fetchedAt);
  const cached = await fetchAquaticsEvent({ eventId: `wa-${ID}-h0` }, fetcher);
  assert.equal(cached.event.status, 'final'); assert.equal(cached.fetchedAt, final.fetchedAt); assert.equal(calls, 2);
  status = 'START_LIST'; assert.equal((await fetchAquaticsEvent({ eventId: `wa-${ID}-h0`, fresh: true }, fetcher)).event.status, 'unknown'); assert.equal(calls, 3);
});
