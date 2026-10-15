export interface AnalysisConfig { openrouterKey: string; visionModel: string; explanationModel: string; jevKey?: string; jevModel: string }
export function analysisConfig(env: Record<string, string | undefined>): AnalysisConfig | null {
  if (!env.OPENROUTER_API_KEY) return null;
  return { openrouterKey: env.OPENROUTER_API_KEY, visionModel: env.MATCHLIGHT_VISION_MODEL || 'google/gemini-3-flash-preview', explanationModel: env.MATCHLIGHT_ANALYSIS_MODEL || env.MATCHLIGHT_VISION_MODEL || 'google/gemini-3-flash-preview', jevKey: env.TYPESAFE_API_KEY, jevModel: env.MATCHLIGHT_JEV_MODEL || 'jev-latest' };
}
export async function runtimeAnalysisConfig(): Promise<AnalysisConfig | null> {
  let env: Record<string, string | undefined> = process.env;
  try { const runtime = await import('cloudflare:workers'); env = { ...env, ...(runtime.env as unknown as Record<string, string | undefined>) }; } catch { /* Local Node tests. */ }
  return analysisConfig(env);
}
export class AnalysisError extends Error {
  constructor(public code: string, message: string, public status = 502) { super(message); this.name = 'AnalysisError'; }
}
