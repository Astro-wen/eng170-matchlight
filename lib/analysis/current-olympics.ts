import { EspnProviderError } from './espn';
import { ESPN_OLYMPIC_DISCIPLINES } from './espn-olympics';
import type { AnalysisSource } from './types';
import type { EventCompetitor, IndividualEvent, IndividualSport, IndividualSummary } from './individual-types';

const BASE = 'https://site.api.espn.com/apis/site/v2/olympics/summer';
const MAX_BYTES = 2 * 1024 * 1024;
const LIVE_WINDOW_MS = 18 * 60 * 60 * 1000;
const CACHE_MS = 30_000;
const TIMEOUT_MS = 10_000;
type Obj = Record<string, unknown>;
interface Day { data: Obj; source: AnalysisSource }
let caches = new WeakMap<typeof fetch, Map<string, { value: Day; expires: number }>>();
let pending = new WeakMap<typeof fetch, Map<string, Promise<Day>>>();
export function resetCurrentOlympicsCache(): void { caches = new WeakMap(); pending = new WeakMap(); }
function obj(value: unknown): Obj { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {}; }
function arr(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function clean(value: unknown, max = 300): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  return String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max) || undefined;
}
function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
function asOfTime(value?: string): number {
  if (value === undefined) return Date.now();
  if (typeof value !== 'string' || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !validDate(value.slice(0, 10)) || !Number.isFinite(Date.parse(value))) {
    throw new EspnProviderError('INVALID_INPUT', 'Olympic lookup time must be an ISO timestamp.');
  }
  return Date.parse(value);
}
function latestSummerYear(time: number): number {
  const year = Math.floor(new Date(time).getUTCFullYear() / 4) * 4;
  if (year < 2012 || year > 2096) throw new EspnProviderError('INVALID_INPUT', 'Olympic lookup time is outside the supported year range.');
  return year;
}
function utcDate(time: number): string { return new Date(time).toISOString().slice(0, 10); }
function withinCalendar(data: Obj, time: number): boolean {
  const season = obj(data.season), start = Date.parse(String(season.calendarStartDate ?? '')), end = Date.parse(String(season.calendarEndDate ?? ''));
  return !(Number.isFinite(start) && time < start || Number.isFinite(end) && time > end);
}
async function fetchDay(year: number, date: string, fetcher: typeof fetch): Promise<Day> {
  const key = `${year}/${date}`;
  let cache = caches.get(fetcher);
  if (!cache) { cache = new Map(); caches.set(fetcher, cache); }
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return structuredClone(cached.value);
  let requests = pending.get(fetcher);
  if (!requests) { requests = new Map(); pending.set(fetcher, requests); }
  const existing = requests.get(key);
  if (existing) return structuredClone(await existing);
  const request = loadDay(year, date, fetcher);
  requests.set(key, request);
  try {
    const value = await request;
    if (cache.size >= 32) cache.delete(cache.keys().next().value!);
    cache.set(key, { value: structuredClone(value), expires: Date.now() + CACHE_MS });
    return structuredClone(value);
  } finally { if (requests.get(key) === request) requests.delete(key); }
}
async function loadDay(year: number, date: string, fetcher: typeof fetch): Promise<Day> {
  const url = `${BASE}/${year}/results?dates=${date.replaceAll('-', '')}&lang=en&region=us`;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json' }, redirect: 'manual', signal: controller.signal });
    if (!response.ok) throw new EspnProviderError('UPSTREAM_HTTP', 'ESPN current Olympic events are unavailable.', response.status);
    if (!response.body || Number(response.headers.get('content-length')) > MAX_BYTES) throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN Olympic response was empty or exceeded the size limit.');
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_BYTES) { await reader.cancel(); throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN Olympic response exceeded the size limit.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN Olympic response was not valid JSON.'); }
    const data = obj(parsed), season = obj(data.season);
    const emptyWithoutDay = Array.isArray(data.competitions) && data.competitions.length === 0 && data.day === undefined;
    if (!Array.isArray(data.competitions) || clean(season.year) !== String(year) || season.type !== 'summer' || !emptyWithoutDay && obj(data.day).date !== date) {
      throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN Olympic response did not match the requested Games and day.');
    }
    const fetchedAt = new Date().toISOString();
    return { data, source: { id: `espn-current-olympics-${year}-${date}`, label: `ESPN Olympic current-day lookup · ${date}`, url, fetchedAt, kind: 'provider' } };
  } catch (error) {
    if (error instanceof EspnProviderError) throw error;
    if (timedOut || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))) throw new EspnProviderError('UPSTREAM_TIMEOUT', 'ESPN current Olympic events did not respond in time.');
    throw new EspnProviderError('UPSTREAM_HTTP', 'ESPN current Olympic events could not be reached.');
  } finally { clearTimeout(timer); }
}
function competitorsOf(competition: Obj): EventCompetitor[] {
  const entries = new Map<string, EventCompetitor>();
  const grouped = competition.competitionType === 'group' || competition.competitionType === 'team';
  for (const raw of arr(competition.results).slice(0, 500)) {
    const row = obj(raw), athlete = obj(row.athlete), country = clean(obj(row.country).abbreviation, 10);
    const name = clean(athlete.displayName) ?? clean([clean(athlete.firstName), clean(athlete.lastName)].filter(Boolean).join(' ')) ?? clean(obj(row.country).name);
    if (!name) continue;
    const athleteId = clean(athlete.id, 40), score = clean(row.result, 100);
    const rank = typeof row.place === 'number' && Number.isInteger(row.place) && row.place > 0 && row.place < 1000 ? row.place : undefined;
    const key = grouped ? `${clean(row.resultGroup) ?? country ?? name}-${rank ?? ''}-${score ?? ''}` : athleteId ?? `${country}-${name}`;
    const previous = entries.get(key);
    if (previous) { if (!previous.name.split(', ').includes(name)) previous.name = `${previous.name}, ${name}`.slice(0, 1000); continue; }
    entries.set(key, { id: grouped ? `group-${entries.size + 1}` : athleteId ?? `result-${entries.size + 1}`, name, country, rank, score, ...(!grouped && athleteId ? { athleteId } : {}) });
  }
  return [...entries.values()].sort((a, b) => (a.rank ?? 1000) - (b.rank ?? 1000));
}
function currentEvent(raw: unknown, day: Day, year: number, date: string, asOf: number): IndividualEvent | undefined {
  const competition = obj(raw), status = obj(competition.olympicsStatus), id = clean(competition.id, 12);
  const discipline = clean(obj(competition.discipline).id), sport = (Object.keys(ESPN_OLYMPIC_DISCIPLINES) as IndividualSport[]).find((key) => ESPN_OLYMPIC_DISCIPLINES[key].includes(discipline ?? ''));
  const name = clean(competition.description, 220), startText = clean(competition.date, 50), startsAt = startText ? Date.parse(startText) : NaN;
  if (!sport || !id || !/^\d{1,12}$/.test(id) || !name || !startText || startText.slice(0, 10) !== date || !Number.isFinite(startsAt) || startsAt > asOf || asOf - startsAt > LIVE_WINDOW_MS) return undefined;
  // Availability, timeValid, result updates and proximity to start are not live-state evidence.
  if (status.state !== 'in' || status.completed === true || /cancel|postpon|suspend|delay|abandon/i.test(`${clean(status.name) ?? ''} ${clean(status.description) ?? ''} ${clean(status.detail) ?? ''}`) || !withinCalendar(day.data, asOf) || !withinCalendar(day.data, startsAt)) return undefined;
  const endsAt = typeof competition.endDate === 'string' ? Date.parse(competition.endDate) : NaN;
  if (Number.isFinite(endsAt) && endsAt < asOf) return undefined;
  return {
    id: `espn-cur-summer-${year}-${date.replaceAll('-', '')}-${id}`,
    league: 'espn-current-olympics', sport, provider: 'espn-olympics', dataMode: 'lookup',
    name: `${clean(obj(day.data.season).name, 60) ?? `Summer Olympics ${year}`} · ${name}`, date: startText,
    status: 'live', statusDetail: clean(status.description) ?? 'ESPN reports in progress',
    phase: clean(arr(competition.types).map(obj).find((type) => type.type === 'run')?.text),
    competitors: competitorsOf(competition), teams: [],
  };
}

