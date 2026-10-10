import { parseIsoDate } from "@/lib/planning/dates";

export type ScheduleSource = "commitment" | "task" | "deadline";

export type ScheduleItem = {
  id: string;
  title: string;
  date: string | null;
  startMinutes: number | null;
  endMinutes: number | null;
  source: ScheduleSource;
};

export type ScheduleReadiness = "complete" | "missing_date" | "missing_time" | "invalid_date" | "invalid_time";

export type ScheduleConflict = {
  leftId: string;
  rightId: string;
  date: string;
  overlapMinutes: number;
  method: "deterministic_interval_overlap";
};

export function isValidClockRange(start: number | null, end: number | null): boolean {
  if (start === null || end === null) return false;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
  if (start < 0 || end > 1440 || start >= end) return false;
  return true;
}

/**
 * Date-only items are deadlines, not intervals.
 * A missing bound is incomplete — it is never treated as an overnight span.
 */
export function readiness(item: ScheduleItem): ScheduleReadiness {
  if (!item.date) return "missing_date";
  if (!parseIsoDate(item.date)) return "invalid_date";
  const hasStart = item.startMinutes !== null;
  const hasEnd = item.endMinutes !== null;
  if (!hasStart && !hasEnd) return "missing_time";
  if (!hasStart || !hasEnd) return "missing_time";
  if (!isValidClockRange(item.startMinutes, item.endMinutes)) return "invalid_time";
  return "complete";
}

export function readinessLabel(status: ScheduleReadiness): string {
  switch (status) {
    case "complete":
      return "Has a date and a clock interval";
    case "missing_date":
      return "Date not provided — not checked for conflicts";
    case "missing_time":
      return "Time not provided — shown as a deadline only, not checked for conflicts";
    case "invalid_date":
      return "Invalid date — not checked for conflicts";
    case "invalid_time":
      return "Invalid clock interval — not checked for conflicts";
  }
}

/** Half-open overlap on the same calendar date. Touching endpoints are not conflicts. */
export function findConflicts(items: ScheduleItem[]): ScheduleConflict[] {
  const complete = items.filter((item) => readiness(item) === "complete");
  const conflicts: ScheduleConflict[] = [];
  for (let i = 0; i < complete.length; i += 1) {
    for (let j = i + 1; j < complete.length; j += 1) {
      const left = complete[i];
      const right = complete[j];
      if (left.date !== right.date) continue;
      const start = Math.max(left.startMinutes as number, right.startMinutes as number);
      const end = Math.min(left.endMinutes as number, right.endMinutes as number);
      const overlap = end - start;
      if (overlap > 0) {
        conflicts.push({
          leftId: left.id,
          rightId: right.id,
          date: left.date as string,
          overlapMinutes: overlap,
          method: "deterministic_interval_overlap",
        });
      }
    }
  }
  return conflicts;
}
