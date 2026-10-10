const CURRENCY = /^[A-Z]{3}$/;

export type BudgetLine = {
  id: string;
  label: string;
  currency: string | null;
  amountMinor: number | null;
};

export type BudgetLineStatus =
  | "included"
  | "missing_amount"
  | "missing_currency"
  | "invalid_amount"
  | "invalid_currency";

export type ClassifiedLine = BudgetLine & {
  currency: string | null;
  status: BudgetLineStatus;
};

export type CurrencySubtotal = {
  currency: string;
  totalMinor: number;
  count: number;
  creditMinor: number;
  chargeMinor: number;
};

export type BudgetRollup = {
  lines: ClassifiedLine[];
  included: ClassifiedLine[];
  excluded: ClassifiedLine[];
  currencies: string[];
  mixedCurrency: boolean;
  overflow: boolean;
  /** Combined total only when every included line shares one currency and the sum is safe. */
  totalMinor: number | null;
  subtotals: CurrencySubtotal[];
};

export function parseMajorToMinor(value: string): number | null {
  const trimmed = value.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;
  const whole = Number(match[1]);
  if (!Number.isSafeInteger(whole)) return null;
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const minor = whole * 100 + Number(fraction);
  if (!Number.isSafeInteger(minor)) return null;
  return minor;
}

export function formatMoney(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function moneyStatusLabel(status: BudgetLineStatus): string {
  switch (status) {
    case "included":
      return "Included in the total";
    case "missing_amount":
      return "Amount not provided — excluded";
    case "missing_currency":
      return "Currency not provided — excluded";
    case "invalid_amount":
      return "Amount is not a safe integer in minor units — excluded";
    case "invalid_currency":
      return "Currency is not a 3-letter code — excluded";
  }
}

export function rollupBudget(items: BudgetLine[]): BudgetRollup {
  const lines: ClassifiedLine[] = items.map((item) => {
    const currency = item.currency?.trim() ? item.currency.trim().toUpperCase() : null;
    let status: BudgetLineStatus = "included";
    if (item.amountMinor === null) status = "missing_amount";
    else if (!Number.isInteger(item.amountMinor) || !Number.isSafeInteger(item.amountMinor)) {
      status = "invalid_amount";
    } else if (!currency) status = "missing_currency";
    else if (!CURRENCY.test(currency)) status = "invalid_currency";
    return { ...item, currency, status };
  });

  const included = lines.filter((line) => line.status === "included");
  const excluded = lines.filter((line) => line.status !== "included");
  const byCurrency = new Map<string, CurrencySubtotal>();
  let overflow = false;

  for (const line of included) {
    const currency = line.currency as string;
    const amount = line.amountMinor as number;
    const current = byCurrency.get(currency) ?? {
      currency,
      totalMinor: 0,
      count: 0,
      creditMinor: 0,
      chargeMinor: 0,
    };
    if (!Number.isSafeInteger(current.totalMinor + amount)) {
      overflow = true;
    } else {
      current.totalMinor += amount;
      if (amount < 0) current.creditMinor += amount;
      else current.chargeMinor += amount;
    }
    current.count += 1;
    byCurrency.set(currency, current);
  }

  const subtotals = [...byCurrency.values()];
  const currencies = subtotals.map((entry) => entry.currency);
  const mixedCurrency = currencies.length > 1;
  const totalMinor =
    !overflow && !mixedCurrency && subtotals.length === 1 ? subtotals[0].totalMinor : null;

  return {
    lines,
    included,
    excluded,
    currencies,
    mixedCurrency,
    overflow,
    totalMinor,
    subtotals,
  };
}

export type CapComparison =
  | { status: "not_compared"; reason: string }
  | { status: "under" | "over" | "equal"; differenceMinor: number; currency: string };

export function compareCap(
  rollup: BudgetRollup,
  cap: { currency: string; amountMinor: number } | null,
): CapComparison {
  if (!cap) return { status: "not_compared", reason: "No spending cap was entered." };
  if (rollup.overflow) {
    return { status: "not_compared", reason: "A subtotal overflowed a safe integer, so the cap was not compared." };
  }
  if (rollup.mixedCurrency) {
    return {
      status: "not_compared",
      reason: "Item currencies differ, so the cap was not compared with a combined total.",
    };
  }
  if (rollup.totalMinor === null || rollup.currencies.length === 0) {
    return { status: "not_compared", reason: "There is no item total to compare with the cap." };
  }
  if (rollup.currencies[0] !== cap.currency) {
    return {
      status: "not_compared",
      reason: `Item total is ${rollup.currencies[0]} and the cap is ${cap.currency}. Currencies were not converted.`,
    };
  }
  const difference = cap.amountMinor - rollup.totalMinor;
  if (difference === 0) return { status: "equal", differenceMinor: 0, currency: cap.currency };
  if (difference > 0) return { status: "under", differenceMinor: difference, currency: cap.currency };
  return { status: "over", differenceMinor: Math.abs(difference), currency: cap.currency };
}
