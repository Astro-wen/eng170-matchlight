import type { AnalyzeRequest, AnalyzeResult } from "./analysis/types";

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

function isAnalysisResult(value: unknown): value is AnalyzeResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  const strings = (item: unknown): item is string[] => Array.isArray(item) && item.every((entry) => typeof entry === "string");
  const event = (item: unknown) => {
    if (!item || typeof item !== "object") return false;
    const data = item as Record<string, unknown>;
    return ["id", "league", "name", "date"].every((key) => typeof data[key] === "string") && Array.isArray(data.teams) && data.teams.every((team) => team && typeof team === "object" && typeof team.id === "string" && typeof team.name === "string");
  };
  if (!["id", "generatedAt", "capturedAt", "headline", "message"].every((key) => typeof result[key] === "string")) return false;
  if (!["matched", "needs_confirmation", "unmatched"].includes(String(result.outcome)) || !["live", "historical", "scheduled", "unknown"].includes(String(result.temporal))) return false;
  const features = result.features as Record<string, unknown> | undefined;
  if (!features || typeof features.sport !== "string" || !["visibleText", "teams", "athletes", "limitations"].every((key) => strings(features[key]))) return false;
  if (result.event !== null && !event(result.event)) return false;
  if (!Array.isArray(result.candidates) || !result.candidates.every(event)) return false;
  if (!Array.isArray(result.sources) || !result.sources.every((source) => source && typeof source === "object" && ["id", "label", "url", "fetchedAt"].every((key) => typeof source[key] === "string"))) return false;
  return Array.isArray(result.points) && result.points.every((point) => point && typeof point === "object" && ["id", "title", "summary", "detail"].every((key) => typeof point[key] === "string") && Number.isFinite(point.x) && Number.isFinite(point.y) && (point.evidence === "photo" || point.evidence === "provider") && strings(point.sourceIds));
}

export async function requestPhotoAnalysis(request: AnalyzeRequest, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<AnalyzeResult> {
  const response = await fetcher("/api/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body && typeof body === "object" ? body as { error?: unknown; code?: unknown } : {};
    throw new PhotoAnalysisError(typeof error.error === "string" ? error.error : "ANALYSIS_FAILED", typeof error.code === "string" ? error.code : undefined);
  }
  if (!isAnalysisResult(body)) throw new PhotoAnalysisError("INVALID_RESPONSE");
  return body;
}
