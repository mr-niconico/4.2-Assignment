import { describe, expect, it } from "vitest";
import { countWords, ensureReferences, normalizeDraftText } from "../lib/ai";
import { addWorkingDays, formatLongDate } from "../lib/dates";
import { routeFollowup, type RoutingInput } from "../lib/followupRouting";

const ready: RoutingInput = { gr_status: "VALID", pod_status: "RECEIVED", dispute_flag: "N", days_overdue: 0 };

describe("follow-up routing (T6, spec section 7)", () => {
  it.each([
    ["GR missing", { gr_status: "NONE" }, "GR_MISSING", "INTERNAL_LOGISTICS"],
    ["GR invalid", { gr_status: "INVALID" }, "GR_INVALID", "CUSTOMER_RECEIVING"],
    ["POD missing", { pod_status: "NONE" }, "POD_MISSING", "INTERNAL_LOGISTICS"],
    ["Dispute", { dispute_flag: "Y" }, "DISPUTE", "INTERNAL_SALES"],
    ["Payment-ready but overdue", { days_overdue: 1 }, "OVERDUE_READY", "CUSTOMER_AP"],
  ] as const)("%s → %s, addressed to %s", (_name, change, situation, recipient) => {
    expect(routeFollowup({ ...ready, ...change } as RoutingInput)).toEqual({ draft: true, situation, recipient });
  });

  it("several blockers: GR first, then POD, then dispute", () => {
    expect(routeFollowup({ gr_status: "NONE", pod_status: "NONE", dispute_flag: "Y", days_overdue: 90 })).toMatchObject({
      situation: "GR_MISSING",
    });
    expect(routeFollowup({ gr_status: "VALID", pod_status: "NONE", dispute_flag: "Y", days_overdue: 90 })).toMatchObject({
      situation: "POD_MISSING",
    });
    expect(routeFollowup({ ...ready, dispute_flag: "Y", days_overdue: 90 })).toMatchObject({ situation: "DISPUTE" });
  });

  it("GR received but not verified → no draft (verify first)", () => {
    const decision = routeFollowup({ ...ready, gr_status: "RECEIVED_UNVERIFIED", pod_status: "NONE" });
    expect(decision.draft).toBe(false);
    if (!decision.draft) expect(decision.reason).toContain("Check the GR first");
  });

  it("payment-ready and not overdue → no draft", () => {
    const decision = routeFollowup(ready);
    expect(decision.draft).toBe(false);
  });
});

describe("target date: 3 working days", () => {
  it.each([
    ["2026-11-23", "2026-11-26"], // Monday → Thursday
    ["2026-11-26", "2026-12-01"], // Thursday → Tuesday (skips the weekend)
    ["2026-11-28", "2026-12-02"], // Saturday → Wednesday
    ["2026-11-29", "2026-12-02"], // Sunday → Wednesday
  ])("from %s → %s", (from, to) => {
    expect(addWorkingDays(from, 3)).toBe(to);
  });
  it("is written out in full", () => {
    expect(formatLongDate("2026-11-26")).toBe("Thursday, 26 November 2026");
  });
});

describe("draft text guarantees", () => {
  const facts = { invoice_no: "SI-2026-00123", po_no: "PO-2026-1192", dr_no: "DN-2026-0845", amount: "₱86,000.00" };

  it("keeps a body that already quotes every reference", () => {
    const body = "Invoice SI-2026-00123, PO PO-2026-1192, DR DN-2026-0845 for PHP 86,000.\n\n[Your name]\nCredit Team";
    expect(ensureReferences(body, facts)).toBe(body);
  });

  it("adds a reference line before the sign-off when something is missing", () => {
    const body = "Please send the signed receipt for invoice SI-2026-00123.\n\n[Your name]\nCredit Team";
    const fixed = ensureReferences(body, facts);
    expect(fixed).toContain("Reference: Invoice SI-2026-00123 · PO PO-2026-1192 · DR DN-2026-0845 · ₱86,000.00");
    expect(fixed.indexOf("Reference:")).toBeLessThan(fixed.indexOf("[Your name]"));
  });

  it("adds the reference line at the end when there is no sign-off", () => {
    expect(ensureReferences("Short note.", facts).endsWith("₱86,000.00")).toBe(true);
  });

  it("turns escaped line breaks into real ones, and leaves normal text alone", () => {
    expect(normalizeDraftText("Dear Team,\\n\\nPlease send.\\n[Your name]")).toBe("Dear Team,\n\nPlease send.\n[Your name]");
    expect(normalizeDraftText("Line one\nLine two")).toBe("Line one\nLine two");
  });

  it("counts words", () => {
    expect(countWords("  Hello  there,\nCredit Team ")).toBe(4);
    expect(countWords("")).toBe(0);
  });
});
