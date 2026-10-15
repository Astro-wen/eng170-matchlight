/** Server-side ESPN JSON provider. All upstream paths are chosen from this registry. */
export const ESPN_LEAGUES = Object.freeze([
  { key: "nba", sport: "basketball", league: "nba", label: "NBA" },
  { key: "wnba", sport: "basketball", league: "wnba", label: "WNBA" },
  { key: "ncaam", sport: "basketball", league: "mens-college-basketball", label: "NCAA men's basketball" },
  { key: "ncaaw", sport: "basketball", league: "womens-college-basketball", label: "NCAA women's basketball" },
  { key: "nfl", sport: "football", league: "nfl", label: "NFL" },
  { key: "nhl", sport: "hockey", league: "nhl", label: "NHL" },
  { key: "mlb", sport: "baseball", league: "mlb", label: "MLB" },
  { key: "epl", sport: "soccer", league: "eng.1", label: "Premier League" },
  { key: "mls", sport: "soccer", league: "usa.1", label: "MLS" },
  { key: "laliga", sport: "soccer", league: "esp.1", label: "LaLiga" },
  { key: "bundesliga", sport: "soccer", league: "ger.1", label: "Bundesliga" },
  { key: "seriea", sport: "soccer", league: "ita.1", label: "Serie A" },
  { key: "ligue1", sport: "soccer", league: "fra.1", label: "Ligue 1" },
  { key: "ucl", sport: "soccer", league: "uefa.champions", label: "UEFA Champions League" },
  { key: "worldcup", sport: "soccer", league: "fifa.world", label: "FIFA World Cup" },
  { key: "wwc", sport: "soccer", league: "fifa.wwc", label: "FIFA Women's World Cup" },
  { key: "ipl", sport: "cricket", league: "8048", label: "Indian Premier League" },
].map((league) => Object.freeze(league)));

export interface EspnSource { id: string; label: string; url: string; fetchedAt: string }
export interface EspnTeam {
  id: string; name: string; abbreviation: string; score?: string;
  homeAway: "home" | "away" | "unknown"; logo?: string;
}
export interface EspnEvent {
  id: string; league: string; sport: string; name: string; date: string;
  status: "scheduled" | "live" | "final" | "unknown";
  statusDetail?: string; clock?: string; period?: number; teams: EspnTeam[];
  venue?: string; links?: { label: string; url: string }[];
}
export interface EspnPlay {
  id: string; text: string; clock?: string; period?: number;
  homeScore?: number; awayScore?: number; wallclock?: string;
}
export interface EspnLeader { category: string; athlete: string; value: string; teamId?: string }
export interface EspnStatistic { teamId: string; label: string; value: string }
export interface EspnScoreboard { league: string; fetchedAt: string; sources: EspnSource[]; events: EspnEvent[] }
export interface EspnSummary {
  event: EspnEvent; fetchedAt: string; sources: EspnSource[]; plays: EspnPlay[];
  leaders?: EspnLeader[]; statistics?: EspnStatistic[]; headlines?: string[];
}
export type EspnErrorCode = "UNSUPPORTED_LEAGUE" | "INVALID_INPUT" | "UPSTREAM_HTTP" | "UPSTREAM_TIMEOUT" | "UPSTREAM_INVALID";
export class EspnProviderError extends Error {
  constructor(public readonly code: EspnErrorCode, message: string, public readonly upstreamStatus?: number) {
    super(message); this.name = "EspnProviderError";
  }
}

type JsonObject = Record<string, unknown>;
type League = typeof ESPN_LEAGUES[number];
const BASE = "https://site.api.espn.com/apis/site/v2/sports";
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const CACHE_MS = 30_000;
const MAX_CACHE_ENTRIES = 100;
let scoreboardCaches = new WeakMap<typeof fetch, Map<string, { expiresAt: number; value: EspnScoreboard }>>();

/** Intended for isolated provider tests; no upstream requests are made. */
export function resetEspnCache(): void { scoreboardCaches = new WeakMap(); }

