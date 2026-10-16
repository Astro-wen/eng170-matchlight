import { EspnProviderError } from './espn';
import type { AnalysisSource } from './types';
import type { EventCompetitor, IndividualEvent, IndividualSearch, IndividualSport, IndividualSummary } from './individual-types';

/** ESPN's Olympic results feed is separate from its two-team league scoreboards. */
export const ESPN_OLYMPIC_DISCIPLINES: Readonly<Record<IndividualSport, readonly string[]>> = Object.freeze({
  diving: ['16'], swimming: ['39'], athletics: ['3'], gymnastics: ['21', '22', '23'],
});
const BASE = 'https://site.api.espn.com/apis/site/v2/olympics/summer/2024/results';
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const CACHE_MS = 30_000;
type Obj = Record<string, unknown>;
interface Day { data: Obj; source: AnalysisSource }
let caches = new WeakMap<typeof fetch, Map<string, { value: Day; expires: number }>>();
let pending = new WeakMap<typeof fetch, Map<string, Promise<Day>>>();
export function resetEspnOlympicsCache(): void { caches = new WeakMap(); pending = new WeakMap(); }

function obj(value: unknown): Obj { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {}; }
function arr(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function clean(value: unknown, max = 300): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  return String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max) || undefined;
}
function validDate(date: unknown): asserts date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new EspnProviderError('INVALID_INPUT', 'Olympic date must be a valid YYYY-MM-DD calendar date.');
  }
}
function inWindow(date: string): boolean { return date >= '2024-07-24' && date <= '2024-08-11'; }
function sportOf(competition: Obj): IndividualSport | undefined {
  const discipline = clean(obj(competition.discipline).id);
  return (Object.keys(ESPN_OLYMPIC_DISCIPLINES) as IndividualSport[]).find((sport) => ESPN_OLYMPIC_DISCIPLINES[sport].includes(discipline ?? ''));
}
function normalized(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }

async function fetchDay(date: string, fetcher: typeof fetch): Promise<Day> {
  let requests = pending.get(fetcher);
  if (!requests) { requests = new Map(); pending.set(fetcher, requests); }
  const existing = requests.get(date);
  if (existing) return structuredClone(await existing);
  const request = loadDay(date, fetcher);
  requests.set(date, request);
  try { return structuredClone(await request); }
  finally { if (requests.get(date) === request) requests.delete(date); }
}

async function loadDay(date: string, fetcher: typeof fetch): Promise<Day> {
  let cache = caches.get(fetcher);
  if (!cache) { cache = new Map(); caches.set(fetcher, cache); }
  const cached = cache.get(date);
  if (cached && cached.expires > Date.now()) return structuredClone(cached.value);
  const url = `${BASE}?dates=${date.replaceAll('-', '')}&lang=en&region=us`;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json' }, redirect: 'manual', signal: controller.signal });
    if (!response.ok) throw new EspnProviderError('UPSTREAM_HTTP', 'ESPN Olympic results are unavailable.', response.status);
    if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN Olympic results exceeded the size limit.');
    if (!response.body) throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN Olympic results were empty.');
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_BYTES) { await reader.cancel(); throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN Olympic results exceeded the size limit.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN Olympic results were not valid JSON.'); }
    const data = obj(parsed), season = obj(data.season);
    // ESPN currently ignores discipline/event filters; verify the returned day and filter locally.
    if (!Array.isArray(data.competitions) || clean(season.year) !== '2024' || season.type !== 'summer' || obj(data.day).date !== date) {
      throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN Olympic results did not match the requested date and Games.');
    }
    const fetchedAt = new Date().toISOString();
    const day: Day = { data, source: { id: `espn-olympics-2024-${date}`, label: `ESPN Paris 2024 Olympic results · ${date}`, url, fetchedAt } };
    if (cache.size >= 32) cache.delete(cache.keys().next().value!);
    cache.set(date, { value: structuredClone(day), expires: Date.now() + CACHE_MS });
    return day;
  } catch (error) {
    if (error instanceof EspnProviderError) throw error;
    if (timedOut || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))) throw new EspnProviderError('UPSTREAM_TIMEOUT', 'ESPN Olympic results did not respond in time.');
    throw new EspnProviderError('UPSTREAM_HTTP', 'ESPN Olympic results could not be reached.');
  } finally { clearTimeout(timer); }
}

