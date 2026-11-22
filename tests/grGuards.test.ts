import { describe, expect, it } from "vitest";
import { applyGuards, checkReceivedDate, isIsoDate, type GrResult } from "../lib/grGuards";

const TODAY = "2026-11-22";
const DELIVERY = "2026-11-21";
const context = { delivery_date: DELIVERY, qr_text: null };

// A clean VALID answer from the AI; each test changes one thing.
function aiResult(overrides: Partial<GrResult> = {}, extracted: Partial<GrResult["extracted"]> = {}): GrResult {
  return {
    document_type: "PAPER_DELIVERY_RECEIPT",
    extracted: {
      signer_name: "Manolito Bayle",
      signature_present: true,
      stamp_present: false,
      received_date: "2026-11-21",
      references_found: ["DN-2026-0845", "PO-2026-1192"],
      qr_text: null,
      customer_name_on_document: "Valda Corp.",
      ...extracted,
    },
    checks: {
      signer_matches_po_recipient: "YES",
      reference_matches: "YES",
      date_valid: "YES",
      acknowledgement_present: "YES",
    },
    verdict: "VALID",
    confidence: "HIGH",
    reasons: [],
    ...overrides,
  };
}

describe("isIsoDate", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isIsoDate("2026-11-21")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("11/21/2026")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe("checkReceivedDate (T5, v2.1)", () => {
  it("same day as delivery → YES", () => {
    expect(checkReceivedDate("2026-11-21", DELIVERY, TODAY).value).toBe("YES");
  });
  it("received today → YES", () => {
    expect(checkReceivedDate("2026-11-22", DELIVERY, TODAY).value).toBe("YES");
  });
  it("before delivery → NO", () => {
    expect(checkReceivedDate("2026-10-25", DELIVERY, TODAY).value).toBe("NO");
  });
  it("tomorrow (in the future) → NO", () => {
    expect(checkReceivedDate("2026-11-23", DELIVERY, TODAY).value).toBe("NO");
  });
  it("missing or impossible date → UNCLEAR", () => {
    expect(checkReceivedDate(null, DELIVERY, TODAY).value).toBe("UNCLEAR");
    expect(checkReceivedDate("2026-02-30", DELIVERY, TODAY).value).toBe("UNCLEAR");
  });
});

describe("applyGuards (T5)", () => {
  it("keeps a clean VALID answer VALID", () => {
    expect(applyGuards(aiResult(), context, TODAY).verdict).toBe("VALID");
  });

  it("overrides the AI when it wrongly accepts a future date", () => {
    const result = applyGuards(aiResult({}, { received_date: "2026-11-23" }), context, TODAY);
    expect(result.checks.date_valid).toBe("NO");
    expect(result.ai_date_valid).toBe("YES");
    expect(result.verdict).toBe("NEEDS_REVIEW");
    expect(result.reasons.join(" ")).toContain("in the future");
  });

  it("overrides the AI when it wrongly rejects a valid date", () => {
    const ai = aiResult({ verdict: "NEEDS_REVIEW" });
    ai.checks.date_valid = "NO";
    const result = applyGuards(ai, context, TODAY);
    expect(result.checks.date_valid).toBe("YES");
  });

  it("a date before delivery turns VALID into NEEDS_REVIEW, not INVALID", () => {
    const result = applyGuards(aiResult({}, { received_date: "2026-10-25" }), context, TODAY);
    expect(result.verdict).toBe("NEEDS_REVIEW");
  });

  it("LOW confidence → NEEDS_REVIEW", () => {
    expect(applyGuards(aiResult({ confidence: "LOW" }), context, TODAY).verdict).toBe("NEEDS_REVIEW");
  });

  it("UNREADABLE document → NEEDS_REVIEW", () => {
    expect(applyGuards(aiResult({ document_type: "UNREADABLE" }), context, TODAY).verdict).toBe("NEEDS_REVIEW");
  });

  it("VALID with a NO check → NEEDS_REVIEW", () => {
    const ai = aiResult();
    ai.checks.reference_matches = "NO";
    expect(applyGuards(ai, context, TODAY).verdict).toBe("NEEDS_REVIEW");
  });

  it("QR-code GR with no decoded QR text → NEEDS_REVIEW", () => {
    const result = applyGuards(aiResult({ document_type: "QR_CODE_GR" }), context, TODAY);
    expect(result.verdict).toBe("NEEDS_REVIEW");
  });

  it("an INVALID answer stays INVALID (guards never upgrade)", () => {
    const ai = aiResult({ verdict: "INVALID" });
    ai.checks.signer_matches_po_recipient = "NO";
    expect(applyGuards(ai, context, TODAY).verdict).toBe("INVALID");
  });

  it("a missing stamp never causes INVALID", () => {
    const result = applyGuards(aiResult({}, { stamp_present: false }), context, TODAY);
    expect(result.verdict).toBe("VALID");
  });
});
