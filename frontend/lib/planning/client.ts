import type { ProposedGoalInput } from "@/lib/contracts/planning";

/**
 * No planning endpoint is documented. This function does not fetch.
 * Timeout, network, and server-error handling for a verified route lives in
 * src/lib/health/check.ts (GET /api/health).
 */
export type PlanningClientResult = {
  status: "not_configured";
  checkedAt: string;
};

export async function submitPlanningDraft(draft: ProposedGoalInput): Promise<PlanningClientResult> {
  if (draft.title.trim().length === 0) {
    throw new Error("Refusing to check an empty draft.");
  }
  return {
    status: "not_configured",
    checkedAt: new Date().toISOString(),
  };
}
