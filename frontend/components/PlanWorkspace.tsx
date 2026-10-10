"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { type GeneratedPlan, type ProposedGoalInput } from "@/lib/contracts/planning";
import { EXAMPLE_DRAFT, SAMPLE_PLAN } from "@/lib/fixtures/samples";
import { PlanningApiError, submitPlanningDraft, type PlanningClientResult } from "@/lib/planning/client";
import { addMonths, formatDisplayDate, formatIsoDate, todayLocal } from "@/lib/planning/dates";
import type { ScheduleItem } from "@/lib/planning/schedule";
import {
  buildLocalFindings,
  capacitySentence,
  emptyDraft,
  validateGoal,
  type FieldError,
  type GoalDraft,
} from "@/lib/planning/validate";
import { BudgetPanel, MapPanel, ResultsView, SchedulePanel } from "@/components/SupportPanels";
import { Badge, Button, describedBy, ErrorState } from "@/components/ui";
import { inputClassName } from "@/lib/design/system";

type Phase = "idle" | "invalid" | "checking" | "checked" | "failed";

function errorFor(errors: FieldError[], field: string): string | undefined {
  return errors.find((error) => error.field === field)?.message;
}

function FieldErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} className="mt-1 text-sm text-danger">
      {message}
    </p>
  );
}

function Hint({ id, children }: { id: string; children: string }) {
  return (
    <p id={`${id}-hint`} className="mt-1 text-sm leading-6 text-muted">
      {children}
    </p>
  );
}

function draftKey(draft: GoalDraft): string {
  return JSON.stringify(draft);
}

