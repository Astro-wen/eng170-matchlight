import { ExplanationError } from "./explain";

export function jsonResponse(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function readBoundedJson(request: Request, maxBytes = 8192): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")?.trim() ?? "")) {
    throw new ExplanationError("Content-Type must be application/json.", 415);
  }
  const declaredBytes = Number(request.headers.get("content-length"));
  if (declaredBytes > maxBytes) throw new ExplanationError("Request body is too large.", 413);
  if (!request.body) throw new ExplanationError("A JSON request body is required.", 400);
  const reader = request.body.getReader();
  let count = 0;
  let body = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > maxBytes) {
        await reader.cancel();
        throw new ExplanationError("Request body is too large.", 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body);
  } catch (error) {
    if (error instanceof ExplanationError) throw error;
    throw new ExplanationError("Request body must be valid UTF-8 JSON.", 400);
  } finally {
    reader.releaseLock();
  }
}

export function explanationErrorResponse(error: unknown) {
  if (error instanceof ExplanationError) return jsonResponse({ error: error.message }, error.status);
  return jsonResponse({ error: "Unable to explain this moment. Please try again." }, 500);
}