function object(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown, max = 300): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const result = String(value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  return result || undefined;
}
function numeric(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
function iso(value: unknown): string | undefined {
  const input = typeof value === "string" ? value : undefined;
  return input && /^\d{4}-\d{2}-\d{2}T/.test(input) && Number.isFinite(Date.parse(input)) ? input : undefined;
}
function safeUrl(value: unknown, image = false): string | undefined {
  if (typeof value !== "string" || value.length > 1500) return undefined;
  try {
    const url = new URL(value);
    const allowed = image ? ["a.espncdn.com"] : ["www.espn.com", "espn.com", "www.espncricinfo.com", "www.cricinfo.com"];
    return url.protocol === "https:" && !url.username && !url.password && allowed.includes(url.hostname) ? url.href : undefined;
  } catch { return undefined; }
}
function getLeague(key: string): League {
  const league = ESPN_LEAGUES.find((item) => item.key === key);
  if (!league) throw new EspnProviderError("UNSUPPORTED_LEAGUE", "This competition is not available through the configured ESPN provider.");
  return league;
}
function validateDate(date: unknown): asserts date is string | undefined {
  if (date === undefined) return;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new EspnProviderError("INVALID_INPUT", "Date must be a valid YYYY-MM-DD calendar date.");
  }
}

async function readJson(url: string, fetcher: typeof fetch): Promise<JsonObject> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
  try {
    // Refuse redirects so an upstream response cannot change the allowlisted origin.
    const response = await fetcher(url, { headers: { Accept: "application/json" }, signal: controller.signal, redirect: "manual" });
    if (!response.ok) throw new EspnProviderError("UPSTREAM_HTTP", "ESPN could not return this event.", response.status);
    const length = Number(response.headers.get("content-length"));
    if (length > MAX_BYTES) throw new EspnProviderError("UPSTREAM_INVALID", "ESPN response exceeded the size limit.");
    if (!response.body) throw new EspnProviderError("UPSTREAM_INVALID", "ESPN returned an empty response.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          throw new EspnProviderError("UPSTREAM_INVALID", "ESPN response exceeded the size limit.");
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total);
    let position = 0;
    for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
    let json: unknown;
    try { json = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new EspnProviderError("UPSTREAM_INVALID", "ESPN returned malformed JSON."); }
    if (json === null || typeof json !== "object" || Array.isArray(json)) throw new EspnProviderError("UPSTREAM_INVALID", "ESPN returned an invalid response shape.");
    return object(json);
  } catch (error) {
    if (error instanceof EspnProviderError) throw error;
    if (timedOut || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))) {
      throw new EspnProviderError("UPSTREAM_TIMEOUT", "ESPN did not respond in time.");
    }
    throw new EspnProviderError("UPSTREAM_HTTP", "ESPN could not be reached.");
  } finally { clearTimeout(timer); }
}

