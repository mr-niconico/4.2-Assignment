import { describe, expect, it } from "vitest";
import { invoicesToCsv, parseInvoiceCsv } from "../lib/csv";
import { AGING_BUCKETS, dashboardKpis, earlyWarningList, evaluateInvoice } from "../lib/readiness";
import { generateSampleInvoices, SAMPLE_CUSTOMERS } from "../lib/sampleData";

// The demo must work whenever it is opened: test several "todays".
const TODAYS = ["2026-11-22", "2026-11-29", "2027-01-15", "2027-06-30", "2028-02-29"];

describe.each(TODAYS)("sample data generated on %s", (today) => {
  const invoices = generateSampleInvoices(today);
  const evaluated = invoices.map((inv) => evaluateInvoice(inv, today));

  it("has 40 invoices across 15 fictional customers", () => {
    expect(invoices).toHaveLength(40);
    expect(new Set(invoices.map((i) => i.customer_name)).size).toBe(15);
    expect(invoices.every((i) => (SAMPLE_CUSTOMERS as readonly string[]).includes(i.customer_name))).toBe(true);
  });

  it("passes the CSV validation with no errors (round trip)", () => {
    const result = parseInvoiceCsv(invoicesToCsv(invoices));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.errors).toEqual([]);
      expect(result.invoices).toEqual(invoices);
    }
  });

  it("covers every situation", () => {
    const has = (pred: (e: (typeof evaluated)[number]) => boolean) => evaluated.some(pred);
    expect(has((e) => e.payment_ready && e.days_overdue === 0)).toBe(true);
    expect(has((e) => e.payment_ready && e.days_overdue > 0)).toBe(true);
    for (const blocker of ["GR_MISSING", "GR_UNVERIFIED", "GR_INVALID", "POD_MISSING", "DISPUTE"] as const) {
      expect(has((e) => e.blockers.includes(blocker))).toBe(true);
    }
    for (const group of ["GR", "POD", "DISPUTE"] as const) {
      expect(has((e) => e.blocked_60_plus && e.main_blocker === group)).toBe(true);
    }
    for (const bucket of AGING_BUCKETS) {
      expect(has((e) => e.aging_bucket === bucket)).toBe(true);
    }
    expect(has((e) => !e.early_warning && e.gr_status !== "VALID" && e.days_since_delivery <= 7)).toBe(true);
  });

  it("shows plenty of early warnings and blocked 60+ items", () => {
    const kpis = dashboardKpis(invoices, today);
    expect(kpis.early_warning_count).toBeGreaterThanOrEqual(10);
    expect(kpis.blocked_60_plus_count).toBeGreaterThanOrEqual(10);
  });

  it("includes the invoice for the test GR photo as an early warning whose GR date is valid", () => {
    const valda = evaluated.find((e) => e.invoice_no === "SI-2026-00123");
    expect(valda).toMatchObject({
      customer_name: "Valda Corp.",
      po_no: "PO-2026-1192",
      dr_no: "DN-2026-0845",
      po_recipient_name: "Manolito Bayle",
      amount_php: 86000,
      gr_status: "RECEIVED_UNVERIFIED",
      early_warning: true,
    });
    // The photo's received date (2026-11-21) must be on or after the delivery date.
    expect(valda!.delivery_date <= "2026-11-21").toBe(true);
    expect(earlyWarningList(invoices, today).some((e) => e.invoice_no === "SI-2026-00123")).toBe(true);
  });
});
