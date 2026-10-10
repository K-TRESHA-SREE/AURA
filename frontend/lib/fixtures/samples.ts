import type { ProposedPlanResult } from "@/lib/contracts/planning";
import type { GoalDraft } from "@/lib/planning/validate";

/**
 * SAMPLE FIXTURES — not live user data and not model output.
 * Isolated from API routes. Do not import this module from src/app/api or src/db.
 * Sample clock is frozen at 2026-10-10 so the board does not depend on a goals endpoint.
 */

export const SAMPLE_AS_OF = "2026-10-10";

export const SAMPLE_PLAN: ProposedPlanResult = {
  source: "sample_fixture",
  summary:
    "Hold a small open studio on 15 January 2027. Invite a short list, print a few invitations, and keep setup inside a Thursday morning block.",
  summaryOrigin: "model_suggestion",
  milestones: [
    {
      id: "m-cap",
      title: "Decide the guest cap",
      suggestedDeadline: "2026-10-16",
      origin: "model_suggestion",
      note: "Sample milestone only.",
    },
    {
      id: "m-invite",
      title: "Send the invitations",
      suggestedDeadline: "2026-11-06",
      origin: "model_suggestion",
      note: null,
    },
    {
      id: "m-room",
      title: "Confirm the room layout",
      suggestedDeadline: "2026-11-20",
      origin: "model_suggestion",
      note: null,
    },
    {
      id: "m-supplies",
      title: "Final supply check",
      suggestedDeadline: "2027-01-08",
      origin: "model_suggestion",
      note: null,
    },
    {
      id: "m-thanks",
      title: "Write thank-you notes",
      suggestedDeadline: null,
      origin: "model_suggestion",
      note: "Deadline not provided in the fixture.",
    },
  ],
  tasks: [
    {
      id: "t-cap",
      title: "Confirm the guest cap",
      milestoneId: "m-cap",
      date: "2026-10-16",
      startMinutes: null,
      endMinutes: null,
      suggestedDeadline: "2026-10-16",
      origin: "model_suggestion",
    },
    {
      id: "t-price",
      title: "Price the invitations",
      milestoneId: "m-invite",
      date: "2026-10-22",
      startMinutes: 10 * 60,
      endMinutes: 11 * 60,
      suggestedDeadline: "2026-10-22",
      origin: "model_suggestion",
    },
    {
      id: "t-walk",
      title: "Walk the room",
      milestoneId: "m-room",
      date: "2026-10-22",
      startMinutes: 12 * 60,
      endMinutes: 13 * 60,
      suggestedDeadline: "2026-10-22",
      origin: "model_suggestion",
    },
    {
      id: "t-rain",
      title: "Write a backup rain note",
      milestoneId: "m-room",
      date: null,
      startMinutes: null,
      endMinutes: null,
      suggestedDeadline: null,
      origin: "model_suggestion",
    },
    {
      id: "t-flowers",
      title: "Order flowers",
      milestoneId: "m-supplies",
      date: "2026-11-06",
      startMinutes: null,
      endMinutes: null,
      suggestedDeadline: "2026-11-06",
      origin: "model_suggestion",
    },
  ],
  assumptions: [
    {
      id: "a-room",
      text: "Assumes the studio can host 25 people without a rental fee.",
      origin: "model_suggestion",
    },
  ],
  warnings: [
    {
      id: "w-cap",
      text: "A guest list over 30 is outside this sample and was not checked.",
      origin: "model_suggestion",
      severity: "warning",
    },
  ],
  budgetItems: [
    { id: "b-print", label: "Invitation print", currency: "USD", amountMinor: 8500, origin: "model_suggestion" },
    { id: "b-flowers", label: "Flowers", currency: "USD", amountMinor: 6400, origin: "model_suggestion" },
    { id: "b-paper", label: "Imported paper sample", currency: "EUR", amountMinor: 1500, origin: "model_suggestion" },
    { id: "b-room", label: "Room refresh", currency: "USD", amountMinor: null, origin: "model_suggestion" },
    { id: "b-snacks", label: "Snacks", currency: null, amountMinor: 2200, origin: "model_suggestion" },
  ],
  locations: [
    { id: "loc-studio", label: "Home studio", origin: "model_suggestion" },
    { id: "loc-missing", label: null, origin: "model_suggestion" },
  ],
  knownCommitments: [
    {
      id: "c-studio",
      title: "Standing studio block",
      date: "2026-10-22",
      startMinutes: 9 * 60,
      endMinutes: 12 * 60,
    },
  ],
};

/** Display-only sample metadata. Not part of the proposed response schema. */
export const SAMPLE_MILESTONE_STATUS: Record<string, "done" | "open"> = {
  "m-cap": "done",
  "m-invite": "done",
  "m-room": "open",
  "m-supplies": "open",
  "m-thanks": "open",
};

export const SAMPLE_GOAL = {
  title: "Prepare a quiet winter open studio",
  targetDate: "2027-01-15",
  weeklyHours: 6,
};

export const EXAMPLE_DRAFT: GoalDraft = {
  title: SAMPLE_GOAL.title,
  successCriteria: "Twenty guests can visit the studio on 15 January 2027 without renting another room.",
  targetDate: "2027-01-15",
  weeklyHours: "6",
  hasBudget: true,
  currency: "USD",
  budgetMajor: "400.00",
  locationLabel: "Home studio",
  budgetItems: [
    { id: "example-print", label: "Invitation print", amount: "85.00" },
    { id: "example-flowers", label: "Flowers", amount: "64.00" },
  ],
  commitments: [
    {
      id: "example-studio",
      title: "Standing studio block",
      date: "2026-10-22",
      start: "09:00",
      end: "12:00",
    },
    {
      id: "example-call",
      title: "Supplier call",
      date: "2026-10-22",
      start: "11:00",
      end: "11:30",
    },
  ],
};
