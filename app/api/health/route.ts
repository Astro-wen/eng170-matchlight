import { jsonResponse } from "../../../lib/matches/http";
import { getRuntimeAIConfig } from "../../../lib/ai-explanation";

export async function GET() {
  return jsonResponse({ ok: true, version: "0.1.0", aiConfigured: Boolean(await getRuntimeAIConfig()) });
}
