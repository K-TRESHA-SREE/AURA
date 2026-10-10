import type {
  PlanApiError,
  PlanRequest,
  PlanSuccessResponse,
  ProposedGoalInput,
} from "@/lib/contracts/planning";

export const AURA_API_BASE_URL = (process.env.NEXT_PUBLIC_AURA_API_BASE_URL ?? "http://127.0.0.1:8000")
  .trim()
  .replace(/\/$/, "");
export const PLAN_PATH = "/api/plan";
export const PLAN_TIMEOUT_MS = 70_000;

export type PlanningClientResult = PlanSuccessResponse & { receivedAt: string; checkedAt: string };

export class PlanningApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: PlanApiError["details"],
  ) {
    super(message);
    this.name = "PlanningApiError";
  }
}

function commitmentText(item: ProposedGoalInput["commitments"][number]): string {
  const date = item.date ? ` on ${item.date}` : " (date not specified)";
  const times = item.startMinutes !== null && item.endMinutes !== null
    ? ` from ${clockText(item.startMinutes)} to ${clockText(item.endMinutes)}`
    : "";
  return `${item.title}${date}${times}`;
}

function clockText(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function toPlanRequest(draft: ProposedGoalInput): PlanRequest {
  const context = [
    draft.successCriteria ? `What done looks like: ${draft.successCriteria}` : "",
    `Available time: ${draft.weeklyHours} hours per week`,
    draft.hasBudget && draft.currency ? `Budget currency: ${draft.currency}` : "",
    draft.locationLabel ? `Location context: ${draft.locationLabel}` : "",
    ...draft.budgetItems.map((item) =>
      `Budget note: ${item.label} — ${item.amountMinor === null ? "amount unknown" : `${(item.amountMinor / 100).toFixed(2)} ${item.currency ?? "currency unspecified"}`}`,
    ),
  ].filter(Boolean);

  return {
    goal: [draft.title.trim(), ...context].join("\n"),
    budget: draft.hasBudget && draft.budgetCapMinor !== null ? draft.budgetCapMinor / 100 : null,
    target_date: draft.targetDate || null,
    commitments: draft.commitments.map(commitmentText),
  };
}

function isPlanSuccess(value: unknown): value is PlanSuccessResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<PlanSuccessResponse>;
  const plan = response.plan;
  if (response.status !== "accepted" || !plan || typeof plan !== "object") return false;
  const nullableFinite = (item: unknown) => item === null || (typeof item === "number" && Number.isFinite(item));
  const validSteps = Array.isArray(plan.steps) && plan.steps.every((step) => {
    if (!step || typeof step !== "object") return false;
    const item = step as PlanSuccessResponse["plan"]["steps"][number];
    return typeof item.title === "string" && typeof item.description === "string" &&
      ["high", "medium", "low"].includes(item.priority) &&
      (item.day_offset === null || (Number.isInteger(item.day_offset) && item.day_offset >= 0)) &&
      (item.duration_days === null || (Number.isInteger(item.duration_days) && item.duration_days > 0)) &&
      nullableFinite(item.estimated_cost) && (item.estimated_cost === null || item.estimated_cost >= 0);
  });
  return typeof plan.goal === "string" && nullableFinite(plan.budget) &&
    (plan.budget === null || plan.budget >= 0) &&
    (plan.target_date === null || typeof plan.target_date === "string") &&
    Array.isArray(plan.commitments) && plan.commitments.every((item) => typeof item === "string") &&
    typeof plan.summary === "string" && validSteps && Array.isArray(plan.tips) &&
    plan.tips.every((item) => typeof item === "string") && Array.isArray(plan.warnings) &&
    plan.warnings.every((item) => typeof item === "string");
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function submitPlanningDraft(draft: ProposedGoalInput): Promise<PlanningClientResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PLAN_TIMEOUT_MS);
  let response: Response;
  let body: unknown;
  try {
    response = await fetch(`${AURA_API_BASE_URL}${PLAN_PATH}`, {
      method: "POST",
      // The backend preflight allowlist permits Content-Type only.
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPlanRequest(draft)),
      signal: controller.signal,
      cache: "no-store",
    });
    body = await readJson(response);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new PlanningApiError("The planning request timed out. Check the backend/model and try again.", 0, "client_timeout");
    }
    throw new PlanningApiError(
      `Could not reach the AURA backend at ${AURA_API_BASE_URL}. Make sure the backend is running and this frontend origin is allowed by AURA_CORS_ORIGINS, then retry.`,
      0,
      "network_error",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = body && typeof body === "object" ? (body as { error?: PlanApiError }).error : undefined;
    const fallback = response.status === 503
      ? "The AURA backend or local model is unavailable. Start Ollama and retry."
      : response.status === 504
        ? "The model took too long to respond. Retry when the local model is ready."
        : `Planning request failed with HTTP ${response.status}.`;
    throw new PlanningApiError(error?.message ?? fallback, response.status, error?.code, error?.details);
  }

  if (!isPlanSuccess(body)) {
    throw new PlanningApiError("The backend returned an unexpected plan response. Please retry.", response.status, "invalid_response");
  }
  const receivedAt = new Date().toISOString();
  return { ...body, receivedAt, checkedAt: receivedAt };
}
