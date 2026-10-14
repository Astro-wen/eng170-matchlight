import { explainMatch, validateExplainRequest } from "../../../lib/matches/explain";
import { explanationErrorResponse, jsonResponse, readBoundedJson } from "../../../lib/matches/http";
import { enhanceExplanation, getRuntimeAIConfig } from "../../../lib/ai-explanation";
import { getMatch } from "../../../lib/matches/data";

export async function POST(request: Request) {
  try {
    const input = validateExplainRequest(await readBoundedJson(request));
    const grounded = explainMatch(input);
    const match = getMatch(input.matchId)!;
    return jsonResponse(await enhanceExplanation(input, match, grounded, await getRuntimeAIConfig()));
  } catch (error) {
    return explanationErrorResponse(error);
  }
}
