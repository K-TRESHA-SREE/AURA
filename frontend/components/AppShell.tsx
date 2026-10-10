"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { checkHealth, HEALTH_PATH, HEALTH_TIMEOUT_MS, type HealthCheck } from "@/lib/health/check";
import { Button } from "@/components/ui";

const NAV = [
  { href: "/", label: "Overview", hint: "Board and progress" },
  { href: "/plan", label: "Plan", hint: "Goal, budget, and schedule" },
];

function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-gold" />
      <circle cx="16" cy="16" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-spruce" />
      <circle cx="16" cy="16" r="1.8" fill="currentColor" className="text-paper" />
    </svg>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-full">
      <Mark className="h-9 w-9" />
      <span>
        <span className="block font-display text-xl leading-none tracking-wide text-paper">AURA</span>
        <span className="mt-1 block text-[0.7rem] uppercase tracking-[0.16em] text-paper/70">Personal planning</span>
      </span>
    </Link>
  );
}

function PrimaryNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={`block min-h-11 rounded-2xl px-3 py-3 ${
                active ? "bg-white/10 text-white" : "text-paper/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="mt-0.5 block text-xs text-paper/60">{item.hint}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function healthCopy(health: HealthCheck): string {
  switch (health.status) {
    case "checking":
      return "Checking whether the local AURA backend is reachable…";
    case "ok":
      return `Backend responded in ${health.elapsedMs} ms. Ollama availability is checked when you request a plan.`;
    case "server_error":
      return `Backend check returned HTTP ${health.httpStatus}.`;
    case "timeout":
      return `Backend check timed out after ${HEALTH_TIMEOUT_MS / 1000} seconds.`;
    case "network":
      return "Could not reach the backend. Check that it is running and allows this frontend origin.";
    case "invalid":
      return `Backend check returned an unexpected response (HTTP ${health.httpStatus}).`;
  }
}

function HealthBar({ health, onRetry }: { health: HealthCheck; onRetry: () => void }) {
  const tone =
    health.status === "ok"
      ? "border-ok/30 bg-ok-soft text-ok"
      : health.status === "checking"
        ? "border-line bg-surface text-ink-soft"
        : "border-danger/30 bg-danger-soft text-danger";
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 lg:px-10 ${tone}`}>
      <p className="text-sm" role="status" aria-live="polite">
        <span className="font-medium">Service health. </span>
        {healthCopy(health)}
      </p>
      {health.status === "checking" ? null : (
        <Button variant="secondary" onClick={onRetry}>
          Check health again
        </Button>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const open = menuPath === pathname;
  const [health, setHealth] = useState<HealthCheck>({ status: "checking" });
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const menuId = useId();

  function closeMenu() {
    setMenuPath(null);
  }

  function retryHealth() {
    const id = requestId.current + 1;
    requestId.current = id;
    setHealth({ status: "checking" });
    void checkHealth().then((result) => {
      if (requestId.current === id) setHealth(result);
    });
  }

  useEffect(() => {
    const id = requestId.current + 1;
    requestId.current = id;
    let active = true;
    void checkHealth().then((result) => {
      if (active && requestId.current === id) setHealth(result);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuPath(null);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-screen lg:pl-72">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <aside className="dark-surface fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-white/10 bg-ink px-5 py-6 text-paper lg:flex">
        <Brand />
        <nav aria-label="Primary" className="mt-10">
          <PrimaryNav />
        </nav>
        <p className="mt-auto text-xs leading-5 text-paper/60">
          Sample boards are labelled fixtures. Plans are requested from the local AURA API at {HEALTH_PATH}.
        </p>
      </aside>
      <div className="dark-surface sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-ink px-4 py-3 text-paper lg:hidden">
        <Brand />
        <button
          ref={menuButtonRef}
          type="button"
          className="min-h-11 rounded-full border border-white/20 px-4 text-sm"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setMenuPath(open ? null : pathname)}
        >
          {open ? "Close menu" : "Menu"}
        </button>
      </div>
      {open ? (
        <div id={menuId} ref={menuRef} className="dark-surface border-b border-white/10 bg-ink px-4 py-4 text-paper lg:hidden">
          <nav aria-label="Primary">
            <PrimaryNav onNavigate={closeMenu} />
          </nav>
        </div>
      ) : null}
      <HealthBar health={health} onRetry={retryHealth} />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </div>
  );
}
