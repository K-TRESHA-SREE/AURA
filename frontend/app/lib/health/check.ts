/** Verified route: GET /api/health → { ok: true } or { ok: false } with HTTP 500. */
export const HEALTH_PATH = "/api/health";
export const HEALTH_TIMEOUT_MS = 4000;

export type HealthCheck =
  | { status: "checking" }
  | { status: "ok"; elapsedMs: number }
  | { status: "server_error"; elapsedMs: number; httpStatus: number }
  | { status: "timeout" }
  | { status: "network" }
  | { status: "invalid"; elapsedMs: number; httpStatus: number };

export async function checkHealth(timeoutMs = HEALTH_TIMEOUT_MS): Promise<Exclude<HealthCheck, { status: "checking" }>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(HEALTH_PATH, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    const elapsedMs = Date.now() - started;
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      return { status: "invalid", elapsedMs, httpStatus: response.status };
    }
    const ok =
      typeof parsed === "object" &&
      parsed !== null &&
      "ok" in parsed &&
      (parsed as { ok: unknown }).ok === true;
    if (response.ok && ok) return { status: "ok", elapsedMs };
    if (!response.ok) return { status: "server_error", elapsedMs, httpStatus: response.status };
    return { status: "invalid", elapsedMs, httpStatus: response.status };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return { status: "timeout" };
    return { status: "network" };
  } finally {
    clearTimeout(timer);
  }
}
