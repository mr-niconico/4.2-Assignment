// Follow-up routing (spec section 7): CODE decides who the message goes to; the AI only writes the text.
// The credit team owns and sends every follow-up. Pure functions, no dates from the clock.
// Imports use ".ts" endings so plain Node can load this file too.

import type { DisputeFlag, GrStatus, PodStatus } from "./readiness.ts";

export type RecipientType = "INTERNAL_LOGISTICS" | "CUSTOMER_RECEIVING" | "INTERNAL_SALES" | "CUSTOMER_AP";
export type Situation = "GR_MISSING" | "GR_INVALID" | "POD_MISSING" | "DISPUTE" | "OVERDUE_READY";

/** The routing table from spec section 7. */
export const ROUTING: Record<Situation, { recipient: RecipientType; label: string; request: string }> = {
  GR_MISSING: {
    recipient: "INTERNAL_LOGISTICS",
    label: "GR missing",
    request: "retrieve the signed Goods Receipt / delivery receipt for this delivery, including from the courier",
  },
  GR_INVALID: {
    recipient: "CUSTOMER_RECEIVING",
    label: "GR invalid",
    request: "re-acknowledge receipt of this delivery, signed by the person named in the Purchase Order",
  },
  POD_MISSING: {
    recipient: "INTERNAL_LOGISTICS",
    label: "POD missing",
    request: "send the proof of delivery (POD) for this delivery",
  },
  DISPUTE: {
    recipient: "INTERNAL_SALES",
    label: "Dispute",
    request: "help resolve the open dispute with the customer as the account owner",
  },
  OVERDUE_READY: {
    recipient: "CUSTOMER_AP",
    label: "Payment-ready but overdue",
    request: "schedule payment of this overdue invoice, which is complete and ready for payment",
  },
};

export const RECIPIENT_LABEL: Record<RecipientType, string> = {
  INTERNAL_LOGISTICS: "Internal – Logistics",
  CUSTOMER_RECEIVING: "Customer – Receiving",
  INTERNAL_SALES: "Internal – Sales (account owner)",
  CUSTOMER_AP: "Customer – Accounts Payable",
};

export type RoutingInput = {
  gr_status: GrStatus;
  pod_status: PodStatus;
  dispute_flag: DisputeFlag;
  days_overdue: number;
};

export type RoutingDecision =
  | { draft: true; situation: Situation; recipient: RecipientType }
  | { draft: false; reason: string };

/**
 * Which follow-up to draft. With several blockers, the first one in this order is chased first
 * (same order as the Blocked 60+ grouping: GR, then POD, then dispute).
 * Not in the spec's table, so no draft: a GR that is received but unverified (verify it first),
 * and a payment-ready invoice that is not overdue (nothing to chase).
 */
export function routeFollowup(inv: RoutingInput): RoutingDecision {
  const pick = (situation: Situation): RoutingDecision => ({
    draft: true,
    situation,
    recipient: ROUTING[situation].recipient,
  });

  if (inv.gr_status === "NONE") return pick("GR_MISSING");
  if (inv.gr_status === "INVALID") return pick("GR_INVALID");
  if (inv.gr_status === "RECEIVED_UNVERIFIED") {
    return {
      draft: false,
      reason: "The GR has been received but not verified yet. Check the GR first; a follow-up depends on the result.",
    };
  }
  if (inv.pod_status === "NONE") return pick("POD_MISSING");
  if (inv.dispute_flag === "Y") return pick("DISPUTE");
  if (inv.days_overdue > 0) return pick("OVERDUE_READY");
  return { draft: false, reason: "This invoice is payment-ready and not yet due, so no follow-up is needed." };
}
