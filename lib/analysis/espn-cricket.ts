import { EspnProviderError } from './espn';
import type { EspnEvent, EspnLeader, EspnPlay, EspnScoreboard, EspnSource, EspnStatistic, EspnSummary, EspnTeam } from './espn';

const HEADER = 'https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=in&lang=en';
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/cricket';
const MAX_BYTES = 5 * 1024 * 1024;
const CACHE_MS = 30_000;
const TIMEOUT_MS = 10_000;
type Obj = Record<string, unknown>;
interface Snapshot { data: Obj; fetchedAt: string }
let caches = new WeakMap<typeof fetch, Map<string, { expires: number; value: Snapshot }>>();
let pending = new WeakMap<typeof fetch, Map<string, Promise<Snapshot>>>();
export function resetEspnCricketCache(): void { caches = new WeakMap(); pending = new WeakMap(); }
function obj(value: unknown): Obj { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {}; }
function arr(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function clean(value: unknown, max = 300): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  return String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max) || undefined;
}
function number(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function dateTime(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? value : undefined;
}
function safeUrl(value: unknown, image = false): string | undefined {
  if (typeof value !== 'string' || value.length > 1500) return undefined;
  try {
    const url = new URL(value);
    const allowed = image ? ['a.espncdn.com'] : ['www.espn.com', 'www.espn.in', 'www.espncricinfo.com', 'www.cricinfo.com'];
    return url.protocol === 'https:' && !url.username && !url.password && allowed.includes(url.hostname) ? url.href : undefined;
  } catch { return undefined; }
}
function validateDate(date: unknown): asserts date is string | undefined {
  if (date === undefined) return;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new EspnProviderError('INVALID_INPUT', 'Cricket date must be a valid YYYY-MM-DD calendar date.');
  }
}
async function getJson(url: string, fetcher: typeof fetch): Promise<Snapshot> {
  let cache = caches.get(fetcher);
  if (!cache) { cache = new Map(); caches.set(fetcher, cache); }
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return structuredClone(cached.value);
  let requests = pending.get(fetcher);
  if (!requests) { requests = new Map(); pending.set(fetcher, requests); }
  const existing = requests.get(url);
  if (existing) return structuredClone(await existing);
  const request = readJson(url, fetcher);
  requests.set(url, request);
  try {
    const value = await request;
    if (cache.size >= 64) cache.delete(cache.keys().next().value!);
    cache.set(url, { value: structuredClone(value), expires: Date.now() + CACHE_MS });
    return structuredClone(value);
  } finally { if (requests.get(url) === request) requests.delete(url); }
}
async function readJson(url: string, fetcher: typeof fetch): Promise<Snapshot> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json' }, redirect: 'manual', signal: controller.signal });
    if (!response.ok) throw new EspnProviderError('UPSTREAM_HTTP', 'ESPN cricket data is unavailable.', response.status);
    if (Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN cricket response was empty or exceeded the size limit.');
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_BYTES) { await reader.cancel(); throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN cricket response exceeded the size limit.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN cricket response was not valid JSON.'); }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN cricket response had an invalid shape.');
    return { data: obj(parsed), fetchedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof EspnProviderError) throw error;
    if (timedOut || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))) throw new EspnProviderError('UPSTREAM_TIMEOUT', 'ESPN cricket did not respond in time.');
    throw new EspnProviderError('UPSTREAM_HTTP', 'ESPN cricket could not be reached.');
  } finally { clearTimeout(timer); }
}
function normalizeTeam(value: unknown): EspnTeam | undefined {
  const competitor = obj(value), team = typeof competitor.team === 'object' ? obj(competitor.team) : competitor;
  const id = clean(team.id ?? competitor.id, 30), name = clean(team.displayName ?? team.name);
  if (!id || !/^\d{1,15}$/.test(id) || !name) return undefined;
  return {
    id, name, abbreviation: clean(team.abbreviation, 30) ?? name,
    // Cricket totals are strings: multiple innings, wickets and over notation must survive.
    score: clean(obj(competitor.score).displayValue ?? competitor.score, 150),
    homeAway: competitor.homeAway === 'home' || competitor.homeAway === 'away' ? competitor.homeAway : 'unknown',
    logo: safeUrl(team.logo ?? obj(arr(team.logos)[0]).href, true),
  };
}
function normalizeEvent(raw: unknown, league: string, fallbackVenue?: unknown): EspnEvent | undefined {
  const event = obj(raw), competition = arr(event.competitions).length ? obj(arr(event.competitions)[0]) : event;
  const id = clean(event.id ?? competition.id, 15), date = dateTime(competition.date ?? event.date);
  const teams = arr(competition.competitors).map(normalizeTeam).filter((team): team is EspnTeam => !!team);
  if (!id || !/^\d{1,15}$/.test(id) || !date || teams.length !== 2) return undefined;
  const status = obj(event.fullStatus ?? competition.status), type = obj(status.type);
  const statusText = clean(status.summary ?? event.summary ?? type.detail ?? type.description);
  const state = type.state ?? (typeof competition.status === 'string' ? competition.status : undefined);
  const statusWords = `${clean(type.name) ?? ''} ${clean(type.description) ?? ''}`;
  const result: EspnEvent['status'] = /cancel|postpon|suspend|delay|abandon/i.test(statusWords) ? 'unknown'
    : /^starts at|^match scheduled/i.test(statusText ?? '') && !teams.some((team) => team.score) ? 'scheduled'
      : type.completed === true || state === 'post' ? 'final'
        : state === 'in' ? 'live' : state === 'pre' ? 'scheduled' : 'unknown';
  const batting = arr(competition.competitors).flatMap((value) => arr(obj(value).linescores)).map(obj).find((innings) => (innings.isCurrent === 1 || innings.isCurrent === true) && innings.isBatting === true);
  const over = batting ? clean(batting.overs, 20) : undefined;
  const links = arr(event.links).flatMap((value) => { const link = obj(value), url = safeUrl(link.href); return url ? [{ label: clean(link.text) ?? 'ESPN cricket match', url }] : []; }).slice(0, 5);
  return {
    id, league, sport: 'cricket', name: clean(event.name) ?? teams.map((team) => team.name).join(' v '), date,
    status: result, statusDetail: statusText, period: number(status.period),
    ...(over ? { clock: `${over} ov` } : {}), teams,
    venue: clean(event.location ?? obj(competition.venue).fullName ?? obj(fallbackVenue).fullName),
    ...(links.length ? { links } : {}),
  };
}
function source(id: string, label: string, url: string, fetchedAt: string): EspnSource { return { id, label, url, fetchedAt }; }

