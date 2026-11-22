// Amount-based prioritisation (spec 5.2, v2.2): amount filters, sorting and summaries.
// Pure functions: no UI, no dates.

import type { Invoice } from "./readiness";

// ---------- amount presets ----------
// Upper limits are exclusive ("below 50,000"), so amounts with centavos such as ₱49,999.99 or
// ₱99,999.50 always fall into exactly one preset.

export type AmountPresetId = "ALL" | "500K_PLUS" | "100K_TO_500K" | "50K_TO_100K" | "UNDER_50K";

export type AmountPreset = { id: AmountPresetId; label: string; min: number | null; below: number | null };

export const AMOUNT_PRESETS: AmountPreset[] = [
  { id: "ALL", label: "All", min: null, below: null },
  { id: "500K_PLUS", label: "≥ ₱500,000", min: 500_000, below: null },
  { id: "100K_TO_500K", label: "₱100,000–499,999", min: 100_000, below: 500_000 },
  { id: "50K_TO_100K", label: "₱50,000–99,999", min: 50_000, below: 100_000 },
  { id: "UNDER_50K", label: "< ₱50,000", min: null, below: 50_000 },
];

export type AmountFilter = { preset: AmountPresetId; minAmount: number | null };

export const NO_AMOUNT_FILTER: AmountFilter = { preset: "ALL", minAmount: null };

const presetById = (id: AmountPresetId) => AMOUNT_PRESETS.find((p) => p.id === id) ?? AMOUNT_PRESETS[0];

/** True if the amount passes both the preset range and the custom minimum (if any). */
export function matchesAmount(amount: number, filter: AmountFilter): boolean {
  const preset = presetById(filter.preset);
  if (preset.min !== null && amount < preset.min) return false;
  if (preset.below !== null && amount >= preset.below) return false;
  if (filter.minAmount !== null && amount < filter.minAmount) return false;
  return true;
}

export function filterByAmount<T extends Pick<Invoice, "amount_php">>(invoices: T[], filter: AmountFilter): T[] {
  return invoices.filter((inv) => matchesAmount(inv.amount_php, filter));
}

export function isAmountFilterActive(filter: AmountFilter): boolean {
  return filter.preset !== "ALL" || filter.minAmount !== null;
}

/**
 * Read the "Minimum amount" box. Accepts "100000", "100,000", "₱100,000.50".
 * Empty → no minimum. Anything else that is not a number ≥ 0 → invalid.
 */
export function parseMinAmount(text: string): { value: number | null; valid: boolean } {
  const cleaned = text.replace(/[₱,\s]/g, "");
  if (cleaned === "") return { value: null, valid: true };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { value: null, valid: false };
  return { value: Number(cleaned), valid: true };
}

// ---------- sorting ----------

export type SortKey = "amount" | "days";
export type SortDirection = "desc" | "asc";
export type SortState = { key: SortKey; direction: SortDirection };

export const SORT_BY_AMOUNT: SortState = { key: "amount", direction: "desc" };

/**
 * Sort by amount or by a "days" figure (days overdue or days since delivery, chosen by the caller).
 * Ties: amount (highest first), then invoice number, so the order is always the same.
 */
export function sortInvoices<T extends Pick<Invoice, "amount_php" | "invoice_no">>(
  invoices: T[],
  sort: SortState,
  days: (invoice: T) => number,
): T[] {
  const sign = sort.direction === "desc" ? -1 : 1;
  return [...invoices].sort((a, b) => {
    const primary =
      sort.key === "amount" ? (a.amount_php - b.amount_php) * sign : (days(a) - days(b)) * sign;
    return primary || b.amount_php - a.amount_php || a.invoice_no.localeCompare(b.invoice_no);
  });
}

/** Clicking a column header: same column flips the direction; a new column starts highest first. */
export function nextSort(current: SortState | null, key: SortKey): SortState {
  if (current && current.key === key) return { key, direction: current.direction === "desc" ? "asc" : "desc" };
  return { key, direction: "desc" };
}

// ---------- summary ----------

/** Count and total (added in centavos to avoid rounding drift). */
export function summarize(invoices: Pick<Invoice, "amount_php">[]): { count: number; total: number } {
  const centavos = invoices.reduce((sum, inv) => sum + Math.round(inv.amount_php * 100), 0);
  return { count: invoices.length, total: centavos / 100 };
}
