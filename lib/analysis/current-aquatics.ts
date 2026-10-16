import type { AnalysisSource } from './types';
import type { IndividualEvent } from './individual-types';
import { AquaticsProviderError, fetchAquaticsPhases } from './world-aquatics';

const BASE = 'https://api.worldaquatics.com/fina/results/live';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 4 * 1024 * 1024;
const CACHE_MS = 30_000;
type Obj = Record<string, unknown>;
interface Strip { data: Obj; source: AnalysisSource }
let caches = new WeakMap<typeof fetch, Map<string, { value: Strip; expires: number }>>();
export function resetCurrentAquaticsCache(): void { caches = new WeakMap(); }
function obj(value: unknown): Obj { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {}; }
function arr(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function utc(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return undefined;
  const iso = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  return Number.isFinite(Date.parse(iso)) ? new Date(iso).toISOString() : undefined;
}
function validAsOf(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  return new Date(value).toISOString().slice(0, 10) === value.slice(0, 10);
}
async function fetchStrip(asOf: number, fetcher: typeof fetch): Promise<Strip> {
  const day = new Date(asOf).toISOString().slice(0, 10);
  const before = new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const after = new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  // These are the same date filters used by the official global-results widget.
  const url = `${BASE}?${new URLSearchParams({ venueDateFrom: `${before}T00:00:00Z`, venueDateTo: `${after}T23:59:00Z` })}`;
  let cache = caches.get(fetcher);
  if (!cache) { cache = new Map(); caches.set(fetcher, cache); }
  const stored = cache.get(url);
  if (stored && stored.expires > Date.now()) return structuredClone(stored.value);
  const controller = new AbortController(); let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 10_000);
  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json' }, redirect: 'manual', signal: controller.signal });
    if (!response.ok) throw new AquaticsProviderError('UPSTREAM_HTTP', 'Current World Aquatics results are unavailable.', response.status);
    if (!response.body || Number(response.headers.get('content-length')) > MAX_BYTES) throw new AquaticsProviderError('UPSTREAM_INVALID', 'Current World Aquatics results exceeded the size limit.');
    const reader = response.body.getReader(), decoder = new TextDecoder(); let bytes = 0, text = '';
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) { await reader.cancel(); throw new AquaticsProviderError('UPSTREAM_INVALID', 'Current World Aquatics results exceeded the size limit.'); }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
    let data: Obj;
    try { data = obj(JSON.parse(text)); }
    catch { throw new AquaticsProviderError('UPSTREAM_INVALID', 'Current World Aquatics results contained invalid JSON.'); }
    if (!Array.isArray(data.content)) throw new AquaticsProviderError('UPSTREAM_INVALID', 'Current World Aquatics competition list is missing.');
    const value: Strip = { data, source: { id: `worldaquatics-current-${day}`, label: 'World Aquatics current competitions and phase status', url, fetchedAt: new Date().toISOString() } };
    if (bytes <= 512 * 1024) {
      if (cache.size >= 4) cache.delete(cache.keys().next().value!);
      cache.set(url, { value: structuredClone(value), expires: Date.now() + CACHE_MS });
    }
    return value;
  } catch (error) {
    if (error instanceof AquaticsProviderError) throw error;
    if (timedOut || error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) throw new AquaticsProviderError('UPSTREAM_TIMEOUT', 'Current World Aquatics results did not respond in time.');
    throw new AquaticsProviderError('UPSTREAM_HTTP', 'Current World Aquatics results could not be reached.');
  } finally { clearTimeout(timer); }
}
function queryScore(query: string, text: string): number {
  const terms = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const tokens = new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  return terms.filter((term) => term.length > 1 && tokens.has(term)).length;
}

export interface CurrentAquaticsResult {
  /** Only recent, non-summary phases with an explicit LIVE result status. */
  events: IndividualEvent[];
  /** Actual phase records for today's completed, planned, or unverified events. */
  schedule: IndividualEvent[];
  sources: AnalysisSource[];
  limited: boolean;
  /** At least one required phase lookup failed; distinct from a successful empty live list. */
  failed?: boolean;
}

