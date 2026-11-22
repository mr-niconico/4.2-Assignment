import { describe, expect, it } from "vitest";
import { addDays } from "../lib/dates";
import {
  agingBucket,
  blockers,
  dashboardKpis,
  daysOverdue,
  daysSinceDelivery,
  earlyWarningList,
  evaluateInvoice,
  isBlocked60Plus,
  isEarlyWarning,
  isPaymentReady,
  mainBlocker,
  sortEarlyWarnings,
  type Invoice,
} from "../lib/readiness";

const TODAY = "2026-11-22";

/** A payment-ready invoice, due today and delivered 30 days ago; each test changes what it needs. */
function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoice_no: "SI-TEST-001",
    customer_name: "Test Customer (fictional)",
    po_no: "PO-1",
    po_recipient_name: "Test Person",
    dr_no: "DR-1",
    invoice_date: addDays(TODAY, -30),
    delivery_date: addDays(TODAY, -30),
    due_date: TODAY,
    amount_php: 1000,
    gr_status: "VALID",
    pod_status: "RECEIVED",
    dispute_flag: "N",
    dispute_note: null,
    ...overrides,
  };
}
const overdueBy = (days: number) => ({ due_date: addDays(TODAY, -days) });
const deliveredAgo = (days: number) => ({ delivery_date: addDays(TODAY, -days) });

describe("R1 days overdue", () => {
  it("is 0 when due today or in the future", () => {
    expect(daysOverdue(invoice(), TODAY)).toBe(0);
    expect(daysOverdue(invoice({ due_date: addDays(TODAY, 10) }), TODAY)).toBe(0);
  });
  it("counts calendar days past the due date", () => {
    expect(daysOverdue(invoice(overdueBy(1)), TODAY)).toBe(1);
    expect(daysOverdue(invoice(overdueBy(45)), TODAY)).toBe(45);
  });
  it("counts correctly across a month end and leap day", () => {
    expect(daysOverdue({ due_date: "2028-02-28" }, "2028-03-01")).toBe(2);
  });
});

describe("R2 aging buckets (T2 boundaries)", () => {
  it.each([
    [0, "Current"],
    [1, "1–30"],
    [30, "1–30"],
    [31, "31–60"],
    [60, "31–60"],
    [61, "61–90"],
    [90, "61–90"],
    [91, "91–120"],
    [120, "91–120"],
    [121, "120+"],
  ] as const)("%i days overdue → %s", (days, bucket) => {
    expect(agingBucket(days)).toBe(bucket);
  });
});

describe("R3 days since delivery", () => {
  it("counts days from delivery to today", () => {
    expect(daysSinceDelivery(invoice(deliveredAgo(8)), TODAY)).toBe(8);
    expect(daysSinceDelivery(invoice(deliveredAgo(0)), TODAY)).toBe(0);
  });
});

describe("R4/R5 payment-ready and blockers (T1)", () => {
  it("all 3 conditions met → ready, no blockers", () => {
    expect(isPaymentReady(invoice())).toBe(true);
    expect(blockers(invoice())).toEqual([]);
  });
  it.each([
    [{ gr_status: "NONE" }, "GR_MISSING"],
    [{ gr_status: "RECEIVED_UNVERIFIED" }, "GR_UNVERIFIED"],
    [{ gr_status: "INVALID" }, "GR_INVALID"],
    [{ pod_status: "NONE" }, "POD_MISSING"],
    [{ dispute_flag: "Y" }, "DISPUTE"],
  ] as const)("%o → not ready, blocker %s", (change, blocker) => {
    const inv = invoice(change as Partial<Invoice>);
    expect(isPaymentReady(inv)).toBe(false);
    expect(blockers(inv)).toEqual([blocker]);
  });
  it("lists every failed condition", () => {
    expect(blockers(invoice({ gr_status: "NONE", pod_status: "NONE", dispute_flag: "Y" }))).toEqual([
      "GR_MISSING",
      "POD_MISSING",
      "DISPUTE",
    ]);
  });
  it("main blocker: GR first, then POD, then dispute", () => {
    expect(mainBlocker(["POD_MISSING", "DISPUTE", "GR_INVALID"])).toBe("GR");
    expect(mainBlocker(["DISPUTE", "POD_MISSING"])).toBe("POD");
    expect(mainBlocker(["DISPUTE"])).toBe("DISPUTE");
    expect(mainBlocker([])).toBeNull();
  });
});

