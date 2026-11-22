// POST /api/draft-followup – AI feature 2 (spec sections 7 and 8).
// Request (JSON): { invoice: {...}, gr_reasons: string[] }.
// CODE decides the recipient, the request, the target date and all numbers; the AI only writes the text.
// Logs never contain names, notes or the drafted text – only the kind of failure.

import {
  countWords,
  draftFollowup,
  ensureReferences,
  normalizeDraftText,
  type FollowupFacts,
  type VerifyFailure,
} from "@/lib/ai.ts";
import { addWorkingDays, daysBetween, formatLongDate, todayInManila } from "@/lib/dates";
import { formatDate, formatPhp } from "@/lib/format";
import { RECIPIENT_LABEL, ROUTING, routeFollowup } from "@/lib/followupRouting.ts";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";
import { DraftRequestSchema, type DraftResponse } from "@/lib/schemas.ts";

export const maxDuration = 60; // up to two AI calls of 30 s

const rateLimit = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 }); // 20 drafts per 10 minutes per IP
const MAX_BODY_BYTES = 16 * 1024;
const TARGET_WORKING_DAYS = 3;

const UNAVAILABLE = "The AI draft is unavailable, please try again.";
const FAILURE_MESSAGE: Record<VerifyFailure, { status: number; message: string }> = {
  TIMEOUT: { status: 504, message: "The AI draft took too long. Please try again." },
  AUTH: { status: 500, message: "Service not configured." },
  CREDITS: { status: 503, message: UNAVAILABLE },
  MODEL: { status: 500, message: "Service not configured." },
  RATE_LIMITED: { status: 503, message: UNAVAILABLE },
  PROVIDER: { status: 503, message: UNAVAILABLE },
  NETWORK: { status: 503, message: UNAVAILABLE },
};

const reply = (body: DraftResponse, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers });
const fail = (status: number, error: string, headers?: HeadersInit) => reply({ ok: false, error }, status, headers);

export async function POST(request: Request) {
  // 1. Server configuration.
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const modelId = process.env.OPENROUTER_MODEL?.trim();
  if (!apiKey || !modelId) {
    console.error("[draft-followup] not configured: OPENROUTER_API_KEY or OPENROUTER_MODEL is missing");
    return fail(500, "Service not configured.");
  }

  // 2. Per-IP rate limit.
  const limited = rateLimit(clientIp(request.headers), Date.now());
  if (!limited.allowed) {
    return fail(429, "Too many drafts, please wait a few minutes.", { "Retry-After": String(limited.retryAfterSeconds) });
  }

  // 3. Validate the request.
  const text = await request.text().catch(() => "");
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return fail(413, "The request is too large.");
  }
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  const parsed = DraftRequestSchema.safeParse(json);
  if (!parsed.success) {
    return fail(400, "The invoice details are incomplete. Please reload and try again.");
  }
  const { invoice, gr_reasons } = parsed.data;

  // 4. Code decides the routing and every fact (calculations in code, wording by AI).
  const today = todayInManila();
  const daysOverdue = Math.max(0, daysBetween(invoice.due_date, today));
  const decision = routeFollowup({ ...invoice, days_overdue: daysOverdue });
  if (!decision.draft) {
    return fail(422, decision.reason);
  }
  const route = ROUTING[decision.situation];
  const targetDate = formatLongDate(addWorkingDays(today, TARGET_WORKING_DAYS));
  const facts: FollowupFacts = {
    recipient: RECIPIENT_LABEL[decision.recipient],
    situation: route.label,
    request: route.request,
    target_date: targetDate,
    customer_name: invoice.customer_name,
    invoice_no: invoice.invoice_no,
    po_no: invoice.po_no,
    dr_no: invoice.dr_no,
    amount: formatPhp(invoice.amount_php),
    delivery_date: formatDate(invoice.delivery_date),
    due_date: formatDate(invoice.due_date),
    days_overdue: daysOverdue,
    po_recipient_name: decision.situation === "GR_INVALID" ? invoice.po_recipient_name : null,
    dispute_note: decision.situation === "DISPUTE" ? invoice.dispute_note : null,
    gr_check_reasons: decision.situation === "GR_INVALID" ? gr_reasons : [],
  };

  // 5. AI writes the text.
  const outcome = await draftFollowup({ apiKey, modelId, facts });
  if (!outcome.ok) {
    console.error(`[draft-followup] AI call failed: ${outcome.failure}${outcome.status ? ` (HTTP ${outcome.status})` : ""}`);
    const { status, message } = FAILURE_MESSAGE[outcome.failure];
    return fail(status, message);
  }

  // Code guarantee: the invoice, PO and DR numbers and the amount are always quoted.
  const body = ensureReferences(normalizeDraftText(outcome.body), facts);

  return reply({
    ok: true,
    draft: {
      recipient_type: decision.recipient,
      recipient_label: RECIPIENT_LABEL[decision.recipient],
      situation_label: route.label,
      target_date: targetDate,
      subject: outcome.subject,
      body,
      word_count: countWords(body),
    },
  });
}
