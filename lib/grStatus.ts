// How a GR verdict changes the invoice's GR status for the session (spec 5.3).

import type { GrStatus } from "./readiness";

export type Verdict = "VALID" | "INVALID" | "NEEDS_REVIEW";

/** VALID → VALID, INVALID → INVALID, NEEDS_REVIEW → RECEIVED_UNVERIFIED (a document was received but not confirmed). */
export function grStatusAfterVerdict(verdict: Verdict): GrStatus {
  if (verdict === "VALID") return "VALID";
  if (verdict === "INVALID") return "INVALID";
  return "RECEIVED_UNVERIFIED";
}
