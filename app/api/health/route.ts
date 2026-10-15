import { jsonResponse } from '../../../lib/matches/http';
import { getRuntimeAIConfig } from '../../../lib/ai-explanation';
import { runtimeAnalysisConfig } from '../../../lib/analysis/config';
export async function GET() {
  const analysis=await runtimeAnalysisConfig();
  return jsonResponse({ok:true,version:'0.2.0',aiConfigured:Boolean(analysis || await getRuntimeAIConfig()),photoAnalysisConfigured:Boolean(analysis),decisionConfigured:Boolean(analysis?.jevKey)});
}
