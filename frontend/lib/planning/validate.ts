import {
  isCurrencyCode,
  type CurrencyCode,
  type ProposedBudgetLine,
  type ProposedCommitment,
  type ProposedGoalInput,
} from "@/lib/contracts/planning";
import { parseMajorToMinor } from "@/lib/planning/budget";
import {
  addMonths,
  capacityFromWeeklyHours,
  compareDates,
  formatHours,
  parseClock,
  parseIsoDate,
  todayLocal,
} from "@/lib/planning/dates";

export type GoalDraft = {
  title: string;
  successCriteria: string;
  targetDate: string;
  weeklyHours: string;
  hasBudget: boolean;
  currency: string;
  budgetMajor: string;
  locationLabel: string;
  budgetItems: BudgetLineDraft[];
  commitments: CommitmentDraft[];
};

export type BudgetLineDraft = {
  id: string;
  label: string;
  amount: string;
};

export type CommitmentDraft = {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
};

export type FieldError = { field: string; message: string };

export type LocalFinding = {
  id: string;
  severity: "info" | "warning";
  text: string;
  origin: "deterministic_validation";
};

export function emptyDraft(): GoalDraft {
  return {
    title: "",
    successCriteria: "",
    targetDate: "",
    weeklyHours: "",
    hasBudget: false,
    currency: "",
    budgetMajor: "",
    locationLabel: "",
    budgetItems: [],
    commitments: [],
  };
}

export function parseWeeklyHours(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(?:[1-9]\d?|0)(?:\.0|\.5)?$/.test(trimmed)) return null;
  const hours = Number(trimmed);
  if (!Number.isFinite(hours) || hours < 0.5 || hours > 80) return null;
  return hours;
}

function rowStarted(values: string[]): boolean {
  return values.some((value) => value.trim().length > 0);
}

export function validateGoal(
  draft: GoalDraft,
  now = new Date(),
): { ok: true; value: ProposedGoalInput } | { ok: false; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const title = draft.title.trim();
  const successCriteria = draft.successCriteria.trim();
  const location = draft.locationLabel.trim();

  if (title.length < 3) {
    errors.push({ field: "title", message: "Enter a goal title of at least 3 characters." });
  } else if (title.length > 120) {
    errors.push({ field: "title", message: "Keep the goal title to 120 characters or fewer." });
  }

  if (successCriteria.length < 10) {
    errors.push({
      field: "successCriteria",
      message: "Describe what done looks like in at least 10 characters.",
    });
  } else if (successCriteria.length > 800) {
    errors.push({
      field: "successCriteria",
      message: "Keep the success note to 800 characters or fewer.",
    });
  }

  const target = parseIsoDate(draft.targetDate);
  if (!draft.targetDate.trim()) {
    errors.push({ field: "targetDate", message: "Choose a target date." });
  } else if (!target) {
    errors.push({ field: "targetDate", message: "Enter a real calendar date." });
  } else {
    const today = todayLocal(now);
    const max = addMonths(today, 24);
    if (compareDates(target, today) < 0) {
      errors.push({ field: "targetDate", message: "Choose a target date that is today or later." });
    } else if (compareDates(target, max) > 0) {
      errors.push({ field: "targetDate", message: "Choose a target date within the next 24 months." });
    }
  }

  const weeklyHours = parseWeeklyHours(draft.weeklyHours);
  if (weeklyHours === null) {
    errors.push({
      field: "weeklyHours",
      message: "Enter weekly availability from 0.5 to 80 hours, in half-hour steps.",
    });
  }

  if (location.length > 160) {
    errors.push({ field: "locationLabel", message: "Keep the location label to 160 characters or fewer." });
  }

  let currency: CurrencyCode | null = null;
  let budgetCapMinor: number | null = null;
  const budgetItems: ProposedBudgetLine[] = [];

  if (draft.hasBudget) {
    if (!isCurrencyCode(draft.currency)) {
      errors.push({ field: "currency", message: "Choose a currency for this budget." });
    } else {
      currency = draft.currency;
    }

    if (draft.budgetMajor.trim()) {
      const minor = parseMajorToMinor(draft.budgetMajor);
      if (minor === null) {
        errors.push({
          field: "budgetCap",
          message: "Enter the spending cap as a decimal amount, such as 250 or 250.00.",
        });
      } else {
        budgetCapMinor = minor;
      }
    }

    let completeLines = 0;
    draft.budgetItems.forEach((line, index) => {
      if (!rowStarted([line.label, line.amount])) return;
      const label = line.label.trim();
      const prefix = `budget-${line.id}`;
      if (label.length < 2) {
        errors.push({
          field: `${prefix}-label`,
          message: `Enter a name for budget line ${index + 1}.`,
        });
      } else if (label.length > 80) {
        errors.push({
          field: `${prefix}-label`,
          message: `Keep budget line ${index + 1} to 80 characters or fewer.`,
        });
      }
      const minor = parseMajorToMinor(line.amount);
      if (minor === null) {
        errors.push({
          field: `${prefix}-amount`,
          message: `Enter an amount for budget line ${index + 1}, such as 18.50.`,
        });
      }
      if (label.length >= 2 && label.length <= 80 && minor !== null && currency) {
        completeLines += 1;
        budgetItems.push({
          id: line.id,
          label,
          currency,
          amountMinor: minor,
        });
      }
    });

    if (budgetCapMinor === null && completeLines === 0 && !errors.some((error) => error.field.startsWith("budget-"))) {
      errors.push({
        field: "budgetCap",
        message: "Enter a spending cap or at least one budget line, or turn budget tracking off.",
      });
    }
  }

  const commitments: ProposedCommitment[] = [];
  draft.commitments.forEach((row, index) => {
    if (!rowStarted([row.title, row.date, row.start, row.end])) return;
    const title = row.title.trim();
    const prefix = `commitment-${row.id}`;
    if (title.length < 2) {
      errors.push({
        field: `${prefix}-title`,
        message: `Enter a name for commitment ${index + 1}.`,
      });
    } else if (title.length > 80) {
      errors.push({
        field: `${prefix}-title`,
        message: `Keep commitment ${index + 1} to 80 characters or fewer.`,
      });
    }

    let date: string | null = null;
    if (!row.date.trim()) {
      if (row.start.trim() || row.end.trim()) {
        errors.push({
          field: `${prefix}-date`,
          message: `Choose a date for commitment ${index + 1}, or clear the times. A missing date is not guessed.`,
        });
      }
    } else if (!parseIsoDate(row.date)) {
      errors.push({ field: `${prefix}-date`, message: `Enter a real date for commitment ${index + 1}.` });
    } else {
      date = row.date;
    }

    const startProvided = row.start.trim().length > 0;
    const endProvided = row.end.trim().length > 0;
    let startMinutes: number | null = null;
    let endMinutes: number | null = null;
    if (startProvided || endProvided) {
      if (!startProvided || !endProvided) {
        errors.push({
          field: `${prefix}-end`,
          message: `Enter both a start and an end for commitment ${index + 1}. Overnight times are not inferred.`,
        });
      } else {
        startMinutes = parseClock(row.start);
        endMinutes = parseClock(row.end);
        if (startMinutes === null) {
          errors.push({ field: `${prefix}-start`, message: `Enter a valid start time for commitment ${index + 1}.` });
        }
        if (endMinutes === null) {
          errors.push({ field: `${prefix}-end`, message: `Enter a valid end time for commitment ${index + 1}.` });
        }
        if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
          errors.push({
            field: `${prefix}-end`,
            message: `End time for commitment ${index + 1} must be later on the same day. Overnight spans are not inferred.`,
          });
        }
      }
    }

    if (title.length >= 2 && title.length <= 80) {
      commitments.push({ id: row.id, title, date, startMinutes, endMinutes });
    }
  });

  if (errors.length > 0 || weeklyHours === null || !target || !draft.targetDate.trim()) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      title,
      successCriteria,
      targetDate: draft.targetDate,
      weeklyHours,
      hasBudget: draft.hasBudget,
      currency,
      budgetCapMinor,
      budgetItems: draft.hasBudget ? budgetItems : [],
      locationLabel: location.length > 0 ? location : null,
      commitments,
    },
  };
}

