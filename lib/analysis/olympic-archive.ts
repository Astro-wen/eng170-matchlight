import type { AnalysisSource } from './types';
import type { EventCompetitor, IndividualEvent, IndividualSearch, IndividualSport, IndividualSummary } from './individual-types';

/** This provider is a Paris 2024 archive, never a current/live Olympics feed. */
export const OLYMPIC_ARCHIVE_SPORTS = Object.freeze({
  diving: { discipline: 'DIV', name: 'Diving' },
  swimming: { discipline: 'SWM', name: 'Swimming' },
  gymnastics: { discipline: 'GAR', name: 'Artistic Gymnastics' },
  athletics: { discipline: 'ATH', name: 'Athletics' },
});
export type OlympicArchiveErrorCode = 'INVALID_INPUT' | 'UNSUPPORTED_SPORT' | 'UPSTREAM_HTTP' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_INVALID';
export class OlympicArchiveError extends Error {
  constructor(public readonly code: OlympicArchiveErrorCode, message: string, public readonly upstreamStatus?: number) {
    super(message); this.name = 'OlympicArchiveError';
  }
}

type JsonObject = Record<string, unknown>;
type CachedPage = { json: JsonObject; fetchedAt: string; expiresAt: number };
const BASE = 'https://apis.codante.io/olympic-games';
const FIRST_DAY = '2024-07-24';
const LAST_DAY = '2024-08-11';
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PAGES = 3;
const CACHE_MS = 60_000;
const MAX_CACHE_ENTRIES = 100;
const TIMEOUT_MS = 10_000;
let caches = new WeakMap<typeof fetch, Map<string, CachedPage>>();

/** Reset only this provider's in-memory cache, useful for isolated tests. */
export function resetOlympicArchiveCache(): void { caches = new WeakMap(); }

