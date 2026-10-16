import type { AnalysisEvent, AnalysisSource, AnalyzeRequest, AnalyzeResult } from "./analysis/types";

export function fitAnalysisImage(width: number, height: number, maxSide = 1600) {
  if (![width, height, maxSide].every((value) => Number.isFinite(value) && value > 0)) throw new Error("Invalid image dimensions");
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** datetime-local is expressed in the device time zone, never implicitly UTC. */
export function captureDateInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function captureDateISO(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || captureDateInput(date) !== value) return null;
  return date.toISOString();
}

export async function prepareAnalysisImage(src: string, signal: AbortSignal): Promise<string> {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { image.onload = null; image.onerror = null; signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); image.src = ""; reject(new DOMException("Aborted", "AbortError")); };
    image.onload = () => { cleanup(); resolve(); };
    image.onerror = () => { cleanup(); reject(new Error("IMAGE_READ_FAILED")); };
    signal.addEventListener("abort", abort, { once: true });
    image.src = src;
  });
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const canvas = document.createElement("canvas");
  const size = fitAnalysisImage(image.naturalWidth, image.naturalHeight);
  canvas.width = size.width; canvas.height = size.height;
  const drawing = canvas.getContext("2d");
  if (!drawing) throw new Error("IMAGE_READ_FAILED");
  drawing.fillStyle = "#ffffff";
  drawing.fillRect(0, 0, size.width, size.height);
  drawing.drawImage(image, 0, 0, size.width, size.height);
  return canvas.toDataURL("image/jpeg", .84);
}

export class PhotoAnalysisError extends Error {
  constructor(message: string, readonly code?: string) { super(message); this.name = "PhotoAnalysisError"; }
}

/** Remote athlete portraits must come from a known sports provider, never a model-supplied host. */
export function safeAthleteImage(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && ["a.espncdn.com", "resources.fina.org"].includes(url.hostname) ? url.href : undefined;
  } catch { return undefined; }
}

function isAnalysisResult(value: unknown): value is AnalyzeResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  const strings = (item: unknown): item is string[] => Array.isArray(item) && item.every((entry) => typeof entry === "string");
  const competitor = (item: unknown) => {
    if (!item || typeof item !== "object") return false;
    const data = item as Record<string, unknown>;
    return typeof data.id === "string" && typeof data.name === "string" &&
      ["country", "score", "image", "profileUrl"].every((key) => data[key] === undefined || typeof data[key] === "string") &&
      (data.rank === undefined || (Number.isInteger(data.rank) && Number(data.rank) > 0));
  };
  const event = (item: unknown) => {
    if (!item || typeof item !== "object") return false;
    const data = item as Record<string, unknown>;
    return ["id", "league", "name", "date"].every((key) => typeof data[key] === "string") && Array.isArray(data.teams) && data.teams.every((team) => team && typeof team === "object" && typeof team.id === "string" && typeof team.name === "string") &&
      (data.competitors === undefined || (Array.isArray(data.competitors) && data.competitors.every(competitor))) &&
      (data.phase === undefined || typeof data.phase === "string") &&
      (data.dataMode === undefined || data.dataMode === "historical" || data.dataMode === "lookup");
  };
  if (!["id", "generatedAt", "capturedAt", "headline", "message"].every((key) => typeof result[key] === "string")) return false;
  if (!["matched", "needs_confirmation", "unmatched"].includes(String(result.outcome)) || !["live", "historical", "scheduled", "unknown"].includes(String(result.temporal))) return false;
  const features = result.features as Record<string, unknown> | undefined;
  if (!features || typeof features.sport !== "string" || !["visibleText", "teams", "athletes", "limitations"].every((key) => strings(features[key]))) return false;
  if (result.event !== null && !event(result.event)) return false;
  if (!Array.isArray(result.candidates) || !result.candidates.every(event)) return false;
  if (!Array.isArray(result.sources) || !result.sources.every((source) => source && typeof source === "object" && ["id", "label", "url", "fetchedAt"].every((key) => typeof source[key] === "string"))) return false;
  if (result.limitations !== undefined && !strings(result.limitations)) return false;
  if (result.coverage !== undefined && (!result.coverage || typeof result.coverage !== "object" || !["sport", "label", "detail"].every((key) => typeof (result.coverage as Record<string, unknown>)[key] === "string"))) return false;
  if (result.mode !== undefined && result.mode !== "live" && result.mode !== "replay") return false;
  if (result.discovery !== undefined) {
    if (!result.discovery || typeof result.discovery !== "object") return false;
    const discovery = result.discovery as Record<string, unknown>;
    if (typeof discovery.checkedAt !== "string" || !Number.isFinite(Date.parse(discovery.checkedAt)) || !Number.isInteger(discovery.activeCount) || Number(discovery.activeCount) < 0 || !["matched", "ambiguous", "empty", "unavailable", "unsupported"].includes(String(discovery.status)) || typeof discovery.detail !== "string") return false;
  }
  if (result.statistics !== undefined && (!Array.isArray(result.statistics) || !result.statistics.every((stat) => stat && typeof stat === "object" && typeof stat.label === "string" && typeof stat.value === "string" && (stat.subject === undefined || typeof stat.subject === "string")))) return false;
  return Array.isArray(result.points) && result.points.every((point) => point && typeof point === "object" && ["id", "title", "summary", "detail"].every((key) => typeof point[key] === "string") && Number.isFinite(point.x) && Number.isFinite(point.y) && ["photo", "provider", "rule"].includes(point.evidence) && strings(point.sourceIds) && (point.athlete === undefined || competitor(point.athlete)));
}

