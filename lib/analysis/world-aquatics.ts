import type { AnalysisSource } from './types';
import type { EventCompetitor, IndividualEvent, IndividualRound, IndividualSearch, IndividualSummary } from './individual-types';

/** Public results used by worldaquatics.com. No live delivery guarantee is implied. */
const BASE = 'https://api.worldaquatics.com/fina';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_RE = new RegExp(`^${UUID}$`, 'i');
const EVENT_RE = new RegExp(`^(?:wa-)?(${UUID})(?:-h(\\d{1,3}))?$`, 'i');
const MAX_BYTES = 4 * 1024 * 1024;
const CACHE_MS = 30_000;
type JsonObject = Record<string, unknown>;
type CacheEntry = { expiresAt: number; data: unknown; fetchedAt: string };
let caches = new WeakMap<typeof fetch, Map<string, CacheEntry>>();

export type AquaticsErrorCode = 'INVALID_INPUT' | 'UPSTREAM_HTTP' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_INVALID' | 'NOT_FOUND';
export class AquaticsProviderError extends Error {
  constructor(public readonly code: AquaticsErrorCode, message: string, public readonly upstreamStatus?: number) {
    super(message); this.name = 'AquaticsProviderError';
  }
}
export function resetAquaticsCache(): void { caches = new WeakMap(); }
function obj(value: unknown): JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}; }
function arr(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function str(value: unknown, max = 300): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  return String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max) || undefined;
}
function num(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined || (typeof value !== 'number' && typeof value !== 'string')) return undefined;
  const result = Number(value); return Number.isFinite(result) ? result : undefined;
}
function positiveInt(value: unknown): number | undefined { const n = num(value); return n !== undefined && Number.isInteger(n) && n > 0 ? n : undefined; }
function validDate(date: unknown): date is string {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}
function utc(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return undefined;
  const zoned = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  return Number.isFinite(Date.parse(zoned)) ? new Date(zoned).toISOString() : undefined;
}
function source(url: string, fetchedAt: string): AnalysisSource {
  const key = url.slice(BASE.length).replace(/[^a-zA-Z0-9-]+/g, '-').slice(0, 150);
  return { id: `worldaquatics${key}`, label: 'World Aquatics official public results', url, fetchedAt };
}
async function read(url: string, fetcher: typeof fetch, bypassCache = false): Promise<{ data: unknown; fetchedAt: string }> {
  let cache = caches.get(fetcher);
  if (!cache) { cache = new Map(); caches.set(fetcher, cache); }
  const stored = cache.get(url);
  if (!bypassCache && stored && stored.expiresAt > Date.now()) return structuredClone(stored);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 10_000);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json' }, redirect: 'manual', signal: controller.signal });
    if (!response.ok) throw new AquaticsProviderError('UPSTREAM_HTTP', 'World Aquatics could not return this record.', response.status);
    if (Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) throw new AquaticsProviderError('UPSTREAM_INVALID', 'World Aquatics returned an oversized or empty record.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) { await reader.cancel(); throw new AquaticsProviderError('UPSTREAM_INVALID', 'World Aquatics record exceeded the size limit.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let data: unknown;
    try { data = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new AquaticsProviderError('UPSTREAM_INVALID', 'World Aquatics returned invalid JSON.'); }
    if (data === null || typeof data !== 'object') throw new AquaticsProviderError('UPSTREAM_INVALID', 'World Aquatics returned an invalid record.');
    const fetchedAt = new Date().toISOString();
    if (total <= 512 * 1024) {
      if (cache.size >= 12) cache.delete(cache.keys().next().value!);
      cache.set(url, { data: structuredClone(data), fetchedAt, expiresAt: Date.now() + CACHE_MS });
    }
    return { data, fetchedAt };
  } catch (error) {
    if (error instanceof AquaticsProviderError) throw error;
    if (timedOut || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))) throw new AquaticsProviderError('UPSTREAM_TIMEOUT', 'World Aquatics did not respond in time.');
    throw new AquaticsProviderError('UPSTREAM_HTTP', 'World Aquatics could not be reached.');
  } finally { clearTimeout(timer); }
}
function parseId(eventId: string): { uuid: string; heatIndex: number } {
  const match = typeof eventId === 'string' && eventId.length <= 64 ? EVENT_RE.exec(eventId) : null;
  if (!match) throw new AquaticsProviderError('INVALID_INPUT', 'A valid World Aquatics discipline ID and heat index are required.');
  return { uuid: match[1].toLowerCase(), heatIndex: Number(match[2] ?? 0) };
}
function athlete(result: JsonObject, index: number): EventCompetitor | undefined {
  const members = arr(result.Competitors).map((member) => str(obj(member).FullName)).filter(Boolean);
  const name = str(result.FullName) ?? (members.length ? members.join(' / ') : undefined);
  if (!name) return undefined;
  const athleteId = str(result.PersonId, 64);
  const id = athleteId ?? str(result.ResultId, 64) ?? `competitor-${index + 1}`;
  return { id, name, country: str(result.NAT, 5), rank: positiveInt(result.Rank), score: str(result.TotalPoints ?? result.Time, 60), athleteId };
}
function heatEvent(data: JsonObject, uuid: string, heatIndex: number, asOf = Date.now()): IndividualEvent {
  const heat = obj(arr(data.Heats)[heatIndex]);
  if (!Object.keys(heat).length) throw new AquaticsProviderError('NOT_FOUND', 'The requested World Aquatics phase is not available.');
  const code = str(heat.SportCode ?? data.SportCode);
  const sport = code === 'DV' ? 'diving' : code === 'SW' ? 'swimming' : undefined;
  if (!sport) throw new AquaticsProviderError('UPSTREAM_INVALID', 'This record is not a supported swimming or diving event.');
  // The discipline-level result date belongs to the last phase; never reuse it for earlier heats.
  const date = utc(heat.UtcDateTime) ?? utc(heat.EndUtcDateTime);
  if (!date) throw new AquaticsProviderError('UPSTREAM_INVALID', 'This phase has no valid UTC result timestamp.');
  const competitors = arr(heat.Results).slice(0, 200).map((item, index) => athlete(obj(item), index)).filter((item): item is EventCompetitor => !!item);
  const phase = str(heat.Name ?? heat.PhaseName) ?? 'Phase';
  const official = heat.ResultStatus === 'OFFICIAL';
  const elapsed = asOf - Date.parse(date);
  const live = heat.ResultStatus === 'LIVE' && heat.IsSummary !== true && !/summary/i.test(`${phase} ${str(heat.PhaseName) ?? ''}`) && elapsed >= 0 && elapsed <= 18 * 60 * 60 * 1000;
  // A start list contains athlete names but no results. Its existence is never live evidence.
  const scheduled = heat.ResultStatus === 'START_LIST' && Date.parse(date) > asOf;
  const status = official ? 'final' : live ? 'live' : scheduled ? 'scheduled' : 'unknown';
  return {
    id: `wa-${uuid}-h${heatIndex}`, league: 'worldaquatics', provider: 'worldaquatics', sport,
    name: [str(data.EventOfficialName ?? data.EventName), str(data.DisciplineName), phase].filter(Boolean).join(' · '),
    date, status, statusDetail: official ? `${phase} — official result (historical)` : live ? `${phase} — source reports LIVE; pictured action unconfirmed` : scheduled ? `${phase} — published start list; not started according to this record` : `${phase} — public lookup; live status unverified`,
    phase, dataMode: official ? 'historical' : 'lookup', teams: [], competitors,
  };
}