function competitorsOf(competition: Obj): EventCompetitor[] {
  const groups = new Map<string, EventCompetitor>();
  for (const value of arr(competition.results).slice(0, 500)) {
    const row = obj(value), athlete = obj(row.athlete), country = obj(row.country);
    const athleteId = clean(athlete.id, 40);
    const athleteName = clean(athlete.displayName ?? [clean(athlete.firstName), clean(athlete.lastName)].filter(Boolean).join(' '));
    const countryCode = clean(country.abbreviation, 10);
    const name = athleteName ?? clean(country.name);
    const rank = typeof row.place === 'number' && Number.isInteger(row.place) && row.place > 0 && row.place < 1000 ? row.place : undefined;
    const score = clean(row.result, 100);
    if (!name) continue;
    // Relay/synchronised/team feeds repeat the team's result for every member.
    const group = competition.competitionType === 'group' || competition.competitionType === 'team';
    const key = group ? `${clean(row.resultGroup) ?? countryCode ?? name}-${rank ?? ''}-${score ?? ''}` : athleteId ?? `${countryCode}-${name}`;
    const previous = groups.get(key);
    if (previous) { if (!previous.name.split(', ').includes(name)) previous.name = `${previous.name}, ${name}`.slice(0, 1000); continue; }
    groups.set(key, {
      id: group ? `group-${key.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 100)}` : athleteId ?? `result-${groups.size + 1}`,
      name, country: countryCode, rank, score,
      ...(athleteId && !group ? { athleteId } : {}),
    });
  }
  return [...groups.values()].sort((a, b) => (a.rank ?? 1000) - (b.rank ?? 1000));
}
function normalizeCompetition(value: unknown, date: string): IndividualEvent | undefined {
  const competition = obj(value), sport = sportOf(competition), id = clean(competition.id, 12);
  const eventDate = clean(competition.date, 50), name = clean(competition.description);
  if (!sport || !id || !/^\d{1,12}$/.test(id) || !eventDate || !Number.isFinite(Date.parse(eventDate)) || eventDate.slice(0, 10) !== date || !name) return undefined;
  const status = obj(competition.olympicsStatus), competitors = competitorsOf(competition);
  return {
    id: `espn-olym-summer-2024-${date.replaceAll('-', '')}-${id}`,
    league: 'espn-olympics', sport, name: `Paris 2024 · ${name}`, date: eventDate,
    // Archived data can never claim to be a current live event.
    status: status.completed === true && status.state === 'post' ? 'final' : 'unknown',
    statusDetail: clean(status.description) ?? 'Historical Olympic result',
    provider: 'espn-olympics', dataMode: 'historical',
    phase: clean(arr(competition.types).map(obj).find((type) => type.type === 'run')?.text),
    competitors,
    teams: [],
  };
}

export async function searchEspnOlympics(input: { sport: IndividualSport; date: string; query?: string }, fetcher: typeof fetch = fetch): Promise<IndividualSearch> {
  if (!Object.hasOwn(ESPN_OLYMPIC_DISCIPLINES, input.sport)) throw new EspnProviderError('INVALID_INPUT', 'This Olympic sport is not configured.');
  validDate(input.date);
  if (input.query !== undefined && (typeof input.query !== 'string' || input.query.length > 300)) throw new EspnProviderError('INVALID_INPUT', 'Olympic query must contain at most 300 characters.');
  if (!inWindow(input.date)) return { events: [], sources: [], limited: true };
  const day = await fetchDay(input.date, fetcher);
  const terms = normalized(input.query ?? '').split(' ').filter(Boolean);
  const events = arr(day.data.competitions).slice(0, 1000).flatMap((value) => {
    const event = normalizeCompetition(value, input.date);
    if (!event || event.sport !== input.sport) return [];
    const haystack = normalized(`${event.name} ${event.competitors.map((entry) => `${entry.name} ${entry.country}`).join(' ')}`);
    return terms.every((term) => haystack.includes(term)) ? [event] : [];
  }).slice(0, 200);
  return { events, sources: [day.source], limited: true };
}

export async function fetchEspnOlympicSummary(input: { eventId: string }, fetcher: typeof fetch = fetch): Promise<IndividualSummary> {
  const match = typeof input.eventId === 'string' ? /^espn-olym-summer-2024-(\d{4})(\d{2})(\d{2})-(\d{1,12})$/.exec(input.eventId) : null;
  if (!match) throw new EspnProviderError('INVALID_INPUT', 'Olympic event ID is invalid.');
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  validDate(date);
  if (!inWindow(date)) throw new EspnProviderError('INVALID_INPUT', 'This Olympic event is outside the verified Paris 2024 results window.');
  const day = await fetchDay(date, fetcher);
  const raw = arr(day.data.competitions).find((value) => clean(obj(value).id) === match[4]);
  const event = normalizeCompetition(raw, date);
  if (!event || event.id !== input.eventId) throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN Olympic results did not contain the requested event.');
  return {
    event, fetchedAt: day.source.fetchedAt, sources: [day.source], rounds: [],
    limitations: [
      'Historical Paris 2024 results fetched from ESPN; this is not a live feed for the photographed moment.',
      'This ESPN Olympic feed provides medal results and may omit other finalists, heat results, detailed scores, splits, and individual attempts.',
      'Final results do not establish what happened in the particular action shown in a single photograph.',
    ],
  };
}
