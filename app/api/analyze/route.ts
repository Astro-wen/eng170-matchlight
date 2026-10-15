import { analyzePhoto } from '../../../lib/analysis/analyze';
import { AnalysisError, runtimeAnalysisConfig } from '../../../lib/analysis/config';
import { validateAnalyzeRequest } from '../../../lib/analysis/request';
import { jsonResponse, readBoundedJson } from '../../../lib/matches/http';
import { ExplanationError } from '../../../lib/matches/explain';
let active = 0;
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return jsonResponse({error:'This request must come from Matchlight.',code:'INVALID_ORIGIN'},403);
  if (active >= 4) return jsonResponse({error:'Analysis is busy. Please try again shortly.',code:'BUSY'},429);
  active++;
  try {
    const config = await runtimeAnalysisConfig();
    if (!config) return jsonResponse({error:'Photo analysis is not configured yet.',code:'NOT_CONFIGURED'},503);
    const input=validateAnalyzeRequest(await readBoundedJson(request,2_610_000));
    return jsonResponse(await analyzePhoto(input,config));
  } catch (error) {
    if (error instanceof AnalysisError || error instanceof ExplanationError) return jsonResponse({error:error.message,code:error instanceof AnalysisError?error.code:'INVALID_INPUT'},error.status);
    return jsonResponse({error:'Unable to analyze this photo. Please try again.',code:'ANALYSIS_UNAVAILABLE'},502);
  } finally { active--; }
}