/** Internal discovery adapter; asOf is server-owned/test context and is not an image-analysis input. */
export async function fetchAquaticsPhases(input: { disciplineId: string; asOf?: string }, fetcher: typeof fetch = fetch): Promise<IndividualSearch> {
  if (typeof input.disciplineId !== 'string' || !UUID_RE.test(input.disciplineId)) throw new AquaticsProviderError('INVALID_INPUT', 'A valid World Aquatics discipline UUID is required.');
  const asOf = input.asOf === undefined ? Date.now() : Date.parse(input.asOf);
  if (!Number.isFinite(asOf)) throw new AquaticsProviderError('INVALID_INPUT', 'A valid internal discovery timestamp is required.');
  const uuid = input.disciplineId.toLowerCase(), url = `${BASE}/events/${uuid}`;
  const record = await read(url, fetcher), data = obj(record.data);
  if (!Array.isArray(data.Heats) || typeof data.Id === 'string' && data.Id.toLowerCase() !== uuid) throw new AquaticsProviderError('UPSTREAM_INVALID', 'World Aquatics returned an invalid discipline record.');
  let limited = data.Heats.length > 100;
  const events: IndividualEvent[] = [];
  for (let i = 0; i < Math.min(data.Heats.length, 100); i++) {
    const heat = obj(data.Heats[i]);
    if (heat.IsSummary === true || /summary/i.test(`${str(heat.Name) ?? ''} ${str(heat.PhaseName) ?? ''}`)) continue;
    try { events.push(heatEvent(data, uuid, i, asOf)); }
    catch { limited = true; }
  }
  return { events, sources: [source(url, record.fetchedAt)], limited };
}
function roundsFor(data: JsonObject, heatIndex: number, competitors: EventCompetitor[]): IndividualRound[] {
  const heat = obj(arr(data.Heats)[heatIndex]);
  const rounds: IndividualRound[] = [];
  for (const [index, item] of arr(heat.Results).slice(0, 200).entries()) {
    const result = obj(item), competitor = athlete(result, index);
    if (!competitor || !competitors.some((entry) => entry.id === competitor.id)) continue;
    const dives = arr(result.Dives);
    if (dives.length) {
      for (const [diveIndex, raw] of dives.slice(0, 20).entries()) {
        const dive = obj(raw), score = str(dive.DivePoints, 60);
        if (!score) continue;
        const difficulty = num(dive.DD);
        const rawJudges = arr(dive.JudgesScores);
        const judges = rawJudges.map((judge) => num(obj(judge).Score));
        // Missing/invalid judges are absent, never zero-filled or partially presented as a full panel.
        const judgeScores = judges.length && judges.every((n) => n !== undefined && n >= 0 && n <= 10) ? judges as number[] : undefined;
        rounds.push({ athleteId: competitor.id, athleteName: competitor.name, country: competitor.country,
          round: positiveInt(dive.DiveOrder) ?? diveIndex + 1, score, total: str(dive.TotalPoints, 60),
          difficulty: difficulty !== undefined && difficulty > 0 && difficulty <= 10 ? difficulty : undefined,
          judgeScores, actionCode: str(dive.DiveNo, 30) });
      }
    } else {
      for (const [splitIndex, raw] of arr(result.Splits).slice(0, 100).entries()) {
        const split = obj(raw), score = str(split.Time, 60); if (!score) continue;
        rounds.push({ athleteId: competitor.id, athleteName: competitor.name, country: competitor.country,
          round: positiveInt(split.Order) ?? splitIndex + 1, score, total: str(result.Time, 60), actionCode: str(split.Distance, 30) });
      }
    }
  }
  return rounds;
}

