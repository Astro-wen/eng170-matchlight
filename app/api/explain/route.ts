import { explainMatch, validateExplainRequest } from "../../../lib/matches/explain";
import { explanationErrorResponse, jsonResponse, readBoundedJson } from "../../../lib/matches/http";

export async function POST(request: Request) {
  try {
    const input = validateExplainRequest(await readBoundedJson(request));
    return jsonResponse(explainMatch(input));
  } catch (error) {
    return explanationErrorResponse(error);
  }
}