function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}
function text(value: unknown, max = 300): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  return String(value).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || undefined;
}
function calendarDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
function archiveDate(value: unknown): value is string { return calendarDate(value) && value >= FIRST_DAY && value <= LAST_DAY; }
function sportConfig(sport: IndividualSport): typeof OLYMPIC_ARCHIVE_SPORTS[IndividualSport] {
  if (!Object.prototype.hasOwnProperty.call(OLYMPIC_ARCHIVE_SPORTS, sport)) {
    throw new OlympicArchiveError('UNSUPPORTED_SPORT', 'This sport is not available in the configured Paris 2024 archive.');
  }
  return OLYMPIC_ARCHIVE_SPORTS[sport];
}
function positiveInteger(value: unknown, max = 999_999_999): number | undefined {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^[1-9]\d*$/.test(String(value))) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= max ? number : undefined;
}
function eventNumber(value: string): string {
  if (typeof value !== 'string' || !/^(?:paris-)?[1-9]\d{0,8}$/.test(value)) {
    throw new OlympicArchiveError('INVALID_INPUT', 'A valid Paris 2024 archive event ID is required.');
  }
  return value.replace(/^paris-/, '');
}
function iso(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
    && Number.isFinite(Date.parse(value)) ? value : undefined;
}
function normalizeSearch(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function country(competitor: JsonObject): string | undefined {
  // country_id is often a Portuguese country name; never interpret its first letters as an IOC code.
  const direct = competitor.country_id;
  if (typeof direct === 'string' && /^[A-Z]{3}$/.test(direct) && direct !== 'EUA') return direct;
  if (typeof competitor.country_flag_url !== 'string') return undefined;
  try {
    const url = new URL(competitor.country_flag_url);
    if (url.protocol !== 'https:' || url.hostname !== 'codante.s3.amazonaws.com' || url.username || url.password || url.search || url.hash) return undefined;
    return /^\/codante-apis\/olympic-games\/flags\/([A-Z]{3})\.png$/.exec(url.pathname)?.[1];
  } catch { return undefined; }
}
function competitor(value: unknown, id: string, index: number, sport: IndividualSport): EventCompetitor | undefined {
  const raw = object(value), name = text(raw.competitor_name, 160);
  if (!name) return undefined;
  // In this archive gymnastics marks can be one apparatus even for an all-around event.
  // The feed does not identify that apparatus, so these marks must not become total scores.
  const score = sport === 'gymnastics' ? undefined : text(raw.result_mark, 60);
  const rank = positiveInteger(raw.result_position, 999);
  return {
    id: `paris-${id}-participant-${index + 1}`, name,
    ...(country(raw) ? { country: country(raw) } : {}),
    ...(rank ? { rank } : {}), ...(score ? { score } : {}),
  };
}
function normalizeEvent(value: unknown, expectedSport?: IndividualSport, expectedDay?: string): IndividualEvent | undefined {
  const raw = object(value), id = positiveInteger(raw.id), day = raw.day;
  const start = iso(raw.start_date);
  const sport = (Object.keys(OLYMPIC_ARCHIVE_SPORTS) as IndividualSport[]).find((key) => raw.discipline_name === OLYMPIC_ARCHIVE_SPORTS[key].name);
  if (!id || !sport || (expectedSport && sport !== expectedSport) || !archiveDate(day)
    || (expectedDay && day !== expectedDay) || !start || start.slice(0, 10) !== day) return undefined;
  const detail = text(raw.detailed_event_name), baseName = text(raw.event_name), name = detail ?? baseName;
  if (!name || !Array.isArray(raw.competitors)) return undefined;
  const competitors = raw.competitors.slice(0, 300).flatMap((item, index) => {
    const result = competitor(item, String(id), index, sport); return result ? [result] : [];
  });
  // is_live reflects the archived 2024 feed and must never produce a live status today.
  const finished = typeof raw.status === 'string' && /^(finished|completed|final)$/i.test(raw.status.trim());
  const phase = detail?.match(/(?:Semi[- ]?finals?|Finals?|Preliminary|Qualification|Heats?|Round\s+\d+)/i)?.[0];
  return {
    id: `paris-${id}`, league: 'paris2024', sport,
    name: `Paris 2024 ${OLYMPIC_ARCHIVE_SPORTS[sport].name} — ${name}`,
    date: start, status: finished ? 'final' : 'unknown',
    statusDetail: finished ? 'Historical Paris 2024 result' : 'Historical Paris 2024 record; final status unavailable',
    teams: [], provider: 'olympic-archive', competitors, dataMode: 'historical',
    ...(phase ? { phase } : {}),
  };
}

async function readPage(url: string, fetcher: typeof fetch, validData: (data: unknown) => boolean): Promise<CachedPage> {
  let cache = caches.get(fetcher);
  if (!cache) { cache = new Map(); caches.set(fetcher, cache); }
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return structuredClone(cached);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': 'Matchlight/0.1' }, redirect: 'manual', signal: controller.signal });
    if (!response.ok) throw new OlympicArchiveError('UPSTREAM_HTTP', 'The Paris 2024 archive could not return these records.', response.status);
    if (Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) {
      throw new OlympicArchiveError('UPSTREAM_INVALID', 'The Paris 2024 archive returned an invalid response size.');
    }
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) { await reader.cancel(); throw new OlympicArchiveError('UPSTREAM_INVALID', 'The Paris 2024 archive response exceeded the size limit.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new OlympicArchiveError('UPSTREAM_INVALID', 'The Paris 2024 archive returned malformed JSON.'); }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new OlympicArchiveError('UPSTREAM_INVALID', 'The Paris 2024 archive returned an invalid response shape.');
    }
    const json = object(parsed);
    if (!validData(json.data)) {
      throw new OlympicArchiveError('UPSTREAM_INVALID', 'The Paris 2024 archive did not return event data.');
    }
    const result = { json, fetchedAt: new Date().toISOString(), expiresAt: Date.now() + CACHE_MS };
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(url, structuredClone(result)); return result;
  } catch (error) {
    if (error instanceof OlympicArchiveError) throw error;
    if (timedOut || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))) {
      throw new OlympicArchiveError('UPSTREAM_TIMEOUT', 'The Paris 2024 archive did not respond in time.');
    }
    throw new OlympicArchiveError('UPSTREAM_HTTP', 'The Paris 2024 archive could not be reached.');
  } finally { clearTimeout(timer); }
}
function source(url: string, fetchedAt: string, id: string): AnalysisSource {
  return { id: `codante-paris2024-${id}`, label: 'Codante Paris 2024 historical archive', url, fetchedAt };
}