function normalizeTeam(value: unknown): EspnTeam | undefined {
  const competitor = object(value), team = object(competitor.team);
  const id = text(team.id ?? competitor.id, 30), name = text(team.displayName ?? team.name);
  if (!id || !name) return undefined;
  return {
    id, name, abbreviation: text(team.abbreviation, 30) ?? name,
    score: text(object(competitor.score).displayValue ?? competitor.score, 100),
    homeAway: competitor.homeAway === "home" || competitor.homeAway === "away" ? competitor.homeAway : "unknown",
    logo: safeUrl(team.logo ?? object(list(team.logos)[0]).href, true),
  };
}
function normalizeEvent(value: unknown, league: League, fallbackVenue?: unknown): EspnEvent | undefined {
  const event = object(value), competition = object(list(event.competitions)[0]);
  const id = text(event.id ?? competition.id, 30), date = iso(event.date ?? competition.date);
  const teams = list(competition.competitors).map(normalizeTeam).filter((item): item is EspnTeam => !!item);
  if (!id || !/^\d{1,15}$/.test(id) || !date || teams.length !== 2) return undefined;
  const status = object(event.status ?? competition.status), type = object(status.type);
  const statusName = text(type.name) ?? "";
  const state: EspnEvent["status"] = /cancel|postpon|suspend|delay/i.test(statusName) ? "unknown"
    : type.state === "post" || type.completed === true ? "final"
      : type.state === "in" ? "live" : type.state === "pre" ? "scheduled" : "unknown";
  const links = list(event.links).flatMap((value) => {
    const link = object(value), url = safeUrl(link.href);
    return url ? [{ label: text(link.text ?? link.shortText) ?? "ESPN game page", url }] : [];
  }).slice(0, 5);
  return {
    id, league: league.key, sport: league.sport,
    name: text(event.name) ?? `${teams.find((t) => t.homeAway === "away")?.name ?? teams[1].name} at ${teams.find((t) => t.homeAway === "home")?.name ?? teams[0].name}`,
    date, status: state, statusDetail: text(status.summary ?? type.detail ?? type.description),
    clock: text(status.displayClock, 100), period: numeric(status.period), teams,
    venue: text(object(competition.venue).fullName ?? object(fallbackVenue).fullName),
    ...(links.length ? { links } : {}),
  };
}
function source(league: League, url: string, fetchedAt: string, kind: string, eventId = ""): EspnSource {
  return { id: `espn-${league.key}-${kind}${eventId ? `-${eventId}` : ""}`, label: `ESPN ${league.label} ${kind}`, url, fetchedAt };
}

export async function fetchScoreboard(input: { league: string; date?: string }, fetcher: typeof fetch = fetch): Promise<EspnScoreboard> {
  const league = getLeague(input.league);
  validateDate(input.date);
  const url = `${BASE}/${league.sport}/${league.league}/scoreboard${input.date ? `?dates=${input.date.replaceAll("-", "")}` : ""}`;
  let cache = scoreboardCaches.get(fetcher);
  if (!cache) { cache = new Map(); scoreboardCaches.set(fetcher, cache); }
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.value);
  const data = await readJson(url, fetcher);
  if (!Array.isArray(data.events)) throw new EspnProviderError("UPSTREAM_INVALID", "ESPN scoreboard is missing its events array.");
  const events = data.events.slice(0, 500).map((value) => normalizeEvent(value, league)).filter((event): event is EspnEvent => !!event);
  if (data.events.length && !events.length) throw new EspnProviderError("UPSTREAM_INVALID", "ESPN scoreboard events could not be read.");
  const fetchedAt = new Date().toISOString();
  const result = { league: league.key, fetchedAt, sources: [source(league, url, fetchedAt, "scoreboard", input.date || "current")], events };
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(url, { expiresAt: Date.now() + CACHE_MS, value: structuredClone(result) });
  return result;
}

