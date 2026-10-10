/**
 * Shared class recipes for AURA.
 * Color, type, and breakpoint tokens live in src/app/globals.css.
 * Keep new controls on these recipes instead of one-off palettes.
 */

export const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const buttons = {
  primary: `${buttonBase} bg-spruce text-white hover:bg-spruce-deep`,
  secondary: `${buttonBase} border border-line bg-surface text-ink hover:bg-paper-deep`,
  ghost: `${buttonBase} text-ink hover:bg-paper-deep`,
} as const;

export const inputClass =
  "mt-2 w-full min-h-11 rounded-2xl border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:bg-paper-deep";

export const cardClass = "rounded-3xl border border-line bg-surface shadow-card";

export function inputClassName(invalid: boolean): string {
  return invalid ? `${inputClass} border-danger bg-danger-soft/50` : inputClass;
}

export const DESIGN = {
  name: "AURA",
  spacingBasePx: 4,
  minTargetPx: 44,
  breakpointsPx: { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 },
  fonts: { display: "Fraunces", ui: "Outfit" },
} as const;
