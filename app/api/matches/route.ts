import { getMatchSummaries } from "../../../lib/matches/data";
import { jsonResponse } from "../../../lib/matches/http";

export async function GET() {
  return jsonResponse({ matches: getMatchSummaries() });
}