/** Limited discovery from ESPN's Olympic result feed; confirmed current state is mandatory. */
export async function discoverCurrentOlympics(input: { sport: IndividualSport; asOf?: string }, fetcher: typeof fetch = fetch): Promise<{ events: IndividualEvent[]; sources: AnalysisSource[]; limited: boolean }> {
  if (!Object.hasOwn(ESPN_OLYMPIC_DISCIPLINES, input.sport)) throw new EspnProviderError('INVALID_INPUT', 'This Olympic sport is not configured.');
  const asOf = asOfTime(input.asOf), year = latestSummerYear(asOf), date = utcDate(asOf);
  const day = await fetchDay(year, date, fetcher), days = [{ day, date }];
  // Outside the provider's own Games calendar, an empty response is a valid current lookup.
  if (!withinCalendar(day.data, asOf)) return { events: [], sources: [day.source], limited: true };
  const previousDate = utcDate(asOf - 86_400_000);
  try { days.push({ day: await fetchDay(year, previousDate, fetcher), date: previousDate }); }
  catch { /* Current-day data remains usable; coverage is explicitly limited. */ }
  const events = days.flatMap(({ day, date }) => arr(day.data.competitions).slice(0, 1000).flatMap((raw) => {
    const event = currentEvent(raw, day, year, date, asOf);
    return event?.sport === input.sport ? [event] : [];
  }));
  return { events: [...new Map(events.map((event) => [event.id, event])).values()].slice(0, 200), sources: days.map(({ day }) => day.source), limited: true };
}

/** asOf is an internal test/replay hook; public request handlers must use the server clock. */
export async function fetchCurrentOlympicSummary(input: { eventId: string; asOf?: string }, fetcher: typeof fetch = fetch): Promise<IndividualSummary> {
  const match = typeof input.eventId === 'string' ? /^espn-cur-summer-(\d{4})-(\d{4})(\d{2})(\d{2})-(\d{1,12})$/.exec(input.eventId) : null;
  const asOf = asOfTime(input.asOf), year = latestSummerYear(asOf);
  const date = match ? `${match[2]}-${match[3]}-${match[4]}` : '';
  if (!match || Number(match[1]) !== year || !validDate(date) || ![utcDate(asOf), utcDate(asOf - 86_400_000)].includes(date)) throw new EspnProviderError('INVALID_INPUT', 'Olympic event ID is not a current candidate.');
  const day = await fetchDay(year, date, fetcher), raw = arr(day.data.competitions).find((value) => clean(obj(value).id) === match[5]);
  const event = currentEvent(raw, day, year, date, asOf);
  if (!event || event.id !== input.eventId) throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN no longer reports this Olympic event as currently in progress.');
  return {
    event, fetchedAt: day.source.fetchedAt, sources: [day.source], rounds: [],
    limitations: [
      'ESPN explicitly reports this event in progress at lookup time; a photo can be delayed and does not establish the current state by itself.',
      'This Olympic results feed has limited coverage and may omit heats, participants, splits, judging breakdowns and individual attempts.',
      'No complete current Olympic schedule or action timeline is available from this adapter.',
    ],
  };
}
