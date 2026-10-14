import { getMatch } from "../../../../lib/matches/data";
import { jsonResponse } from "../../../../lib/matches/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const match = getMatch(id);
  return match ? jsonResponse({ match }) : jsonResponse({ error: "Match not found." }, 404);
}
