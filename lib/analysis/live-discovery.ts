import { ESPN_LEAGUES, fetchScoreboard } from './espn';
import { fetchCricketScoreboard } from './espn-cricket';
import { discoverCurrentAquatics } from './current-aquatics';
import { discoverCurrentOlympics } from './current-olympics';
import { isIndividualSport, normalizeSport } from './sport-rules';
import type { AnalysisEvent, AnalysisSource } from './types';

export interface LiveSearch {
  events: AnalysisEvent[];
  sources: AnalysisSource[];
  checkedAt: string;
  status: 'ok' | 'unavailable' | 'unsupported';
  limited: boolean;
  failedProviders: string[];
}

/** Provider state is necessary; a clock, today's schedule, or an IsLive flag is insufficient. */
export function isCurrentEvent(event: AnalysisEvent, asOf: string): boolean {
  const age = Date.parse(asOf) - Date.parse(event.date);
  return event.status === 'live' && event.dataMode !== 'historical' && Number.isFinite(age)
    && age >= -5 * 60_000 && age <= (event.sport === 'cricket' ? 7 * 86_400_000 : 18 * 3_600_000);
}

/** asOf is internal/test context. The HTTP route always uses the server's current clock. */
export async function discoverLiveEvents(input: {sport: string; league?: string | null; query?: string; asOf?: string}, fetcher: typeof fetch = fetch): Promise<LiveSearch> {
  const checkedAt = input.asOf ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(checkedAt))) throw new Error('Invalid discovery time');
  const sport = normalizeSport(input.sport);
  const day = checkedAt.slice(0, 10);
  const jobs: Array<{name: string; run: Promise<{events: AnalysisEvent[]; sources: AnalysisSource[]; limited?: boolean;failed?:boolean}>}> = [];
  let limited = false;
  if (isIndividualSport(sport)) {
    jobs.push({name: 'ESPN Olympic current results', run: discoverCurrentOlympics({sport, asOf: checkedAt}, fetcher)});
    if (sport === 'diving' || sport === 'swimming') jobs.push({name: 'World Aquatics current events', run: discoverCurrentAquatics({sport, asOf: checkedAt, query: input.query}, fetcher)});
  } else if (sport === 'cricket') {
    jobs.push({name: 'ESPN current cricket', run: fetchCricketScoreboard({date: day}, fetcher)});
  } else {
    const known = ESPN_LEAGUES.filter(l => l.sport === sport);
    const leagues = known.some(l => l.key === input.league) ? known.filter(l => l.key === input.league) : known.slice(0, 4);
    limited = !known.some(l=>l.key===input.league) && leagues.length < known.length;
    // ESPN's league schedule can belong to the preceding US day while UTC is already tomorrow.
    const days = [day, new Date(Date.parse(day + 'T12:00:00Z') - 86_400_000).toISOString().slice(0, 10)];
    for (const league of leagues) for (const date of days) jobs.push({name: `ESPN ${league.label} ${date}`, run: fetchScoreboard({league: league.key, date}, fetcher)});
  }
  if (!jobs.length) return {events: [], sources: [], checkedAt, status: 'unsupported', limited: true, failedProviders: []};
  const results = await Promise.allSettled(jobs.map(job => job.run));
  const events = new Map<string, AnalysisEvent>(), sources = new Map<string, AnalysisSource>();
  const failedProviders: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') { failedProviders.push(jobs[i].name); limited = true; return; }
    if(result.value.failed){failedProviders.push(jobs[i].name+' detail');limited=true;}
    limited ||= result.value.limited === true;
    for (const source of result.value.sources) sources.set(source.id, source);
    for (const event of result.value.events) if (event.sport === sport && isCurrentEvent(event, checkedAt)) events.set(`${event.league}:${event.id}`, event);
  });
  return {events: [...events.values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)), sources: [...sources.values()], checkedAt,
    status: !events.size && failedProviders.length ? 'unavailable' : 'ok', limited, failedProviders};
}