/** Current public feed discovery. asOf is for server/test use; never accept it from a photo request. */
export async function discoverCurrentAquatics(input: { sport: 'diving' | 'swimming'; asOf?: string; query?: string }, fetcher: typeof fetch = fetch): Promise<CurrentAquaticsResult> {
  if (!['diving', 'swimming'].includes(input.sport) || input.asOf !== undefined && !validAsOf(input.asOf) || input.query !== undefined && (typeof input.query !== 'string' || input.query.length > 1000)) throw new AquaticsProviderError('INVALID_INPUT', 'Choose a supported aquatic sport and valid internal discovery context.');
  const asOf = input.asOf === undefined ? Date.now() : Date.parse(input.asOf);
  const date = new Date(asOf).toISOString().slice(0, 10), code = input.sport === 'diving' ? 'DV' : 'SW';
  const strip = await fetchStrip(asOf, fetcher), sources = new Map([[strip.source.id, strip.source]]);
  const competitions = arr(strip.data.content);
  let limited = competitions.length > 20 || Number(obj(strip.data.pageInfo).numPages) > 1;
  const disciplines = new Map<string, number>();
  for (const raw of competitions.slice(0, 20)) {
    const competition = obj(raw), schedule = arr(competition.schedule);
    if (schedule.length > 1000) limited = true;
    for (const rawItem of schedule.slice(0, 1000)) {
      const item = obj(rawItem), id = item.disciplineId, start = utc(item.utcDateTime);
      if (item.sportCode !== code) continue;
      if (typeof id !== 'string' || !UUID.test(id) || !start) { limited = true; continue; }
      const freshLive = (status: unknown, timestamp: unknown) => {
        const time = utc(timestamp), elapsed = time ? asOf - Date.parse(time) : Infinity;
        return status === 'LIVE' && elapsed >= 0 && elapsed <= 18 * 60 * 60 * 1000;
      };
      const reportedLive = freshLive(item.resultStatus, start) || arr(obj(item.events).Heats).some((heat) => {
        const phase = obj(heat); return phase.IsSummary !== true && freshLive(phase.ResultStatus, phase.UtcDateTime);
      });
      if (start.slice(0, 10) !== date && !reportedLive) continue;
      const elapsed = asOf - Date.parse(start), future = elapsed < 0;
      const text = `${competition.officialName ?? ''} ${item.disciplineName ?? ''} ${item.phaseName ?? ''} ${item.name ?? ''}`;
      const priority = (reportedLive ? 1_000_000_000 : future ? 1_000_000 : 0) + queryScore(input.query ?? '', text) * 1000 - Math.min(Math.abs(elapsed) / 60_000, 1000);
      const key = id.toLowerCase(); disciplines.set(key, Math.max(disciplines.get(key) ?? -Infinity, priority));
    }
  }
  const ordered = [...disciplines].sort((a, b) => b[1] - a[1]);
  if (ordered.length > 4) limited = true;
  const results = await Promise.allSettled(ordered.slice(0, 4).map(async ([disciplineId]) => fetchAquaticsPhases({ disciplineId, asOf: new Date(asOf).toISOString() }, fetcher)));
  const events = new Map<string, IndividualEvent>(), schedule = new Map<string, IndividualEvent>();
  let failed = false;
  for (const result of results) {
    if (result.status === 'rejected') { limited = true; failed = true; continue; }
    if (result.value.limited) limited = true;
    result.value.sources.forEach((source) => sources.set(source.id, source));
    for (const event of result.value.events) {
      if (event.sport !== input.sport) { limited = true; continue; }
      if (event.status === 'live') events.set(event.id, event);
      else if (event.date.slice(0, 10) === date) schedule.set(event.id, event);
    }
  }
  return { events: [...events.values()].sort((a, b) => a.date.localeCompare(b.date)), schedule: [...schedule.values()].sort((a, b) => a.date.localeCompare(b.date)), sources: [...sources.values()], limited, ...(failed ? { failed: true } : {}) };
}
