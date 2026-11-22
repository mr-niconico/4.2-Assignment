// Code guards for the GR verdict (spec section 6, v2.1).
// Pure functions: no AI, no system clock. `today` is always passed in.

export type CheckValue = "YES" | "NO" | "UNCLEAR";
export type Verdict = "VALID" | "INVALID" | "NEEDS_REVIEW";

export type GrResult = {
  document_type: "PAPER_DELIVERY_RECEIPT" | "ELECTRONIC_ACKNOWLEDGEMENT" | "QR_CODE_GR" | "OTHER" | "UNREADABLE";
  extracted: {
    signer_name: string | null;
    signature_present: boolean;
    stamp_present: boolean;
    received_date: string | null;
    references_found: string[];
    qr_text: string | null;
    customer_name_on_document: string | null;
  };
  checks: {
    signer_matches_po_recipient: CheckValue;
    reference_matches: CheckValue;
    date_valid: CheckValue;
    acknowledgement_present: CheckValue;
  };
  verdict: Verdict;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
};

export type GuardContext = {
  delivery_date: string; // YYYY-MM-DD
  qr_text: string | null;
};

export type GuardedResult = GrResult & {
  ai_verdict: Verdict;
  ai_date_valid: CheckValue;
  guard_notes: string[];
};

/** True if the text is a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(text: string | null | undefined): text is string {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Received-date check (v2.1): on or after the delivery date and not after today.
 * YYYY-MM-DD strings sort in date order, so a plain text comparison is enough.
 */
export function checkReceivedDate(
  receivedDate: string | null,
  deliveryDate: string,
  today: string,
): { value: CheckValue; reason: string | null } {
  if (!isIsoDate(receivedDate)) {
    return { value: "UNCLEAR", reason: "The received date could not be read as a real date." };
  }
  if (isIsoDate(deliveryDate) && receivedDate < deliveryDate) {
    return { value: "NO", reason: `Received date ${receivedDate} is before the delivery date ${deliveryDate}.` };
  }
  if (isIsoDate(today) && receivedDate > today) {
    return { value: "NO", reason: `Received date ${receivedDate} is in the future (today is ${today}).` };
  }
  return { value: "YES", reason: null };
}

/** Apply all spec section 6 code guards to the AI's answer. */
export function applyGuards(result: GrResult, context: GuardContext, today: string): GuardedResult {
  const notes: string[] = [];
  const reasons = [...result.reasons];
  let verdict = result.verdict;

  // 1. Date check in code replaces the AI's date judgement.
  const date = checkReceivedDate(result.extracted.received_date, context.delivery_date, today);
  const checks = { ...result.checks, date_valid: date.value };
  if (date.value !== result.checks.date_valid) {
    notes.push(`Date check set by code: ${date.value} (AI said ${result.checks.date_valid})`);
  }
  if (date.reason && date.value === "NO") reasons.push(date.reason);

  // 2. Low confidence or unreadable → NEEDS_REVIEW.
  if (result.confidence === "LOW" || result.document_type === "UNREADABLE") {
    if (verdict !== "NEEDS_REVIEW") notes.push("Low confidence or unreadable → NEEDS_REVIEW");
    verdict = "NEEDS_REVIEW";
  }

  // 3. Consistency: VALID with any NO check → NEEDS_REVIEW.
  if (verdict === "VALID" && Object.values(checks).includes("NO")) {
    notes.push("VALID but a check is NO → NEEDS_REVIEW");
    verdict = "NEEDS_REVIEW";
  }

  // 4. QR-code GR without decoded QR text → NEEDS_REVIEW.
  if (result.document_type === "QR_CODE_GR" && !context.qr_text) {
    if (verdict !== "NEEDS_REVIEW") notes.push("QR code could not be read → NEEDS_REVIEW");
    verdict = "NEEDS_REVIEW";
    reasons.push("QR code could not be read.");
  }

  // A missing stamp is never a reason for INVALID: no guard looks at stamp_present.
  return {
    ...result,
    checks,
    reasons,
    verdict,
    ai_verdict: result.verdict,
    ai_date_valid: result.checks.date_valid,
    guard_notes: notes,
  };
}