/** Query at most three pages. Dates outside Paris 2024 return no records without a request. */
export async function findOlympicEvents(
  input: { sport: IndividualSport; date: string; query?: string }, fetcher: typeof fetch = fetch,
): Promise<IndividualSearch> {
  const config = sportConfig(input.sport);
  if (!calendarDate(input.date)) throw new OlympicArchiveError('INVALID_INPUT', 'Date must be a valid YYYY-MM-DD calendar date.');
  if (input.query !== undefined && (typeof input.query !== 'string' || input.query.length > 120 || /[\u0000-\u001f\u007f]/.test(input.query))) {
    throw new OlympicArchiveError('INVALID_INPUT', 'Search text must be at most 120 characters.');
  }
  if (!archiveDate(input.date)) return { events: [], sources: [], limited: true };
  const events = new Map<string, IndividualEvent>(), sources: AnalysisSource[] = [];
  const normalizedQuery = normalizeSearch(input.query ?? '');
  const terms = normalizedQuery.split(' ').filter(Boolean);
  const queryPhase = /\bsemi\s*finals?\b/.test(normalizedQuery) ? 'semi'
    : /\bfinals?\b/.test(normalizedQuery) ? 'final' : undefined;
  let limited = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    // Never follow provider-supplied links: every page stays on the fixed API origin.
    const url = new URL(`${BASE}/events`);
    url.searchParams.set('discipline', config.discipline);
    url.searchParams.set('date', input.date); url.searchParams.set('page', String(page));
    const response = await readPage(url.href, fetcher, Array.isArray);
    if (!Array.isArray(response.json.data)) throw new OlympicArchiveError('UPSTREAM_INVALID', 'The Paris 2024 archive returned an invalid event list.');
    if (response.json.data.length > 100) limited = true;
    sources.push(source(url.href, response.fetchedAt, `${config.discipline}-${input.date}-page-${page}`));
    for (const raw of response.json.data.slice(0, 100)) {
      const event = normalizeEvent(raw, input.sport, input.date);
      if (!event) { limited = true; continue; }
      const searchable = new Set(normalizeSearch(`${event.name} ${event.competitors.map((item) => `${item.name} ${item.country ?? ''}`).join(' ')}`).split(' '));
      const phaseMatches = !queryPhase || (queryPhase === 'final' ? /^final/i.test(event.phase ?? '') : /^semi/i.test(event.phase ?? ''));
      if (phaseMatches && terms.every((term) => searchable.has(term))) events.set(event.id, event);
    }
    const lastPage = positiveInteger(object(response.json.meta).last_page, 100_000);
    if (!lastPage || page >= lastPage) break;
    if (page === MAX_PAGES) limited = true;
  }
  return { events: [...events.values()], sources, ...(limited ? { limited: true } : {}) };
}

/** Only validated historical event IDs are accepted; this API has no action/round feed. */
export async function fetchOlympicEvent(
  input: { eventId: string }, fetcher: typeof fetch = fetch,
): Promise<IndividualSummary> {
  const id = eventNumber(input.eventId), url = `${BASE}/events/${id}`;
  const response = await readPage(url, fetcher, (data) => normalizeEvent(data)?.id === `paris-${id}`);
  const event = normalizeEvent(response.json.data);
  if (!event || event.id !== `paris-${id}`) throw new OlympicArchiveError('UPSTREAM_INVALID', 'The archive did not return the requested historical event.');
  const limitations = [
    'This is a historical Paris 2024 archive, not a live feed for the current date.',
    'The archive has no per-action, per-dive, per-apparatus or split-time feed; an exact photographed action cannot be identified from this record.',
    'Missing result positions are left unknown; participant order is not a finishing rank.',
  ];
  if (event.competitors.some((item) => !item.score)) limitations.push('Some competitors have no published result mark in this archive.');
  if (event.sport === 'gymnastics') limitations.push('Gymnastics result marks are omitted because the archive does not identify whether they are apparatus marks or all-around totals; no apparatus breakdown is available.');
  return { event, fetchedAt: response.fetchedAt, sources: [source(url, response.fetchedAt, `event-${id}`)], rounds: [], limitations };
}
