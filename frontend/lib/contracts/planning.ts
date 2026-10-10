/** Contracts for AURA's local planning API and the richer browser-only draft UI. */

export const CONTRACT_STATUS = {
  planning: "verified_local_api",
  verifiedEndpoints: [
    {
      method: "POST" as const,
      path: "/api/plan",
      successStatus: 202,
    },
  ],
} as const;

export type PlanRequest = {
  goal: string;
  budget: number | null;
  target_date: string | null;
  commitments: string[];
};

export type GeneratedPlanStep = {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  day_offset: number | null;
  duration_days: number | null;
  estimated_cost: number | null;
};

export type GeneratedPlan = {
  goal: string;
  budget: number | null;
  target_date: string | null;
  commitments: string[];
  summary: string;
  steps: GeneratedPlanStep[];
  tips: string[];
  warnings: string[];
};

export type PlanSuccessResponse = {
  status: "accepted";
  plan: GeneratedPlan;
};

export type PlanApiError = {
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
};

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
