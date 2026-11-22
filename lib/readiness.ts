// Business rules R1–R8 (spec section 4).
// Pure functions: no UI, no AI, no system clock. `today` (YYYY-MM-DD) is always passed in.

import { daysBetween } from "./dates";

export const GR_STATUSES = ["NONE", "RECEIVED_UNVERIFIED", "VALID", "INVALID"] as const;
export const POD_STATUSES = ["NONE", "RECEIVED"] as const;
export const DISPUTE_FLAGS = ["Y", "N"] as const;

export type GrStatus = (typeof GR_STATUSES)[number];
export type PodStatus = (typeof POD_STATUSES)[number];
export type DisputeFlag = (typeof DISPUTE_FLAGS)[number];

/** One invoice from the register (spec section 3), after validation. */
export type Invoice = {
  invoice_no: string;
  customer_name: string;
  po_no: string;
  po_recipient_name: string;
  dr_no: string;
  invoice_date: string;
  delivery_date: string;
  due_date: string;
  amount_php: number;
  gr_status: GrStatus;
  pod_status: PodStatus;
  dispute_flag: DisputeFlag;
  dispute_note: string | null;
};

export const AGING_BUCKETS = ["Current", "1–30", "31–60", "61–90", "91–120", "120+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export type Blocker = "GR_MISSING" | "GR_UNVERIFIED" | "GR_INVALID" | "POD_MISSING" | "DISPUTE";
export type MainBlocker = "GR" | "POD" | "DISPUTE";

// R1 – Days overdue: max(0, today − due_date)
export function daysOverdue(invoice: Pick<Invoice, "due_date">, today: string): number {
  return Math.max(0, daysBetween(invoice.due_date, today));
}

// R2 – Aging bucket from days overdue
export function agingBucket(overdueDays: number): AgingBucket {
  if (overdueDays <= 0) return "Current";
  if (overdueDays <= 30) return "1–30";
  if (overdueDays <= 60) return "31–60";
  if (overdueDays <= 90) return "61–90";
  if (overdueDays <= 120) return "91–120";
  return "120+";
}

// R3 – Days since delivery: today − delivery_date
export function daysSinceDelivery(invoice: Pick<Invoice, "delivery_date">, today: string): number {
  return daysBetween(invoice.delivery_date, today);
}

// R4 – Payment-ready: GR valid AND POD received AND no dispute
export function isPaymentReady(invoice: Pick<Invoice, "gr_status" | "pod_status" | "dispute_flag">): boolean {
  return invoice.gr_status === "VALID" && invoice.pod_status === "RECEIVED" && invoice.dispute_flag === "N";
}

// R5 – Blockers: every condition that stops payment
export function blockers(invoice: Pick<Invoice, "gr_status" | "pod_status" | "dispute_flag">): Blocker[] {
  const list: Blocker[] = [];
  if (invoice.gr_status === "NONE") list.push("GR_MISSING");
  if (invoice.gr_status === "RECEIVED_UNVERIFIED") list.push("GR_UNVERIFIED");
  if (invoice.gr_status === "INVALID") list.push("GR_INVALID");
  if (invoice.pod_status === "NONE") list.push("POD_MISSING");
  if (invoice.dispute_flag === "Y") list.push("DISPUTE");
  return list;
}

/** Main blocker for grouping the Blocked 60+ tab: GR first, then POD, then dispute (spec 5.2). */
export function mainBlocker(list: Blocker[]): MainBlocker | null {
  if (list.some((b) => b.startsWith("GR_"))) return "GR";
  if (list.includes("POD_MISSING")) return "POD";
  if (list.includes("DISPUTE")) return "DISPUTE";
  return null;
}

// R6 – Blocked 60+: not payment-ready AND more than 60 days overdue
export function isBlocked60Plus(invoice: Invoice, today: string): boolean {
  return !isPaymentReady(invoice) && daysOverdue(invoice, today) > 60;
}

// R7 – Early warning: GR not valid AND delivered more than 7 days ago AND at most 60 days overdue
export function isEarlyWarning(invoice: Invoice, today: string): boolean {
  return (
    invoice.gr_status !== "VALID" && daysSinceDelivery(invoice, today) > 7 && daysOverdue(invoice, today) <= 60
  );
}

// R8 – Priority: largest amount first, then oldest delivery first (invoice no. as a final tie-break)
export function sortEarlyWarnings<T extends Invoice>(invoices: T[], today: string): T[] {
  return [...invoices].sort(
    (a, b) =>
      b.amount_php - a.amount_php ||
      daysSinceDelivery(b, today) - daysSinceDelivery(a, today) ||
      a.invoice_no.localeCompare(b.invoice_no),
  );
}

/** All rule results for one invoice, ready for the dashboard. */
export type EvaluatedInvoice = Invoice & {
  days_overdue: number;
  aging_bucket: AgingBucket;
  days_since_delivery: number;
  payment_ready: boolean;
  blockers: Blocker[];
  main_blocker: MainBlocker | null;
  blocked_60_plus: boolean;
  early_warning: boolean;
};

export function evaluateInvoice(invoice: Invoice, today: string): EvaluatedInvoice {
  const overdue = daysOverdue(invoice, today);
  const list = blockers(invoice);
  return {
    ...invoice,
    days_overdue: overdue,
    aging_bucket: agingBucket(overdue),
    days_since_delivery: daysSinceDelivery(invoice, today),
    payment_ready: isPaymentReady(invoice),
    blockers: list,
    main_blocker: mainBlocker(list),
    blocked_60_plus: isBlocked60Plus(invoice, today),
    early_warning: isEarlyWarning(invoice, today),
  };
}

/** Early-warning list (R7), in priority order (R8). */
export function earlyWarningList(invoices: Invoice[], today: string): EvaluatedInvoice[] {
  const flagged = invoices.filter((inv) => isEarlyWarning(inv, today)).map((inv) => evaluateInvoice(inv, today));
  return sortEarlyWarnings(flagged, today);
}

const toCentavos = (amount: number) => Math.round(amount * 100);
const fromCentavos = (centavos: number) => centavos / 100;

/** KPI tiles (spec 5.2). Amounts are added in centavos to avoid rounding drift. */
export function dashboardKpis(invoices: Invoice[], today: string) {
  let total = 0;
  let ready = 0;
  let blocked = 0;
  let blockedCount = 0;
  let earlyWarnings = 0;

  for (const inv of invoices) {
    const amount = toCentavos(inv.amount_php);
    total += amount;
    if (isPaymentReady(inv)) ready += amount;
    if (isBlocked60Plus(inv, today)) {
      blocked += amount;
      blockedCount += 1;
    }
    if (isEarlyWarning(inv, today)) earlyWarnings += 1;
  }

  return {
    total_ar_php: fromCentavos(total),
    payment_ready_php: fromCentavos(ready),
    payment_ready_pct: total === 0 ? 0 : Math.round((ready / total) * 1000) / 10,
    blocked_60_plus_count: blockedCount,
    blocked_60_plus_php: fromCentavos(blocked),
    early_warning_count: earlyWarnings,
  };
}
