import type { ReactNode } from "react";
import type { ProposedPlanResult, SuggestionOrigin } from "@/lib/contracts/planning";
import {
  compareCap,
  formatMoney,
  moneyStatusLabel,
  rollupBudget,
  type BudgetLine,
} from "@/lib/planning/budget";
import { formatClock, formatDisplayDate, formatDuration } from "@/lib/planning/dates";
import {
  findConflicts,
  readiness,
  readinessLabel,
  type ScheduleItem,
} from "@/lib/planning/schedule";
import { Badge, OriginBadge } from "@/components/ui";

function Panel({
  id,
  title,
  kicker,
  description,
  children,
}: {
  id: string;
  title: string;
  kicker: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-28 rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-ink">{kicker}</p>
      <h2 id={`${id}-heading`} className="mt-2 font-display text-3xl text-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function BudgetPanel({
  id,
  title,
  kicker,
  description,
  items,
  cap,
  compareWithCap,
}: {
  id: string;
  title: string;
  kicker: string;
  description: string;
  items: BudgetLine[];
  cap: { currency: string; amountMinor: number } | null;
  compareWithCap: boolean;
}) {
  const rollup = rollupBudget(items);
  const comparison = compareWithCap ? compareCap(rollup, cap) : null;

  return (
    <Panel id={id} title={title} kicker={kicker} description={description}>
      {cap ? (
        <p className="mb-4 text-sm text-ink">
          Spending cap: <span className="font-medium">{cap.currency}</span> {formatMoney(cap.amountMinor, cap.currency)}. The cap is not added into the item total.
        </p>
      ) : (
        <p className="mb-4 text-sm text-muted">Spending cap not provided. No cap was assumed.</p>
      )}
      {items.length === 0 ? (
        <p className="rounded-2xl bg-paper px-4 py-4 text-sm text-ink-soft">No budget items to list. Amounts were not invented.</p>
      ) : (
        <ul className="space-y-3">
          {rollup.lines.map((line) => (
            <li key={line.id} className="grid gap-2 rounded-2xl border border-line px-4 py-3 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm font-medium text-ink">{line.label || "Untitled item"}</p>
                <p className="mt-1 text-xs text-muted">{moneyStatusLabel(line.status)}</p>
              </div>
              <p className="text-sm text-ink">
                {line.currency ?? "Currency not provided"}
                {" · "}
                {line.status === "invalid_amount"
                  ? "Invalid amount"
                  : line.amountMinor === null
                    ? "Amount not provided"
                    : line.currency
                      ? formatMoney(line.amountMinor, line.currency)
                      : `${(line.amountMinor / 100).toFixed(2)} (no currency)`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {rollup.subtotals.length === 0 ? (
          <div className="rounded-2xl bg-paper px-4 py-3">
            <dt className="text-xs uppercase tracking-[0.12em] text-muted">Item total</dt>
            <dd className="mt-1 text-sm text-ink">Not calculated — no includable amounts.</dd>
          </div>
        ) : (
          rollup.subtotals.map((subtotal) => (
            <div key={subtotal.currency} className="rounded-2xl bg-paper px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.12em] text-muted">{subtotal.currency} subtotal</dt>
              <dd className="mt-1 text-sm text-ink">
                {formatMoney(subtotal.totalMinor, subtotal.currency)} from {subtotal.count}{" "}
                {subtotal.count === 1 ? "item" : "items"}
                {subtotal.creditMinor < 0 ? ` · credits ${formatMoney(subtotal.creditMinor, subtotal.currency)}` : ""}
              </dd>
            </div>
          ))
        )}
        <div className="rounded-2xl bg-mist px-4 py-3">
          <dt className="text-xs uppercase tracking-[0.12em] text-spruce-deep">Combined total</dt>
          <dd className="mt-1 text-sm text-ink">
            {rollup.overflow
              ? "Not calculated — a subtotal was outside safe integer range."
              : rollup.mixedCurrency
                ? "Not calculated — currencies differ and were not converted."
                : rollup.totalMinor === null || rollup.currencies[0] === undefined
                  ? "Not calculated."
                  : `${rollup.currencies[0]} ${formatMoney(rollup.totalMinor, rollup.currencies[0])}`}
          </dd>
        </div>
      </dl>
      {comparison ? (
        <p className="mt-4 text-sm leading-6 text-ink-soft">
          {comparison.status === "not_compared"
            ? comparison.reason
            : comparison.status === "equal"
              ? `Item total matches the ${comparison.currency} cap. This is arithmetic, not advice.`
              : comparison.status === "under"
                ? `Item total is ${formatMoney(comparison.differenceMinor, comparison.currency)} under the cap. This is arithmetic, not advice.`
                : `Item total is ${formatMoney(comparison.differenceMinor, comparison.currency)} over the cap. This is arithmetic, not advice.`}
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">This total is not compared with a draft cap.</p>
      )}
      {rollup.excluded.length > 0 ? (
        <p className="mt-2 text-xs text-muted">{rollup.excluded.length} line(s) excluded from totals. See each line for the reason.</p>
      ) : null}
    </Panel>
  );
}

export function SchedulePanel({
  id,
  title,
  kicker,
  description,
  items,
}: {
  id: string;
  title: string;
  kicker: string;
  description: string;
  items: ScheduleItem[];
}) {
  const conflicts = findConflicts(items);
  const byId = new Map(items.map((item) => [item.id, item]));

  return (
    <Panel id={id} title={title} kicker={kicker} description={description}>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-paper px-4 py-4 text-sm text-ink-soft">
          No dated items on this view. Deadlines and conflicts were not invented.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const state = readiness(item);
            return (
              <li key={item.id} className="rounded-2xl border border-line px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  <Badge tone="neutral">{item.source}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {formatDisplayDate(item.date)}
                  {" · "}
                  {item.startMinutes === null && item.endMinutes === null
                    ? "Time not provided"
                    : `${formatClock(item.startMinutes)} – ${formatClock(item.endMinutes)}`}
                </p>
                <p className={`mt-1 text-xs ${state === "complete" ? "text-muted" : "text-warning"}`}>{readinessLabel(state)}</p>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 rounded-2xl bg-paper px-4 py-4">
        <h3 className="text-sm font-medium text-ink">Conflicts</h3>
        {conflicts.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-muted">
            No schedule conflicts were identified. Only items with a valid date and a same-day start and end were compared. Touching times are not treated as overlaps.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {conflicts.map((conflict) => {
              const left = byId.get(conflict.leftId);
              const right = byId.get(conflict.rightId);
              return (
                <li key={`${conflict.leftId}-${conflict.rightId}-${conflict.date}`} className="text-sm leading-6 text-ink">
                  {left?.title ?? conflict.leftId} and {right?.title ?? conflict.rightId} overlap by{" "}
                  {formatDuration(conflict.overlapMinutes)} on {formatDisplayDate(conflict.date)}. Method: deterministic interval comparison, not a model judgment.
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}

export function MapPanel({
  id,
  locations,
}: {
  id: string;
  locations: { id: string; label: string | null; origin?: SuggestionOrigin }[];
}) {
  return (
    <Panel
      id={id}
      title="Travel"
      kicker="Deferred"
      description="No map provider, credential, or documented routing integration was found. Distances, durations, venue availability, and prices are not estimated."
    >
      <div className="rounded-2xl border border-dashed border-line bg-paper px-4 py-5">
        <p className="text-sm font-medium text-ink">Map panel deferred</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          The planning flow does not depend on this panel. A location label, when present, is text only.
        </p>
      </div>
      {locations.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No locations on this view.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {locations.map((location) => (
            <li key={location.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-4 py-3">
              <span className="text-sm text-ink">{location.label?.trim() ? location.label : "Location not provided"}</span>
              {location.origin ? <OriginBadge origin={location.origin} /> : <Badge tone="spruce">From your draft</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function ResultsView({ plan }: { plan: ProposedPlanResult }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Badge tone="gold">Sample fixture</Badge>
        <Badge tone="neutral">Not the result of your draft</Badge>
        <OriginBadge origin={plan.summaryOrigin} />
      </div>
      <p className="max-w-3xl text-base leading-7 text-ink">{plan.summary}</p>
      <p className="text-sm leading-6 text-muted">
        Gold badges are labels stored on the fixture. They are not a live model response. Spruce badges are checks this page computed from the fixture values.
      </p>

      <div>
        <h3 className="font-display text-2xl text-ink">Milestones</h3>
        <ul className="mt-3 space-y-3">
          {plan.milestones.map((milestone) => (
            <li key={milestone.id} className="rounded-2xl border border-line px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">{milestone.title}</p>
                <OriginBadge origin={milestone.origin} />
              </div>
              <p className="mt-1 text-sm text-ink-soft">Suggested deadline: {formatDisplayDate(milestone.suggestedDeadline)}</p>
              {milestone.note ? <p className="mt-1 text-xs text-muted">{milestone.note}</p> : null}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-display text-2xl text-ink">Tasks</h3>
        <ul className="mt-3 space-y-3">
          {plan.tasks.map((task) => (
            <li key={task.id} className="rounded-2xl border border-line px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">{task.title}</p>
                <OriginBadge origin={task.origin} />
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                Date: {formatDisplayDate(task.date)}
                {" · "}
                {task.startMinutes === null && task.endMinutes === null
                  ? "Time not provided"
                  : `${formatClock(task.startMinutes)} – ${formatClock(task.endMinutes)}`}
              </p>
              <p className="mt-1 text-xs text-muted">Suggested deadline: {formatDisplayDate(task.suggestedDeadline)}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="font-display text-2xl text-ink">Assumptions</h3>
          <ul className="mt-3 space-y-3">
            {plan.assumptions.map((note) => (
              <li key={note.id} className="rounded-2xl bg-gold-soft/70 px-4 py-3 text-sm leading-6 text-ink">
                <OriginBadge origin={note.origin} />
                <p className="mt-2">{note.text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-display text-2xl text-ink">Warnings on the fixture</h3>
          <ul className="mt-3 space-y-3">
            {plan.warnings.map((note) => (
              <li key={note.id} className="rounded-2xl bg-warning-soft px-4 py-3 text-sm leading-6 text-ink">
                <OriginBadge origin={note.origin} />
                <p className="mt-2">{note.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