function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function PlanWorkspace() {
  const [draft, setDraft] = useState<GoalDraft>(emptyDraft);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [checked, setChecked] = useState<ProposedGoalInput | null>(null);
  const [submission, setSubmission] = useState<PlanningClientResult | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [clearArmed, setClearArmed] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [dateBounds, setDateBounds] = useState<{ min: string; max: string } | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const outcomeRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const today = todayLocal();
    const timer = window.setTimeout(() => {
      setDateBounds({ min: formatIsoDate(today), max: formatIsoDate(addMonths(today, 24)) });
      if (window.location.hash === "#sample-plan") setSampleOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function update<K extends keyof GoalDraft>(key: K, value: GoalDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setClearArmed(false);
    setNotice(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || phase === "checking") return;
    const key = draftKey(draft);
    if (key === lastKey && phase === "checked") {
      setNotice("This draft was already checked. Nothing new was sent.");
      outcomeRef.current?.focus();
      return;
    }
    const result = validateGoal(draft);
    if (!result.ok) {
      setErrors(result.errors);
      setPhase("invalid");
      setChecked(null);
      setSubmission(null);
      setFailure(null);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    inFlight.current = true;
    setErrors([]);
    setFailure(null);
    setNotice(null);
    setChecked(null);
    setSubmission(null);
    setPhase("checking");
    try {
      const response = await submitPlanningDraft(result.value);
      setChecked(result.value);
      setSubmission(response);
      setLastKey(key);
      setPhase("checked");
      requestAnimationFrame(() => outcomeRef.current?.focus());
    } catch (error) {
      setPhase("failed");
      const message = error instanceof Error ? error.message : "The plan request failed. Please retry.";
      const details = error instanceof PlanningApiError && error.details?.length
        ? ` ${error.details.map((item) => `${item.field}: ${item.message}`).join(" ")}`
        : "";
      setFailure(`${message}${details}`);
      requestAnimationFrame(() => outcomeRef.current?.focus());
    } finally {
      inFlight.current = false;
    }
  }

  function fillExample() {
    setDraft(EXAMPLE_DRAFT);
    setErrors([]);
    setPhase("idle");
    setChecked(null);
    setSubmission(null);
    setLastKey(null);
    setFailure(null);
    setClearArmed(false);
    setNotice("Example draft filled. It has not been checked, and it is not a generated plan.");
    titleRef.current?.focus();
  }

  function requestClear() {
    if (draftKey(draft) === draftKey(emptyDraft())) return;
    if (!clearArmed) {
      setClearArmed(true);
      return;
    }
    setDraft(emptyDraft());
    setErrors([]);
    setPhase("idle");
    setChecked(null);
    setSubmission(null);
    setLastKey(null);
    setFailure(null);
    setNotice("Form cleared. Nothing was sent.");
    setClearArmed(false);
    titleRef.current?.focus();
  }

  const stale = lastKey !== null && draftKey(draft) !== lastKey;
  const findings = checked ? buildLocalFindings(checked) : [];
  const commitmentItems: ScheduleItem[] = checked
    ? [
        {
          id: "draft-target",
          title: "Goal target date",
          date: checked.targetDate,
          startMinutes: null,
          endMinutes: null,
          source: "deadline",
        },
        ...checked.commitments.map((item) => ({
          id: item.id,
          title: item.title,
          date: item.date,
          startMinutes: item.startMinutes,
          endMinutes: item.endMinutes,
          source: "commitment" as const,
        })),
      ]
    : [];
  const sampleSchedule: ScheduleItem[] = [
    ...SAMPLE_PLAN.knownCommitments.map((item) => ({
      id: item.id,
      title: item.title,
      date: item.date,
      startMinutes: item.startMinutes,
      endMinutes: item.endMinutes,
      source: "commitment" as const,
    })),
    ...SAMPLE_PLAN.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      date: task.date,
      startMinutes: task.startMinutes,
      endMinutes: task.endMinutes,
      source: "task" as const,
    })),
    ...SAMPLE_PLAN.milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      date: milestone.suggestedDeadline,
      startMinutes: null,
      endMinutes: null,
      source: "deadline" as const,
    })),
  ];

  const titleError = errorFor(errors, "title");
  const successError = errorFor(errors, "successCriteria");
  const dateError = errorFor(errors, "targetDate");
  const hoursError = errorFor(errors, "weeklyHours");
  const currencyError = errorFor(errors, "currency");
  const capError = errorFor(errors, "budgetCap");
  const locationError = errorFor(errors, "locationLabel");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold-ink">Plan</p>
      <h1 className="mt-3 max-w-3xl font-display text-[clamp(2.4rem,5vw,4rem)] leading-[1.02] text-ink">
        Check a goal before you call it a plan.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
        Enter your goal and constraints. AURA sends the supported details to its local planning backend, which asks Ollama
        to generate a plan and checks dates and cost estimates deterministically.
      </p>

      <div className="mt-6 rounded-3xl border border-line bg-gold-soft/70 px-4 py-4 text-sm leading-6 text-ink-soft">
        <p>
          <strong className="font-medium text-ink">Local AI planning.</strong> This form sends a request to the AURA
          backend at <code>POST /api/plan</code>. Start the Python server and Ollama locally; cross-origin development
          also requires the frontend origin in <code>AURA_CORS_ORIGINS</code>.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer font-medium text-ink">How the form maps to the API</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>The title, success criteria, weekly availability, optional location, and budget notes become goal context.</li>
            <li>A total spending cap, target date, and known commitments use the matching API fields.</li>
            <li>Only a supplied total cap is checked as the API budget; itemized notes are context, not a verified total.</li>
            <li>The backend cannot match free-text commitments to generated time slots.</li>
          </ul>
        </details>
      </div>

      <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2">
        {[
          ["#goal-form", "Goal form"],
          ["#budget", "Budget"],
          ["#schedule", "Schedule"],
          ["#travel", "Travel"],
          ["#sample-plan", "Sample plan"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-3 text-sm text-ink">
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <form
          id="goal-form"
          className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6"
          noValidate
          aria-busy={phase === "checking"}
          onSubmit={onSubmit}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl text-ink">Goal input</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Required fields are marked. Optional sections can stay empty.</p>
            </div>
            <Button variant="secondary" onClick={fillExample}>
              Fill example draft
            </Button>
          </div>

          {errors.length > 0 ? (
            <div ref={summaryRef} tabIndex={-1} role="alert" className="mt-5 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-4 text-danger outline-none">
              <h3 className="text-sm font-medium">Check these fields</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {errors.map((error) => (
                  <li key={`${error.field}-${error.message}`}>
                    <a href={`#${error.field}`} className="underline underline-offset-2">
                      {error.message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor={"title"} className="text-sm font-medium text-ink">
                Goal title
              </label>
              <Hint id={"title"}>A short name, 3 to 120 characters.</Hint>
              <input
                ref={titleRef}
                id={"title"}
                name="title"
                value={draft.title}
                maxLength={120}
                aria-required="true"
                aria-invalid={titleError ? true : undefined}
                aria-describedby={describedBy("title", true, Boolean(titleError))}
                className={inputClassName(Boolean(titleError))}
                onChange={(event) => update("title", event.target.value)}
              />
              <FieldErrorText id={"title"} message={titleError} />
            </div>

            <div>
              <label htmlFor={"successCriteria"} className="text-sm font-medium text-ink">
                What done looks like
              </label>
              <Hint id={"successCriteria"}>Required. 10 to 800 characters. This is your note, not a model prompt result.</Hint>
              <textarea
                id={"successCriteria"}
                name="successCriteria"
                value={draft.successCriteria}
                rows={4}
                maxLength={800}
                aria-required="true"
                aria-invalid={successError ? true : undefined}
                aria-describedby={describedBy("successCriteria", true, Boolean(successError))}
                className={inputClassName(Boolean(successError))}
                onChange={(event) => update("successCriteria", event.target.value)}
              />
              <FieldErrorText id={"successCriteria"} message={successError} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor={"targetDate"} className="text-sm font-medium text-ink">
                  Target date
                </label>
                <Hint id={"targetDate"}>Required. Today through 24 months. Calendar date only.</Hint>
                <input
                  id={"targetDate"}
                  name="targetDate"
                  type="date"
                  value={draft.targetDate}
                  min={dateBounds?.min}
                  max={dateBounds?.max}
                  aria-required="true"
                  aria-invalid={dateError ? true : undefined}
                  aria-describedby={describedBy("targetDate", true, Boolean(dateError))}
                  className={inputClassName(Boolean(dateError))}
                  onChange={(event) => update("targetDate", event.target.value)}
                />
                <FieldErrorText id={"targetDate"} message={dateError} />
              </div>
              <div>
                <label htmlFor={"weeklyHours"} className="text-sm font-medium text-ink">
                  Weekly availability
                </label>
                <Hint id={"weeklyHours"}>Required. 0.5 to 80 hours, half-hour steps. Not a calendar sync.</Hint>
                <input
                  id={"weeklyHours"}
                  name="weeklyHours"
                  inputMode="decimal"
                  value={draft.weeklyHours}
                  aria-required="true"
                  aria-invalid={hoursError ? true : undefined}
                  aria-describedby={describedBy("weeklyHours", true, Boolean(hoursError))}
                  className={inputClassName(Boolean(hoursError))}
                  onChange={(event) => update("weeklyHours", event.target.value)}
                />
                <FieldErrorText id={"weeklyHours"} message={hoursError} />
              </div>
            </div>
          </div>

          <fieldset className="mt-8 space-y-4">
            <legend className="font-display text-2xl text-ink">Budget</legend>
            <p className="text-sm leading-6 text-muted">Turn this on only if the goal has money attached. Empty means no amounts were assumed.</p>
            <label className="flex min-h-11 items-center gap-3 text-sm text-ink" htmlFor={"has-budget"}>
              <input
                id={"has-budget"}
                type="checkbox"
                className="h-4 w-4 accent-spruce"
                checked={draft.hasBudget}
                onChange={(event) => update("hasBudget", event.target.checked)}
              />
              This goal has a budget
            </label>
            {draft.hasBudget ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor={"currency"} className="text-sm font-medium text-ink">
                    Currency
                  </label>
                  <Hint id={"currency"}>Used for the cap and every line on this draft. Currencies are not converted.</Hint>
                  <select
                    id={"currency"}
                    name="currency"
                    value={draft.currency}
                    aria-required="true"
                    aria-invalid={currencyError ? true : undefined}
                    aria-describedby={describedBy("currency", true, Boolean(currencyError))}
                    className={inputClassName(Boolean(currencyError))}
                    onChange={(event) => update("currency", event.target.value)}
                  >
                    <option value="">Select a currency</option>
                    <option value="USD">USD — US dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — Pound sterling</option>
                    <option value="CAD">CAD — Canadian dollar</option>
                  </select>
                  <FieldErrorText id={"currency"} message={currencyError} />
                </div>
                <div>
                  <label htmlFor={"budgetCap"} className="text-sm font-medium text-ink">
                    Spending cap
                  </label>
                  <Hint id={"budgetCap"}>Optional if you add lines. Decimal amount, such as 250.00. Stored in cents for the total.</Hint>
                  <input
                    id={"budgetCap"}
                    name="budgetCap"
                    inputMode="decimal"
                    value={draft.budgetMajor}
                    aria-invalid={capError ? true : undefined}
                    aria-describedby={describedBy("budgetCap", true, Boolean(capError))}
                    className={inputClassName(Boolean(capError))}
                    onChange={(event) => update("budgetMajor", event.target.value)}
                  />
                  <FieldErrorText id={"budgetCap"} message={capError} />
                </div>
              </div>
            ) : null}
            {draft.hasBudget
              ? draft.budgetItems.map((line, index) => {
                  const labelError = errorFor(errors, `budget-${line.id}-label`);
                  const amountError = errorFor(errors, `budget-${line.id}-amount`);
                  return (
                    <div key={line.id} className="rounded-2xl border border-line p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-ink">Budget line {index + 1}</p>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            update(
                              "budgetItems",
                              draft.budgetItems.filter((item) => item.id !== line.id),
                            )
                          }
                        >
                          Remove budget line {index + 1}
                        </Button>
                      </div>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`budget-${line.id}-label`} className="text-sm font-medium text-ink">
                            Item
                          </label>
                          <input
                            id={`budget-${line.id}-label`}
                            value={line.label}
                            maxLength={80}
                            aria-invalid={labelError ? true : undefined}
                            aria-describedby={labelError ? `budget-${line.id}-label-error` : undefined}
                            className={inputClassName(Boolean(labelError))}
                            onChange={(event) =>
                              update(
                                "budgetItems",
                                draft.budgetItems.map((item) =>
                                  item.id === line.id ? { ...item, label: event.target.value } : item,
                                ),
                              )
                            }
                          />
                          <FieldErrorText id={`budget-${line.id}-label`} message={labelError} />
                        </div>
                        <div>
                          <label htmlFor={`budget-${line.id}-amount`} className="text-sm font-medium text-ink">
                            Amount
                          </label>
                          <input
                            id={`budget-${line.id}-amount`}
                            inputMode="decimal"
                            value={line.amount}
                            aria-invalid={amountError ? true : undefined}
                            aria-describedby={amountError ? `budget-${line.id}-amount-error` : undefined}
                            className={inputClassName(Boolean(amountError))}
                            onChange={(event) =>
                              update(
                                "budgetItems",
                                draft.budgetItems.map((item) =>
                                  item.id === line.id ? { ...item, amount: event.target.value } : item,
                                ),
                              )
                            }
                          />
                          <FieldErrorText id={`budget-${line.id}-amount`} message={amountError} />
                        </div>
                      </div>
                    </div>
                  );
                })
              : null}
            {draft.hasBudget ? (
              <Button
                variant="secondary"
                onClick={() =>
                  update("budgetItems", [...draft.budgetItems, { id: crypto.randomUUID(), label: "", amount: "" }])
                }
              >
                Add a budget line
              </Button>
            ) : null}
          </fieldset>

          <fieldset className="mt-8">
            <legend className="font-display text-2xl text-ink">Place</legend>
            <div className="mt-3">
              <label htmlFor={"locationLabel"} className="text-sm font-medium text-ink">
                Location label
              </label>
              <Hint id={"locationLabel"}>Optional. Stored as text. It is not geocoded, and no route is created.</Hint>
              <input
                id={"locationLabel"}
                name="locationLabel"
                value={draft.locationLabel}
                maxLength={160}
                aria-invalid={locationError ? true : undefined}
                aria-describedby={describedBy("locationLabel", true, Boolean(locationError))}
                className={inputClassName(Boolean(locationError))}
                onChange={(event) => update("locationLabel", event.target.value)}
              />
              <FieldErrorText id={"locationLabel"} message={locationError} />
            </div>
          </fieldset>

          <fieldset className="mt-8 space-y-4">
            <legend className="font-display text-2xl text-ink">Known commitments</legend>
            <p className="text-sm leading-6 text-muted">
              Optional. Used only for deterministic overlap checks against other commitments you enter. AURA will not read a calendar.
            </p>
            {draft.commitments.map((row, index) => {
              const titleErr = errorFor(errors, `commitment-${row.id}-title`);
              const dateErr = errorFor(errors, `commitment-${row.id}-date`);
              const startErr = errorFor(errors, `commitment-${row.id}-start`);
              const endErr = errorFor(errors, `commitment-${row.id}-end`);
              return (
                <div key={row.id} className="rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">Commitment {index + 1}</p>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        update(
                          "commitments",
                          draft.commitments.filter((item) => item.id !== row.id),
                        )
                      }
                    >
                      Remove commitment {index + 1}
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label htmlFor={`commitment-${row.id}-title`} className="text-sm font-medium text-ink">
                        Name
                      </label>
                      <input
                        id={`commitment-${row.id}-title`}
                        value={row.title}
                        maxLength={80}
                        aria-invalid={titleErr ? true : undefined}
                        aria-describedby={titleErr ? `commitment-${row.id}-title-error` : undefined}
                        className={inputClassName(Boolean(titleErr))}
                        onChange={(event) =>
                          update(
                            "commitments",
                            draft.commitments.map((item) =>
                              item.id === row.id ? { ...item, title: event.target.value } : item,
                            ),
                          )
                        }
                      />
                      <FieldErrorText id={`commitment-${row.id}-title`} message={titleErr} />
                    </div>
                    <div>
                      <label htmlFor={`commitment-${row.id}-date`} className="text-sm font-medium text-ink">
                        Date
                      </label>
                      <input
                        id={`commitment-${row.id}-date`}
                        type="date"
                        value={row.date}
                        aria-invalid={dateErr ? true : undefined}
                        aria-describedby={dateErr ? `commitment-${row.id}-date-error` : undefined}
                        className={inputClassName(Boolean(dateErr))}
                        onChange={(event) =>
                          update(
                            "commitments",
                            draft.commitments.map((item) =>
                              item.id === row.id ? { ...item, date: event.target.value } : item,
                            ),
                          )
                        }
                      />
                      <FieldErrorText id={`commitment-${row.id}-date`} message={dateErr} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`commitment-${row.id}-start`} className="text-sm font-medium text-ink">
                          Start
                        </label>
                        <input
                          id={`commitment-${row.id}-start`}
                          type="time"
                          value={row.start}
                          aria-invalid={startErr ? true : undefined}
                          aria-describedby={startErr ? `commitment-${row.id}-start-error` : undefined}
                          className={inputClassName(Boolean(startErr))}
                          onChange={(event) =>
                            update(
                              "commitments",
                              draft.commitments.map((item) =>
                                item.id === row.id ? { ...item, start: event.target.value } : item,
                              ),
                            )
                          }
                        />
                        <FieldErrorText id={`commitment-${row.id}-start`} message={startErr} />
                      </div>
                      <div>
                        <label htmlFor={`commitment-${row.id}-end`} className="text-sm font-medium text-ink">
                          End
                        </label>
                        <input
                          id={`commitment-${row.id}-end`}
                          type="time"
                          value={row.end}
                          aria-invalid={endErr ? true : undefined}
                          aria-describedby={endErr ? `commitment-${row.id}-end-error` : undefined}
                          className={inputClassName(Boolean(endErr))}
                          onChange={(event) =>
                            update(
                              "commitments",
                              draft.commitments.map((item) =>
                                item.id === row.id ? { ...item, end: event.target.value } : item,
                              ),
                            )
                          }
                        />
                        <FieldErrorText id={`commitment-${row.id}-end`} message={endErr} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button
              variant="secondary"
              onClick={() =>
                update("commitments", [
                  ...draft.commitments,
                  { id: crypto.randomUUID(), title: "", date: "", start: "", end: "" },
                ])
              }
            >
              Add a known commitment
            </Button>
          </fieldset>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="submit" disabled={phase === "checking"} aria-describedby="submit-hint">
              {phase === "checking" ? "Generating plan" : phase === "failed" ? "Retry plan request" : "Generate my plan"}
            </Button>
            <Button variant="secondary" onClick={requestClear} aria-pressed={clearArmed}>
              {clearArmed ? "Confirm clear" : "Clear form"}
            </Button>
          </div>
          <p id="submit-hint" className="mt-3 text-sm text-muted">
            Sends the validated goal to your local AURA backend. A retry keeps this form data.
          </p>
          <div aria-live="polite" className="mt-3 text-sm text-ink-soft">
            {notice}
          </div>
        </form>

        <aside
          ref={outcomeRef}
          tabIndex={-1}
          aria-label="Plan outcome"
          className="rounded-3xl border border-line bg-surface p-5 shadow-card outline-none lg:sticky lg:top-8"
        >
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-ink">Outcome</p>
          <h2 className="mt-2 font-display text-3xl text-ink">Your planning result</h2>
          {phase === "idle" ? (
            <p className="mt-4 text-sm leading-6 text-muted">
              No plan yet. Your draft stays in this browser tab until you submit it.
            </p>
          ) : null}
          {phase === "invalid" ? (
            <p className="mt-4 text-sm leading-6 text-danger" role="alert">
              The plan was not requested because some fields need attention.
            </p>
          ) : null}
          {phase === "checking" ? (
            <p className="mt-4 text-sm text-ink-soft" role="status">
              Generating a plan with the local model
            </p>
          ) : null}
          {phase === "failed" ? (
            <div className="mt-4">
              <ErrorState title="Plan request failed" message={failure ?? "The backend did not return a plan."} />
            </div>
          ) : null}
          {phase === "checked" && checked && submission ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-ok-soft px-4 py-3 text-sm leading-6 text-ok" role="status">
                Plan generated at {formatStamp(submission.receivedAt)}. Review estimates and warnings before acting.
              </div>
              <GeneratedPlanView plan={submission.plan} />
              {stale ? (
                <p className="text-sm leading-6 text-ink-soft">
                  You edited the form after this plan was generated. Submit again to create a plan for the updated draft.
                </p>
              ) : null}
              <p className="text-sm leading-6 text-ink">{capacitySentence(checked)}</p>
              <p className="text-sm text-ink-soft">
                Target date {formatDisplayDate(checked.targetDate)}. Weekly availability {checked.weeklyHours} hours.
              </p>
              <ul className="space-y-2">
                {findings.map((finding) => (
                  <li key={finding.id} className="text-sm leading-6 text-ink-soft">
                    <Badge tone={finding.severity === "warning" ? "warning" : "spruce"}>Checked locally</Badge>
                    <span className="mt-1 block">{finding.text}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="secondary"
                onClick={() => {
                  setSampleOpen(true);
                  requestAnimationFrame(() => document.getElementById("sample-plan")?.focus());
                }}
              >
                Review separate sample fixture
              </Button>
            </div>
          ) : null}
        </aside>
      </div>

      <p className="mt-10 text-sm leading-6 text-muted">
        {checked
          ? "These panels use the last checked draft only. Sample fixture items are not mixed into the totals or conflict check."
          : "Check the draft before these panels treat amounts, dates, or locations as confirmed. Until then, missing values stay missing."}
      </p>
      <div className="mt-4 space-y-6">
        <BudgetPanel
          id="budget"
          kicker="Your draft"
          title="Budget"
          description="Itemized amounts from this form only. Totals use integer cents. Missing amounts are excluded instead of being filled in."
          items={
            checked
              ? checked.budgetItems.map((item) => ({
                  id: item.id,
                  label: item.label,
                  currency: item.currency,
                  amountMinor: item.amountMinor,
                }))
              : []
          }
          cap={
            checked && checked.currency && checked.budgetCapMinor !== null
              ? { currency: checked.currency, amountMinor: checked.budgetCapMinor }
              : null
          }
          compareWithCap={Boolean(checked)}
        />
        <SchedulePanel
          id="schedule"
          kicker="Your draft"
          title="Schedule"
          description="The target date is a deadline without a time. Conflicts are computed only among known commitments you entered. Sample tasks are not mixed in."
          items={commitmentItems}
        />
        <MapPanel
          id="travel"
          locations={
            checked
              ? [{ id: "draft-location", label: checked.locationLabel }]
              : [{ id: "draft-location-empty", label: null }]
          }
        />
      </div>

      <section
        id="sample-plan"
        tabIndex={-1}
        aria-labelledby="sample-plan-heading"
        className="mt-12 scroll-mt-28 rounded-3xl border border-gold/40 bg-gold-soft/40 p-5 outline-none sm:p-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-ink">Review fixture</p>
            <h2 id="sample-plan-heading" className="mt-2 font-display text-3xl text-ink">
              Sample plan
            </h2>
          </div>
          <Button variant="secondary" aria-expanded={sampleOpen} onClick={() => setSampleOpen((open) => !open)}>
            {sampleOpen ? "Hide sample plan" : "Open sample plan"}
          </Button>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-soft">
          This fixture shows a separate example plan, milestones, tasks, deadlines, assumptions, and warnings.
          It is not your draft and not a live model response.
        </p>
        {sampleOpen ? (
          <div className="mt-6 space-y-6">
            <ResultsView plan={SAMPLE_PLAN} />
            <BudgetPanel
              id="sample-budget"
              kicker="Sample fixture"
              title="Sample budget"
              description="Includes a missing amount, a missing currency, and two currencies. Combined totals are withheld when conversion would be required."
              items={SAMPLE_PLAN.budgetItems}
              cap={null}
              compareWithCap={false}
            />
            <SchedulePanel
              id="sample-schedule"
              kicker="Sample fixture"
              title="Sample schedule"
              description="Conflicts inside the sample only, from known fixture intervals. Not your calendar. One pair overlaps, one pair only touches, and one task has no date."
              items={sampleSchedule}
            />
            <MapPanel id="sample-travel" locations={SAMPLE_PLAN.locations} />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function GeneratedPlanView({ plan }: { plan: GeneratedPlan }) {
  return (
    <section className="mt-4 space-y-4" aria-label="AI-generated plan">
      <div className="rounded-2xl border border-line bg-paper/70 p-4">
        <h3 className="font-display text-xl text-ink">Summary</h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink-soft">{plan.summary}</p>
      </div>

      <div>
        <h3 className="font-display text-xl text-ink">Steps</h3>
        <ol className="mt-3 space-y-3">
          {plan.steps.map((step, index) => (
            <li key={`${index}-${step.title}`} className="rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-medium text-ink">{index + 1}. {step.title}</h4>
                <Badge tone={step.priority === "high" ? "warning" : step.priority === "medium" ? "gold" : "neutral"}>
                  {step.priority} priority
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{step.description}</p>
              <p className="mt-2 text-xs leading-5 text-muted">
                {step.day_offset === null ? "Start timing not specified" : step.day_offset === 0 ? "Starts today" : `Starts in ${step.day_offset} days`}
                {" · "}
                {step.duration_days === null ? "Duration not specified" : `${step.duration_days} ${step.duration_days === 1 ? "day" : "days"}`}
                {" · "}
                {step.estimated_cost === null ? "Cost estimate unavailable" : `Estimated cost: ${step.estimated_cost}`}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-line p-4">
        <h3 className="font-display text-xl text-ink">Practical tips</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-ink-soft">
          {plan.tips.map((tip, index) => <li key={`${index}-${tip}`}>{tip}</li>)}
        </ul>
      </div>

      {plan.warnings.length > 0 ? (
        <div className="rounded-2xl border border-warning/30 bg-warning-soft p-4" role="note">
          <h3 className="font-medium text-warning">Review these warnings</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-warning">
            {plan.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
