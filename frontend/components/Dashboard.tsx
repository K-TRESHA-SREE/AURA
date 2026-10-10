"use client";

import { useMemo, useState } from "react";
import { SAMPLE_AS_OF, SAMPLE_GOAL, SAMPLE_MILESTONE_STATUS, SAMPLE_PLAN } from "@/lib/fixtures/samples";
import { formatDisplayDate } from "@/lib/planning/dates";
import { Badge, Button, ButtonLink, EmptyState, ErrorState, LoadingState, PhotoFrame } from "@/components/ui";

type BoardMode = "sample" | "empty" | "loading" | "error";

function countDone(): number {
  return SAMPLE_PLAN.milestones.filter((milestone) => SAMPLE_MILESTONE_STATUS[milestone.id] === "done").length;
}

export function Dashboard() {
  const [mode, setMode] = useState<BoardMode>("sample");
  const done = countDone();
  const total = SAMPLE_PLAN.milestones.length;
  const dated = SAMPLE_PLAN.tasks.filter((task) => task.date);
  const missingDate = SAMPLE_PLAN.tasks.filter((task) => !task.date);
  const upcoming = useMemo(
    () => SAMPLE_PLAN.tasks.filter((task) => task.date === null || (task.date !== null && task.date >= SAMPLE_AS_OF)),
    [],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <section className="grid items-stretch gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col justify-end">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold-ink">AURA</p>
          <h1 className="mt-3 max-w-xl font-display text-[clamp(2.6rem,6vw,4.4rem)] leading-[0.98] text-ink">
            A quieter board for the week ahead.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-ink-soft">
            Start with a goal, a date, and the hours you actually have. This preview does not generate a plan. The board
            below is a labelled sample until a goals endpoint exists.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/plan#goal-form">Start planning</ButtonLink>
            <ButtonLink href="/plan#sample-plan" variant="secondary">
              Review sample plan
            </ButtonLink>
          </div>
        </div>
        <PhotoFrame
          src="/images/desk.jpg"
          alt="Sunlit wooden desk with an open notebook, pencil, and cup of coffee"
          credit="Photo: Cup of Couple / Pexels"
          creditHref="https://www.pexels.com/photo/black-pencil-beside-notepad-and-cup-of-coffee-on-wooden-table-7657607/"
          priority
          className="min-h-72"
        />
      </section>

      <section className="mt-12" aria-labelledby="board-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold-ink">Board</p>
            <h2 id="board-heading" className="mt-2 font-display text-3xl text-ink">
              Goal overview
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" aria-pressed={mode === "sample"} onClick={() => setMode("sample")}>
              Show sample data
            </Button>
            <Button variant="secondary" aria-pressed={mode === "empty"} onClick={() => setMode("empty")}>
              Hide sample data
            </Button>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Sample data is not your calendar and not a live account. Hide it to see the empty board.
        </p>

        <details className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-ink">Preview loading and error chrome</summary>
          <p className="mt-2 text-sm text-muted">These buttons only switch the layout. They do not call a service.</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Board state preview">
            <Button variant="ghost" aria-pressed={mode === "loading"} onClick={() => setMode("loading")}>
              Loading preview
            </Button>
            <Button variant="ghost" aria-pressed={mode === "error"} onClick={() => setMode("error")}>
              Error preview
            </Button>
          </div>
        </details>

        <div className="mt-6">
          {mode === "loading" ? <LoadingState label="Preview only. Nothing is loading from a service." /> : null}
          {mode === "error" ? (
            <ErrorState
              title="Board unavailable — preview"
              message="Preview only. This message was not returned by a server, and no goals were marked missing because of it."
              onRetry={() => setMode("sample")}
              retryLabel="Return to sample board"
            />
          ) : null}
          {mode === "empty" ? (
            <EmptyState
              title="No live goals are connected"
              message="The board is empty because this repository has no goals endpoint. Start a draft in the browser, or show the sample fixture to review the layout."
              action={
                <>
                  <ButtonLink href="/plan#goal-form">Start planning</ButtonLink>
                  <Button variant="secondary" onClick={() => setMode("sample")}>
                    Show sample data
                  </Button>
                </>
              }
            />
          ) : null}
          {mode === "sample" ? (
            <div className="space-y-6">
              <article className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-7">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="gold">Sample fixture</Badge>
                  <Badge tone="neutral">Not live user data</Badge>
                </div>
                <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
                  <div>
                    <h3 className="font-display text-3xl leading-tight text-ink">{SAMPLE_GOAL.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      Target date {formatDisplayDate(SAMPLE_GOAL.targetDate)}. Sample weekly availability{" "}
                      {SAMPLE_GOAL.weeklyHours} hours. These figures are fixture values, not a calculation from your calendar.
                    </p>
                    <div className="mt-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-ink">Sample milestone marks</span>
                        <span className="text-muted">
                          {done} of {total} marked done
                        </span>
                      </div>
                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-paper-deep"
                        role="meter"
                        aria-valuemin={0}
                        aria-valuemax={total}
                        aria-valuenow={done}
                        aria-label="Sample milestone progress"
                        aria-valuetext={`${done} of ${total} sample milestones marked done`}
                      >
                        <div className="h-full rounded-full bg-spruce" style={{ width: `${(done / total) * 100}%` }} />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted">
                        Done marks are sample metadata. They are not a progress API and not a score.
                      </p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-3">
                    <Stat label="Sample hours / week" value={String(SAMPLE_GOAL.weeklyHours)} />
                    <Stat label="Tasks with a date" value={String(dated.length)} />
                    <Stat label="Tasks missing a date" value={String(missingDate.length)} />
                    <Stat label="Sample clock" value="10 Oct 2026" />
                  </dl>
                </div>
              </article>

              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <section className="rounded-3xl border border-line bg-surface p-5 shadow-card" aria-labelledby="progress-heading">
                  <h3 id="progress-heading" className="font-display text-2xl text-ink">
                    Progress summary
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {SAMPLE_PLAN.milestones.map((milestone) => {
                      const status = SAMPLE_MILESTONE_STATUS[milestone.id] ?? "open";
                      return (
                        <li key={milestone.id} className="flex items-start justify-between gap-3 border-b border-line pb-3 last:border-b-0">
                          <div>
                            <p className="text-sm font-medium text-ink">{milestone.title}</p>
                            <p className="mt-1 text-xs text-muted">
                              Suggested deadline: {formatDisplayDate(milestone.suggestedDeadline)}
                            </p>
                          </div>
                          <Badge tone={status === "done" ? "ok" : "neutral"}>{status === "done" ? "Sample done" : "Sample open"}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section className="rounded-3xl border border-line bg-surface p-5 shadow-card" aria-labelledby="upcoming-heading">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id="upcoming-heading" className="font-display text-2xl text-ink">
                      Upcoming in the sample
                    </h3>
                    <Badge tone="gold">Sample fixture</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Filtered against the frozen sample clock of {formatDisplayDate(SAMPLE_AS_OF)}. Missing dates stay visible and are not filled in.
                  </p>
                  <ul className="mt-4 divide-y divide-line">
                    {upcoming.map((task) => (
                      <li key={task.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                        <p className="text-sm font-medium text-ink">{task.title}</p>
                        <p className={`text-sm ${task.date ? "text-ink-soft" : "text-warning"}`}>
                          {formatDisplayDate(task.date)}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <ButtonLink href="/plan#goal-form">Start planning</ButtonLink>
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper px-3 py-3">
      <dt className="text-xs uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-2 font-display text-2xl text-ink">{value}</dd>
    </div>
  );
}