describe("R6 blocked 60+", () => {
  it("60 days overdue is not blocked 60+, 61 is", () => {
    expect(isBlocked60Plus(invoice({ gr_status: "NONE", ...overdueBy(60) }), TODAY)).toBe(false);
    expect(isBlocked60Plus(invoice({ gr_status: "NONE", ...overdueBy(61) }), TODAY)).toBe(true);
  });
  it("a payment-ready invoice is never blocked, however overdue", () => {
    expect(isBlocked60Plus(invoice(overdueBy(200)), TODAY)).toBe(false);
  });
});

describe("R7 early warning (T3)", () => {
  const notVerified = { gr_status: "RECEIVED_UNVERIFIED" as const };
  it("day 7 after delivery → no warning; day 8 → warning", () => {
    expect(isEarlyWarning(invoice({ ...notVerified, ...deliveredAgo(7) }), TODAY)).toBe(false);
    expect(isEarlyWarning(invoice({ ...notVerified, ...deliveredAgo(8) }), TODAY)).toBe(true);
  });
  it("GR valid → never a warning", () => {
    expect(isEarlyWarning(invoice({ ...deliveredAgo(20), pod_status: "NONE" }), TODAY)).toBe(false);
  });
  it("60 days overdue → still a warning; 61 → moves to blocked 60+", () => {
    expect(isEarlyWarning(invoice({ ...notVerified, ...deliveredAgo(90), ...overdueBy(60) }), TODAY)).toBe(true);
    expect(isEarlyWarning(invoice({ ...notVerified, ...deliveredAgo(91), ...overdueBy(61) }), TODAY)).toBe(false);
  });
});

describe("R8 priority (T3)", () => {
  it("higher amount first; equal amounts → older delivery first", () => {
    const small = invoice({ invoice_no: "A", amount_php: 50_000, ...deliveredAgo(30) });
    const bigNew = invoice({ invoice_no: "B", amount_php: 175_000, ...deliveredAgo(10) });
    const bigOld = invoice({ invoice_no: "C", amount_php: 175_000, ...deliveredAgo(20) });
    const order = sortEarlyWarnings([small, bigNew, bigOld], TODAY).map((i) => i.invoice_no);
    expect(order).toEqual(["C", "B", "A"]);
  });
  it("earlyWarningList keeps only R7 invoices, in R8 order", () => {
    const list = earlyWarningList(
      [
        invoice({ invoice_no: "ready" }),
        invoice({ invoice_no: "w-small", gr_status: "NONE", amount_php: 10, ...deliveredAgo(9) }),
        invoice({ invoice_no: "w-big", gr_status: "INVALID", amount_php: 99, ...deliveredAgo(9) }),
        invoice({ invoice_no: "too-new", gr_status: "NONE", amount_php: 500, ...deliveredAgo(2) }),
      ],
      TODAY,
    );
    expect(list.map((i) => i.invoice_no)).toEqual(["w-big", "w-small"]);
  });
});

describe("evaluateInvoice and KPIs", () => {
  it("combines all rule results", () => {
    const result = evaluateInvoice(invoice({ gr_status: "NONE", ...overdueBy(75), ...deliveredAgo(105) }), TODAY);
    expect(result).toMatchObject({
      days_overdue: 75,
      aging_bucket: "61–90",
      days_since_delivery: 105,
      payment_ready: false,
      blockers: ["GR_MISSING"],
      main_blocker: "GR",
      blocked_60_plus: true,
      early_warning: false,
    });
  });
  it("adds amounts without rounding drift", () => {
    const kpis = dashboardKpis(
      [
        invoice({ invoice_no: "1", amount_php: 0.1 }),
        invoice({ invoice_no: "2", amount_php: 0.2 }),
        invoice({ invoice_no: "3", amount_php: 100, gr_status: "NONE", ...overdueBy(61) }),
        invoice({ invoice_no: "4", amount_php: 50, gr_status: "NONE", ...deliveredAgo(8) }),
      ],
      TODAY,
    );
    expect(kpis.total_ar_php).toBe(150.3);
    expect(kpis.payment_ready_php).toBe(0.3);
    expect(kpis.payment_ready_pct).toBe(0.2);
    expect(kpis.blocked_60_plus_count).toBe(1);
    expect(kpis.blocked_60_plus_php).toBe(100);
    expect(kpis.early_warning_count).toBe(1);
  });
});
