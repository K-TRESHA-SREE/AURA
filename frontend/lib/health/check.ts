import { AURA_API_BASE_URL, PLAN_PATH } from "@/lib/planning/client";

/** A GET to the known planning path returns 405, confirming the backend is reachable without running inference. */
export const HEALTH_PATH = `${AURA_API_BASE_URL}${PLAN_PATH}`;
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
    const errorCode = typeof parsed === "object" && parsed !== null && "error" in parsed
      ? (parsed as { error?: { code?: unknown } }).error?.code
      : undefined;
    if (response.status === 405 && errorCode === "method_not_allowed") return { status: "ok", elapsedMs };
    if (!response.ok) return { status: "server_error", elapsedMs, httpStatus: response.status };
    return { status: "invalid", elapsedMs, httpStatus: response.status };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return { status: "timeout" };
    return { status: "network" };
  } finally {
    clearTimeout(timer);
  }
}
