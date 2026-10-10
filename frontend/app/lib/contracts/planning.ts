/**
 * Planning contract — PROPOSAL, not a verified agreement.
 *
 * Inspection of this repository found:
 * - no frontend/ directory, OpenAPI document, shared schema package, or Team Member 2 contract
 * - one route handler: GET /api/health in src/app/api/health/route.ts
 *   success body { ok: true }; failure body { ok: false } with HTTP 500
 *
 * Do not send these types to a backend. Do not treat sample fixtures as live model output.
 */

export const CONTRACT_STATUS = {
  planning: "unverified_proposal",
  verifiedEndpoints: [
    {
      method: "GET" as const,
      path: "/api/health",
      successBody: "{ ok: true }",
      failureBody: "{ ok: false }",
      failureStatus: 500,
    },
  ],
} as const;

export type SuggestionOrigin = "model_suggestion" | "deterministic_validation";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "CAD";

export const CURRENCY_CODES = ["USD", "EUR", "GBP", "CAD"] as const satisfies readonly CurrencyCode[];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value);
}

export type ProposedCommitment = {
  id: string;
  title: string;
  /** Calendar date YYYY-MM-DD, or null when not provided. */
  date: string | null;
  /** Minutes from local midnight, or null when not provided. */
  startMinutes: number | null;
  endMinutes: number | null;
};

export type ProposedBudgetLine = {
  id: string;
  label: string;
  currency: string | null;
  /** Integer minor units. Null when the amount was not provided. */
  amountMinor: number | null;
};

export type ProposedGoalInput = {
  title: string;
  successCriteria: string;
  targetDate: string;
  weeklyHours: number;
  hasBudget: boolean;
  currency: CurrencyCode | null;
  /** Integer minor units. Null when no cap was entered. */
  budgetCapMinor: number | null;
  budgetItems: ProposedBudgetLine[];
  locationLabel: string | null;
  commitments: ProposedCommitment[];
};

export type ProposedMilestone = {
  id: string;
  title: string;
  suggestedDeadline: string | null;
  origin: SuggestionOrigin;
  note: string | null;
};

export type ProposedTask = {
  id: string;
  title: string;
  milestoneId: string | null;
  date: string | null;
  startMinutes: number | null;
  endMinutes: number | null;
  suggestedDeadline: string | null;
  origin: SuggestionOrigin;
};

export type ProposedNote = {
  id: string;
  text: string;
  origin: SuggestionOrigin;
};

export type ProposedWarning = ProposedNote & {
  severity: "info" | "warning";
};

export type ProposedBudgetItem = ProposedBudgetLine & {
  origin: SuggestionOrigin;
};

export type ProposedLocation = {
  id: string;
  label: string | null;
  origin: SuggestionOrigin;
};

export type ProposedPlanResult = {
  /** Remains sample_fixture until a response schema is verified. */
  source: "sample_fixture";
  summary: string;
  summaryOrigin: SuggestionOrigin;
  milestones: ProposedMilestone[];
  tasks: ProposedTask[];
  assumptions: ProposedNote[];
  warnings: ProposedWarning[];
  budgetItems: ProposedBudgetItem[];
  locations: ProposedLocation[];
  knownCommitments: ProposedCommitment[];
};
