import { jsonResponse } from "../../../lib/matches/http";

export async function GET() {
  return jsonResponse({ ok: true, version: "0.1.0", aiConfigured: false });
}