export function buildLocalFindings(input: ProposedGoalInput, now = new Date()): LocalFinding[] {
  const findings: LocalFinding[] = [];
  const today = todayLocal(now);
  const target = parseIsoDate(input.targetDate);
  if (target) {
    const capacity = capacityFromWeeklyHours(input.weeklyHours, today, target);
    if (capacity && capacity.daySpan === 0) {
      findings.push({
        id: "target-today",
        severity: "warning",
        origin: "deterministic_validation",
        text: "The target date is today, so weekly availability does not add future hours. No hours were inferred for the rest of today.",
      });
    }
  }
  if (!input.hasBudget) {
    findings.push({
      id: "no-budget",
      severity: "info",
      origin: "deterministic_validation",
      text: "No spending cap or budget lines were entered. No amounts were assumed.",
    });
  }
  if (!input.locationLabel) {
    findings.push({
      id: "no-location",
      severity: "info",
      origin: "deterministic_validation",
      text: "Location not provided. No map, route, distance, or travel time was created.",
    });
  } else {
    findings.push({
      id: "location-label",
      severity: "info",
      origin: "deterministic_validation",
        text: `Location label kept locally as "${input.locationLabel}". It was not geocoded.`,
    });
  }
  if (input.commitments.length === 0) {
    findings.push({
      id: "no-commitments",
      severity: "info",
      origin: "deterministic_validation",
      text: "No known commitments were entered, so no schedule conflicts were checked.",
    });
  }
  return findings;
}

export function capacitySentence(input: ProposedGoalInput, now = new Date()): string {
  const today = todayLocal(now);
  const target = parseIsoDate(input.targetDate);
  if (!target) return "Target date is not available, so hours were not calculated.";
  const capacity = capacityFromWeeklyHours(input.weeklyHours, today, target);
  if (!capacity) return "Hours could not be calculated from the dates provided.";
  return `From today to the target date is ${capacity.daySpan} ${capacity.daySpan === 1 ? "day" : "days"}. At ${formatHours(input.weeklyHours)} hours per week, that is ${formatHours(capacity.availableHours)} hours. Required effort was not estimated.`;
}
