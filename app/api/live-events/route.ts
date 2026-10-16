import { discoverLiveEvents } from '../../../lib/analysis/live-discovery';
import { ESPN_LEAGUES } from '../../../lib/analysis/espn';
import { TARGET_SPORTS } from '../../../lib/analysis/sport-rules';
import { jsonResponse } from '../../../lib/matches/http';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sport = params.get('sport') ?? '';
  const allowed = new Set<string>([...TARGET_SPORTS, ...ESPN_LEAGUES.map(l => l.sport)]);
  if (!allowed.has(sport) || [...params.keys()].some(key => key !== 'sport')) return jsonResponse({error: 'Choose a supported sport.'}, 400);
  const result = await discoverLiveEvents({sport});
  const {failedProviders: _, ...publicResult} = result;
  return jsonResponse(publicResult);
}
