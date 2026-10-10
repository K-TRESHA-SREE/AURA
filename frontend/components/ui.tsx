import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { SuggestionOrigin } from "@/lib/contracts/planning";
import { buttons, cardClass } from "@/lib/design/system";

type ButtonVariant = keyof typeof buttons;

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      type={type}
      className={`${buttons[variant]} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <Link href={href} className={`${buttons[variant]} ${className}`}>
      {children}
    </Link>
  );
}

type BadgeTone =
  | "neutral"
  | "gold"
  | "spruce"
  | "warning"
  | "danger"
  | "ok";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-paper-deep text-ink-soft",
    gold: "bg-gold-soft text-gold-ink",
    spruce: "bg-mist text-spruce-deep",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    ok: "bg-ok-soft text-ok",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function OriginBadge({
  origin,
}: {
  origin: SuggestionOrigin;
}) {
  if (origin === "model_suggestion") {
    return <Badge tone="gold">Sample · model suggestion</Badge>;
  }

  return <Badge tone="spruce">Checked locally</Badge>;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${cardClass} ${className}`}>
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <h3 className="font-display text-2xl text-ink">{title}</h3>

      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
        {message}
      </p>

      {action ? (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {action}
        </div>
      ) : null}
    </div>
  );
}

export function LoadingState({
  label,
}: {
  label: string;
}) {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-muted">{label}</p>

      <div
        className="grid gap-4 md:grid-cols-3"
        aria-hidden="true"
      >
        <div className="h-28 animate-pulse rounded-3xl bg-paper-deep" />
        <div className="h-28 animate-pulse rounded-3xl bg-paper-deep" />
        <div className="h-28 animate-pulse rounded-3xl bg-paper-deep" />
      </div>
    </div>
  );
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = "Try again",
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-3xl border border-danger/30 bg-danger-soft px-5 py-5 text-danger"
    >
      <h3 className="font-display text-2xl">{title}</h3>

      <p className="mt-2 max-w-2xl text-sm leading-6">
        {message}
      </p>

      {onRetry ? (
        <Button
          variant="secondary"
          className="mt-4"
          onClick={onRetry}
        >
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Decorative hero panel.
 * Uses CSS only, so no missing image file is required.
 */
export function PhotoFrame({
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  credit: string;
  creditHref: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <figure
      role="img"
      aria-label={alt}
      className={`relative flex min-h-64 items-center justify-center overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-paper-deep via-gold-soft to-mist ${className}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-5 rounded-2xl border border-white/70"
      />

      <div className="relative mx-8 flex max-w-sm flex-col items-center text-center">
        <span
          aria-hidden="true"
          className="text-6xl text-spruce"
        >
          ✳
        </span>

        <p className="mt-4 font-display text-2xl text-ink">
          Make room for what matters.
        </p>

        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Your goals, thoughtfully organized.
        </p>
      </div>
    </figure>
  );
}

export function describedBy(
  id: string,
  hint: boolean,
  error: boolean,
): string | undefined {
  const ids = [
    hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ].filter(Boolean);

  return ids.length > 0 ? ids.join(" ") : undefined;
}