export interface LiveEventsResponse {
  events: AnalysisEvent[];
  sources: AnalysisSource[];
  checkedAt: string;
  status: "ok" | "unavailable" | "unsupported";
  limited: boolean;
}

/** This read-only request prepares a real current-data sample; it never starts image analysis. */
export async function requestLiveEvents(signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<LiveEventsResponse> {
  const response = await fetcher("/api/live-events?sport=cricket", { signal, cache: "no-store" });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new PhotoAnalysisError("LIVE_UNAVAILABLE", "LIVE_UNAVAILABLE");
  if (!value || typeof value !== "object") throw new PhotoAnalysisError("INVALID_RESPONSE");
  const data = value as Record<string, unknown>;
  const eventValid = (event: unknown) => {
    if (!event || typeof event !== "object") return false;
    const item = event as Record<string, unknown>;
    return ["id", "league", "sport", "name", "date"].every((key) => typeof item[key] === "string") && ["scheduled", "live", "final", "unknown"].includes(String(item.status)) && Array.isArray(item.teams) && item.teams.every((team) => team && typeof team === "object" && typeof team.id === "string" && typeof team.name === "string" && (team.score === undefined || typeof team.score === "string"));
  };
  if (!Array.isArray(data.events) || !data.events.every(eventValid) || !Array.isArray(data.sources) || !data.sources.every((source) => source && typeof source === "object" && ["id", "label", "url", "fetchedAt"].every((key) => typeof source[key] === "string")) || typeof data.checkedAt !== "string" || !Number.isFinite(Date.parse(data.checkedAt)) || !["ok", "unavailable", "unsupported"].includes(String(data.status)) || typeof data.limited !== "boolean") throw new PhotoAnalysisError("INVALID_RESPONSE");
  return data as unknown as LiveEventsResponse;
}

/** A local image of provider facts, with explicit provenance rather than a simulated match. */
export function liveEventScorecard(event: AnalysisEvent, checkedAt: string) {
  if (event.status !== "live" || event.teams.length < 2 || !event.teams[0].name.trim() || !event.teams[1].name.trim() || !Number.isFinite(Date.parse(checkedAt))) throw new PhotoAnalysisError("LIVE_NONE_CONFIRMED", "LIVE_NONE_CONFIRMED");
  const xml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
  const stamp = new Date(checkedAt).toISOString();
  const rows = event.teams.slice(0, 2).map((team, index) => {
    const y = 320 + index * 190;
    const size = Math.min(44, Math.max(14, 1750 / Math.max(team.name.length, 1)));
    return `<text x="70" y="${y}" fill="#fff" font-size="${size}" font-weight="700">${xml(team.name)}</text><text x="70" y="${y + 83}" fill="${index ? "#49c9f0" : "#ff63b9"}" font-size="65" font-weight="800">${xml(team.score ?? "Score not provided")}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="853" viewBox="0 0 1280 853"><rect width="1280" height="853" fill="#111720"/><rect width="1280" height="12" fill="#ff018f"/><g font-family="Arial,sans-serif"><text x="70" y="90" fill="#ff63b9" font-size="25" font-weight="700">LIVE / CRICKET / ${xml(stamp.slice(0, 10))}</text><text x="70" y="153" fill="#fff" font-size="25" font-weight="700">${xml(event.name)}</text><text x="70" y="198" fill="#aebdd0" font-size="19">${xml(event.statusDetail || event.clock || event.league)}</text><path d="M70 242h1140M70 670h1140" stroke="#fff" stroke-opacity=".2"/>${rows}<text x="70" y="724" fill="#aebdd0" font-size="19">ESPN DATA CHECKED ${xml(stamp)}</text><text x="70" y="774" fill="#fff" font-size="18">RECREATED FROM ESPN CURRENT DATA / NOT A CAMERA PHOTO</text><text x="70" y="813" fill="#8597ad" font-size="16">A snapshot of the provider response. Scores can change after this check.</text></g></svg>`;
}

export async function requestPhotoAnalysis(request: AnalyzeRequest, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<AnalyzeResult> {
  const response = await fetcher("/api/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...request, mode: request.mode ?? "live" }), signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body && typeof body === "object" ? body as { error?: unknown; code?: unknown } : {};
    throw new PhotoAnalysisError(typeof error.error === "string" ? error.error : "ANALYSIS_FAILED", typeof error.code === "string" ? error.code : undefined);
  }
  if (!isAnalysisResult(body)) throw new PhotoAnalysisError("INVALID_RESPONSE");
  return body;
}