function normalizePlay(value: unknown, index: number): EspnPlay | undefined {
  const play = object(value), description = text(play.shortText ?? play.text, 1000);
  if (!description) return undefined;
  const clock = text(object(play.clock).displayValue ?? object(play.time).displayValue, 100);
  return {
    id: text(play.id, 100) ?? `play-${text(play.sequence ?? play.sequenceNumber, 100) ?? index}`,
    text: description,
    clock: clock ?? (typeof object(play.over).actual === "number" ? `${object(play.over).actual} ov` : undefined),
    period: numeric(object(play.period).number ?? play.period),
    homeScore: numeric(play.homeScore), awayScore: numeric(play.awayScore),
    wallclock: iso(play.wallclock) ?? (typeof play.bbbTimestamp === "number" && Number.isFinite(play.bbbTimestamp) && Math.abs(play.bbbTimestamp) < 8.64e15 ? new Date(play.bbbTimestamp).toISOString() : undefined),
  };
}
function collectStatistics(data: JsonObject, competition: JsonObject): EspnStatistic[] {
  const result: EspnStatistic[] = [];
  const add = (teamId: string | undefined, value: unknown, depth = 0): void => {
    if (depth > 3 || result.length >= 1000) return;
    const stat = object(value), label = text(stat.label ?? stat.displayName ?? stat.name), displayed = text(stat.displayValue ?? stat.value, 150);
    if (teamId && label && displayed) result.push({ teamId, label, value: displayed });
    for (const child of list(stat.stats)) add(teamId, child, depth + 1);
  };
  for (const value of list(object(data.boxscore).teams)) {
    const team = object(value), teamId = text(object(team.team).id, 30);
    for (const statistic of list(team.statistics)) add(teamId, statistic);
  }
  // Cricket keeps current innings totals on competitors rather than a boxscore.
  for (const value of list(competition.competitors)) {
    const competitor = object(value), teamId = text(object(competitor.team).id ?? competitor.id, 30);
    for (const value of list(competitor.linescores)) {
      const innings = object(value), period = numeric(innings.period);
      if (innings.isCurrent !== 1 && innings.isCurrent !== true) continue;
      for (const key of ["runs", "wickets", "overs", "target"] as const) {
        const displayed = text(innings[key], 150);
        if (teamId && displayed) result.push({ teamId, label: `${period ? `Innings ${period} ` : ""}${key}`, value: displayed });
      }
    }
  }
  return result.slice(0, 1000);
}
function collectLeaders(data: JsonObject): EspnLeader[] {
  const result: EspnLeader[] = [];
  for (const value of list(data.leaders)) {
    const team = object(value), teamId = text(object(team.team).id, 30);
    for (const value of list(team.leaders)) {
      const group = object(value), category = text(group.displayName ?? group.name);
      for (const value of list(group.leaders)) {
        const leader = object(value), athlete = text(object(leader.athlete).displayName ?? object(leader.athlete).fullName), displayed = text(leader.displayValue, 200);
        if (category && athlete && displayed) result.push({ category, athlete, value: displayed, teamId });
      }
    }
  }
  return result.slice(0, 100);
}
export async function fetchEventSummary(input: { league: string; eventId: string }, fetcher: typeof fetch = fetch): Promise<EspnSummary> {
  const league = getLeague(input.league);
  if (typeof input.eventId !== "string" || !/^\d{1,15}$/.test(input.eventId)) throw new EspnProviderError("INVALID_INPUT", "Event ID must contain digits only.");
  const url = `${BASE}/${league.sport}/${league.league}/summary?event=${input.eventId}`;
  const data = await readJson(url, fetcher), header = object(data.header), competition = object(list(header.competitions)[0]);
  const event = normalizeEvent(header, league, object(data.gameInfo).venue);
  if (!event || event.id !== input.eventId) throw new EspnProviderError("UPSTREAM_INVALID", "ESPN summary did not match the requested event.");
  const plays: EspnPlay[] = [], seen = new Set<string>();
  const drives = object(data.drives);
  const rawPlays = [
    ...list(data.plays),
    ...list(drives.previous).flatMap((drive) => list(object(drive).plays)),
    ...list(object(drives.current).plays),
    ...list(data.scoringPlays), ...list(data.commentary), ...list(data.keyEvents),
    ...Object.values(object(competition.commentaries)),
  ];
  for (let index = 0; index < rawPlays.length && plays.length < 2000; index++) {
    const play = normalizePlay(rawPlays[index], index);
    if (play && !seen.has(play.id)) { seen.add(play.id); plays.push(play); }
  }
  const fetchedAt = new Date().toISOString(), leaders = collectLeaders(data), statistics = collectStatistics(data, competition);
  const headlines = list(object(data.news).articles).map((article) => text(object(article).headline)).filter((item): item is string => !!item).slice(0, 5);
  return {
    event, fetchedAt, sources: [source(league, url, fetchedAt, "summary", event.id)], plays,
    ...(leaders.length ? { leaders } : {}), ...(statistics.length ? { statistics } : {}), ...(headlines.length ? { headlines } : {}),
  };
}