export async function fetchAquaticsEvent(input: { eventId: string; fresh?: boolean }, fetcher: typeof fetch = fetch): Promise<IndividualSummary> {
  if (input.fresh !== undefined && typeof input.fresh !== 'boolean') throw new AquaticsProviderError('INVALID_INPUT', 'Fresh lookup must be a boolean.');
  const { uuid, heatIndex } = parseId(input.eventId);
  const url = `${BASE}/events/${uuid}`;
  const record = await read(url, fetcher, input.fresh === true), data = obj(record.data);
  if (!Array.isArray(data.Heats)) throw new AquaticsProviderError('UPSTREAM_INVALID', 'World Aquatics event phases are missing.');
  if (typeof data.Id === 'string' && data.Id.toLowerCase() !== uuid) throw new AquaticsProviderError('UPSTREAM_INVALID', 'World Aquatics returned a different discipline.');
  const event = heatEvent(data, uuid, heatIndex);
  return { event, fetchedAt: record.fetchedAt, sources: [source(url, record.fetchedAt)],
    rounds: roundsFor(data, heatIndex, event.competitors), limitations: [
      'Official public results lookup; no guaranteed live coverage or update interval.',
      'A result timestamp identifies the phase record, not the exact action visible in a photo.',
      ...(event.sport === 'diving' ? ['Recorded judge scores do not establish the reason for a deduction.'] : []),
    ] };
}
function searchText(value: string): string {
  return value.toLowerCase().replace(/女子|女性/g, ' women ').replace(/男子|男性/g, ' men ').replace(/自由泳/g, ' freestyle ').replace(/仰泳/g, ' backstroke ').replace(/蛙泳/g, ' breaststroke ').replace(/蝶泳/g, ' butterfly ').replace(/跳板/g, ' springboard ').replace(/跳台/g, ' platform ').replace(/半决赛/g, ' semifinals ').replace(/决赛/g, ' finals ').replace(/米/g, 'm').replace(/[^a-z0-9]+/g, ' ').replace(/(\d+)\s+m\b/g, '$1m').trim();
}
function relevance(query: string, value: string): number {
  const tokens = searchText(query).split(' ').filter((token) => token.length > 1);
  const haystack = ` ${searchText(value)} `;
  return tokens.reduce((sum, token) => sum + (haystack.includes(` ${token} `) ? 1 : 0), 0);
}
/** A bounded, fresh public lookup: at most six upstream requests, without a preset fallback. */
export async function findAquaticsEvents(input: { sport: 'diving' | 'swimming'; date: string; query?: string }, fetcher: typeof fetch = fetch): Promise<IndividualSearch> {
  if (!['diving', 'swimming'].includes(input.sport) || !validDate(input.date) || (input.query !== undefined && (typeof input.query !== 'string' || input.query.length > 1000))) throw new AquaticsProviderError('INVALID_INPUT', 'Choose diving/swimming and a valid YYYY-MM-DD date.');
  const code = input.sport === 'diving' ? 'DV' : 'SW';
  const nextDate = new Date(Date.parse(`${input.date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const params = new URLSearchParams({ pageSize: '100', page: '0', venueDateFrom: `${input.date}T00:00:00+00:00`, venueDateTo: `${nextDate}T00:00:00+00:00`, disciplines: code, sort: 'dateFrom,asc' });
  const url = `${BASE}/competitions?${params}`;
  const catalog = await read(url, fetcher), catalogData = obj(catalog.data);
  if (!Array.isArray(catalogData.content)) throw new AquaticsProviderError('UPSTREAM_INVALID', 'World Aquatics competition catalog is missing.');
  const sources = [source(url, catalog.fetchedAt)], query = input.query ?? '';
  const competitions = arr(catalogData.content).map(obj).filter((item) => {
    const from = str(item.venueDateFrom ?? item.dateFrom)?.slice(0, 10), to = str(item.venueDateTo ?? item.dateTo)?.slice(0, 10);
    return positiveInt(item.id) && from && to && from <= input.date && to >= input.date && arr(item.disciplines).includes(code);
  }).sort((a, b) => {
    const weight = (item: JsonObject) => relevance(query, `${item.name} ${obj(item.location).city}`) * 20 + (/Olympic Games/i.test(String(item.name)) ? 15 : /World Aquatics Championships/i.test(String(item.name)) ? 12 : /World Cup/i.test(String(item.name)) ? 8 : 0);
    return weight(b) - weight(a);
  });
  let limited = Number(obj(catalogData.pageInfo).numPages) > 1 || competitions.length > 2;
  const schedules = new Map<string, { id: string; text: string; priority: number }>();
  const scheduleResults = await Promise.allSettled(competitions.slice(0, 2).map(async (competition) => {
    const scheduleUrl = `${BASE}/competitions/${positiveInt(competition.id)!}/schedule`;
    return { competition, scheduleUrl, record: await read(scheduleUrl, fetcher) };
  }));
  for (const result of scheduleResults) {
    if (result.status === 'rejected') { limited = true; continue; }
    const { competition, scheduleUrl, record } = result.value;
    if (!Array.isArray(record.data)) { limited = true; continue; }
    sources.push(source(scheduleUrl, record.fetchedAt));
    for (const item of record.data.slice(0, 1000).map(obj)) {
        const id = str(item.DisciplineId, 36), date = str(item.Date)?.slice(0, 10), utcDate = utc(item.UtcDateTime)?.slice(0, 10);
        if (!id || !UUID_RE.test(id) || item.SportCode !== code || (date !== input.date && utcDate !== input.date)) continue;
        const text = `${competition.name} ${item.DisciplineName} ${item.Name} ${item.PhaseName}`;
        const priority = relevance(query, text) * 20 + (/^Finals?$/i.test(String(item.PhaseName)) ? 5 : 0);
        const previous = schedules.get(id);
        if (!previous || priority > previous.priority) schedules.set(id, { id, text, priority });
    }
  }
  const remaining = 5 - Math.min(competitions.length, 2);
  const ordered = [...schedules.values()].sort((a, b) => b.priority - a.priority);
  if (ordered.length > remaining) limited = true;
  const events: IndividualEvent[] = [];
  const eventResults = await Promise.allSettled(ordered.slice(0, remaining).map(async (item) => {
    const eventUrl = `${BASE}/events/${item.id}`;
    return { item, eventUrl, record: await read(eventUrl, fetcher) };
  }));
  for (const result of eventResults) {
    if (result.status === 'rejected') { limited = true; continue; }
    const { item, eventUrl, record } = result.value, data = obj(record.data);
    try {
      if (!Array.isArray(data.Heats)) { limited = true; continue; }
      if (typeof data.Id === 'string' && data.Id.toLowerCase() !== item.id.toLowerCase()) { limited = true; continue; }
      sources.push(source(eventUrl, record.fetchedAt));
      for (let index = 0; index < Math.min(data.Heats.length, 100); index++) {
        const heat = obj(data.Heats[index]), date = str(heat.Date)?.slice(0, 10), utcDate = utc(heat.UtcDateTime)?.slice(0, 10);
        if (heat.IsSummary === true) continue;
        if (date !== input.date && utcDate !== input.date) continue;
        try { const event = heatEvent(data, item.id.toLowerCase(), index); if (event.sport === input.sport) events.push(event); }
        catch { limited = true; }
      }
    } catch { limited = true; }
  }
  const sorted = events.sort((a, b) => relevance(query, `${b.name} ${b.competitors.map((c) => c.name).join(' ')}`) - relevance(query, `${a.name} ${a.competitors.map((c) => c.name).join(' ')}`));
  return { events: sorted.slice(0, 40), sources, limited: limited || sorted.length > 40 };
}
