import Image from "next/image";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { SuggestionOrigin } from "@/lib/contracts/planning";
import { buttons, cardClass } from "@/lib/design/system";

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttons }) {
  return <button type={type} className={`${buttons[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof buttons;
  className?: string;
}) {
  return (
    <Link href={href} className={`${buttons[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "spruce" | "warning" | "danger" | "ok";
}) {
  const tones = {
    neutral: "bg-paper-deep text-ink-soft",
    gold: "bg-gold-soft text-gold-ink",
    spruce: "bg-mist text-spruce-deep",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    ok: "bg-ok-soft text-ok",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function OriginBadge({ origin }: { origin: SuggestionOrigin }) {
  if (origin === "model_suggestion") {
    return <Badge tone="gold">Sample · model suggestion</Badge>;
  }
  return <Badge tone="spruce">Checked locally</Badge>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`${cardClass} ${className}`}>{children}</section>;
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
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">{message}</p>
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <p className="text-sm text-muted">{label}</p>
      <div className="grid gap-4 md:grid-cols-3" aria-hidden="true">
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
    <div role="alert" className="rounded-3xl border border-danger/30 bg-danger-soft px-5 py-5 text-danger">
      <h3 className="font-display text-2xl">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6">{message}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function PhotoFrame({
  src,
  alt,
  credit,
  creditHref,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  credit: string;
  creditHref: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <figure className={`relative min-h-64 overflow-hidden rounded-3xl ${className}`}>
      <Image src={src} alt={alt} fill priority={priority} sizes="(min-width: 1024px) 42vw, 100vw" className="object-cover" />
      <figcaption className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-full bg-ink/80 px-3 py-1 text-xs text-paper">
        <a href={creditHref} className="underline decoration-white/40 underline-offset-2">
          {credit}
        </a>
      </figcaption>
    </figure>
  );
}

export function describedBy(id: string, hint: boolean, error: boolean): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}
