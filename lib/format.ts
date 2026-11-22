// Display helpers (no business logic).

import type { Blocker, GrStatus, MainBlocker, PodStatus } from "./readiness";

const php = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-PH");

/** ₱1,234,567.89 */
export function formatPhp(amount: number): string {
  return `₱${php.format(amount)}`;
}

/** 1,234 */
export function formatCount(n: number): string {
  return whole.format(n);
}

/** 2026-11-22 → 22 Nov 2026 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

export const GR_LABEL: Record<GrStatus, string> = {
  NONE: "Missing",
  RECEIVED_UNVERIFIED: "Unverified",
  VALID: "Valid",
  INVALID: "Invalid",
};

export const POD_LABEL: Record<PodStatus, string> = {
  NONE: "Missing",
  RECEIVED: "Received",
};

export const BLOCKER_LABEL: Record<Blocker, string> = {
  GR_MISSING: "GR missing",
  GR_UNVERIFIED: "GR unverified",
  GR_INVALID: "GR invalid",
  POD_MISSING: "POD missing",
  DISPUTE: "Dispute",
};

export const MAIN_BLOCKER_LABEL: Record<MainBlocker, string> = {
  GR: "Goods Receipt (GR) issues",
  POD: "Proof of delivery (POD) missing",
  DISPUTE: "Disputes",
};