/** ESPN's aggregate header discovers currently exposed competitions beyond IPL. */
export async function fetchCricketScoreboard(input: { date?: string } = {}, fetcher: typeof fetch = fetch): Promise<EspnScoreboard> {
  validateDate(input.date);
  const target = input.date ? Date.parse(`${input.date}T00:00:00Z`) : undefined;
  // This header is a current snapshot, not an archive endpoint. Old photos use the separate IPL archive.
  if (target !== undefined && Math.abs(Date.now() - target) > 48 * 60 * 60 * 1000) return { league: 'cricket', fetchedAt: new Date().toISOString(), events: [], sources: [] };
  const snapshot = await getJson(HEADER, fetcher);
  if (!Array.isArray(snapshot.data.sports)) throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN cricket header is missing sports.');
  const cricket = arr(snapshot.data.sports).map(obj).filter((sport) => sport.slug === 'cricket' || clean(sport.id) === '200');
  if (cricket.some((sport) => !Array.isArray(sport.leagues))) throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN cricket header is missing competitions.');
  const events: EspnEvent[] = [], seen = new Set<string>();
  let rawCount = 0, normalizedCount = 0;
  for (const league of cricket.flatMap((sport) => arr(sport.leagues)).slice(0, 100).map(obj)) {
    rawCount += arr(league.events).length;
    const leagueId = clean(league.id, 15);
    if (!leagueId || !/^\d{1,15}$/.test(leagueId) || !Array.isArray(league.events)) continue;
    for (const raw of arr(league.events).slice(0, 100)) {
      const event = normalizeEvent(raw, `cricket-${leagueId}`);
      if (!event) continue;
      normalizedCount++;
      const start = Date.parse(event.date), end = Date.parse(dateTime(obj(raw).endDate) ?? event.date);
      if (target !== undefined && !(start < target + 86_400_000 && end >= target)) continue;
      const key = `${event.league}/${event.id}`;
      if (!seen.has(key)) { seen.add(key); events.push(event); }
    }
  }
  if (rawCount && !normalizedCount) throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN cricket events could not be read.');
  const dateKey = input.date ?? 'current';
  return {
    league: 'cricket', fetchedAt: snapshot.fetchedAt, events: events.slice(0, 300),
    sources: [source(`espn-cricket-header-${dateKey}`, 'ESPN current cricket competitions', HEADER, snapshot.fetchedAt)],
  };
}
function normalizePlay(raw: unknown, index: number): EspnPlay | undefined {
  const play = obj(raw), description = clean(play.shortText, 1500) ?? clean(play.text, 1500);
  if (!description) return undefined; // Ignore promotional preText-only entries.
  const over = clean(obj(play.over).actual, 30), clock = over ? `${over} ov` : undefined;
  const timestamp = number(play.bbbTimestamp);
  return {
    id: clean(play.id, 100) ?? `cricket-play-${index}`, text: clock ? `${clock} · ${description}` : description,
    clock, period: number(play.period),
    ...(timestamp && timestamp > 0 && timestamp < 8.64e15 ? { wallclock: new Date(timestamp).toISOString() } : {}),
    // Cricket's slash/innings scores must never be coerced into the numeric homeScore/awayScore contract.
  };
}
function collectLeaders(data: Obj): EspnLeader[] {
  const leaders: EspnLeader[] = [];
  for (const value of arr(data.leaders).slice(0, 10)) {
    const team = obj(value), teamId = clean(obj(team.team).id, 30);
    for (const rawInnings of arr(team.linescores).slice(0, 10)) {
      const innings = obj(rawInnings), period = number(innings.period);
      for (const rawGroup of arr(innings.leaders)) {
        const group = obj(rawGroup), category = clean(group.displayName ?? group.name);
        for (const rawLeader of arr(group.leaders).slice(0, 20)) {
          const leader = obj(rawLeader), athlete = obj(leader.athlete);
          const name = clean(athlete.displayName ?? athlete.fullName ?? athlete.name), value = clean(leader.displayValue, 150);
          if (category && name && value) leaders.push({ category: `${period ? `Innings ${period} ` : ''}${category}`, athlete: name, value, teamId });
        }
      }
    }
  }
  return leaders.slice(0, 100);
}
function collectStatistics(competition: Obj): EspnStatistic[] {
  const statistics: EspnStatistic[] = [];
  for (const rawTeam of arr(competition.competitors)) {
    const team = obj(rawTeam), teamId = clean(obj(team.team).id ?? team.id, 30);
    if (!teamId) continue;
    for (const rawInnings of arr(team.linescores).slice(0, 10)) {
      const innings = obj(rawInnings), period = number(innings.period);
      if (innings.isCurrent !== 1 && innings.isCurrent !== true) continue;
      // ESPN creates zero-filled mirror innings for the side that has not batted.
      if (!clean(innings.score) && innings.isBatting !== true) continue;
      for (const key of ['runs', 'wickets', 'overs', 'target']) {
        const value = clean(innings[key], 100);
        if (value !== undefined) statistics.push({ teamId, label: `${period ? `Innings ${period} ` : ''}${key}`, value });
      }
    }
  }
  return statistics.slice(0, 100);
}
export async function fetchCricketSummary(input: { league: string; eventId: string }, fetcher: typeof fetch = fetch): Promise<EspnSummary> {
  const leagueMatch = typeof input.league === 'string' ? /^cricket-(\d{1,15})$/.exec(input.league) : null;
  if (!leagueMatch || typeof input.eventId !== 'string' || !/^\d{1,15}$/.test(input.eventId)) throw new EspnProviderError('INVALID_INPUT', 'Cricket league and event IDs must be valid ESPN numeric identifiers.');
  const leagueId = leagueMatch[1], url = `${BASE}/${leagueId}/summary?event=${input.eventId}&lang=en&region=in`;
  const snapshot = await getJson(url, fetcher), header = obj(snapshot.data.header), competition = obj(arr(header.competitions)[0]);
  const leagueIds = [clean(obj(header.league).id), ...arr(header.leagues).map((league) => clean(obj(league).id))];
  const event = normalizeEvent(header, input.league, obj(snapshot.data.gameInfo).venue);
  if (!event || event.id !== input.eventId || clean(competition.id) !== input.eventId || !leagueIds.includes(leagueId)) throw new EspnProviderError('UPSTREAM_INVALID', 'ESPN cricket summary did not match the requested competition and event.');
  const commentaries = competition.commentaries;
  const rawPlays = [...arr(snapshot.data.plays), ...arr(snapshot.data.commentary), ...(Array.isArray(commentaries) ? commentaries : Object.values(obj(commentaries)))];
  const plays: EspnPlay[] = [], seen = new Set<string>();
  for (let i = 0; i < rawPlays.length && plays.length < 1000; i++) {
    const play = normalizePlay(rawPlays[i], i);
    if (play && !seen.has(play.id)) { seen.add(play.id); plays.push(play); }
  }
  // Object-key and array ordering differ between feeds; consumers receive oldest to newest.
  plays.sort((a, b) => {
    if (a.wallclock && b.wallclock) return Date.parse(a.wallclock) - Date.parse(b.wallclock);
    const period = (a.period ?? 0) - (b.period ?? 0);
    return period || (Number.parseFloat(a.clock ?? '') || 0) - (Number.parseFloat(b.clock ?? '') || 0);
  });
  const leaders = collectLeaders(snapshot.data), statistics = collectStatistics(competition);
  const headlines = arr(obj(snapshot.data.news).articles).map((article) => clean(obj(article).headline)).filter((headline): headline is string => !!headline).slice(0, 5);
  return {
    event, fetchedAt: snapshot.fetchedAt,
    sources: [source(`espn-cricket-${leagueId}-summary-${input.eventId}`, 'ESPN cricket match summary', url, snapshot.fetchedAt)], plays,
    ...(leaders.length ? { leaders } : {}), ...(statistics.length ? { statistics } : {}), ...(headlines.length ? { headlines } : {}),
  };
}
