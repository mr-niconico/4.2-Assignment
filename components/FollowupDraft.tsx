"use client";

import { useState } from "react";
import { RECIPIENT_LABEL, ROUTING, routeFollowup } from "@/lib/followupRouting";
import type { EvaluatedInvoice } from "@/lib/readiness";
import type { DraftResponse, FollowupDraft as Draft } from "@/lib/schemas";

type Props = {
  invoice: EvaluatedInvoice;
  grReasons: string[];
  savedDraft: Draft | null;
  onDraft: (draft: Draft) => void;
};

/** "Draft follow-up" (spec 5.3 and 7): code picks the recipient, the AI writes the text, the user copies it. */
export function FollowupDraft({ invoice, grReasons, savedDraft, onDraft }: Props) {
  const decision = routeFollowup(invoice);
  // A saved draft only applies while the situation is the same (e.g. not after a new GR verdict).
  const initial = decision.draft && savedDraft?.situation_label === ROUTING[decision.situation].label ? savedDraft : null;
  const [draft, setDraft] = useState<Draft | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  if (!decision.draft) {
    return <p className="text-sm text-slate-600">{decision.reason}</p>;
  }
  const route = ROUTING[decision.situation];
  const shown = draft?.situation_label === route.label ? draft : null;

  async function create() {
    setBusy(true);
    setError(null);
    setCopied("idle");
    try {
      const res = await fetch("/api/draft-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice: {
            invoice_no: invoice.invoice_no,
            customer_name: invoice.customer_name,
            po_no: invoice.po_no,
            po_recipient_name: invoice.po_recipient_name,
            dr_no: invoice.dr_no,
            delivery_date: invoice.delivery_date,
            due_date: invoice.due_date,
            amount_php: invoice.amount_php,
            gr_status: invoice.gr_status,
            pod_status: invoice.pod_status,
            dispute_flag: invoice.dispute_flag,
            dispute_note: invoice.dispute_note,
          },
          gr_reasons: grReasons.slice(0, 6).map((r) => r.slice(0, 300)),
        }),
      });
      const data = (await res.json().catch(() => null)) as DraftResponse | null;
      if (!data) throw new Error("bad response");
      if (!data.ok) {
        setError(data.error);
        return;
      }
      setDraft(data.draft);
      onDraft(data.draft);
    } catch {
      setError("The AI draft is unavailable, please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${shown.subject}\n\n${shown.body}`);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        <span className="font-medium text-slate-900">{route.label}</span> → message to{" "}
        <span className="font-medium text-slate-900">{RECIPIENT_LABEL[decision.recipient]}</span>, sent by the credit
        team.
      </p>

      <button
        type="button"
        onClick={create}
        disabled={busy}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-60"
      >
        {shown ? "Draft again" : "Draft follow-up"}
      </button>

      {busy && (
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800"
          />
          Writing draft…
        </p>
      )}

      {error && !busy && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}

      {shown && !busy && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4" aria-live="polite">
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-slate-500">To</dt>
              <dd className="font-medium text-slate-900">
                {shown.recipient_label} <span className="font-mono text-xs text-slate-500">({shown.recipient_type})</span>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-slate-500">Subject</dt>
              <dd className="text-slate-900">{shown.subject}</dd>
            </div>
          </dl>
          <div className="whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800">
            {shown.body}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {shown.word_count} words · target date {shown.target_date}
            </p>
            <button
              type="button"
              onClick={copy}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              {copied === "copied" ? "Copied ✓" : "Copy"}
            </button>
          </div>
          {copied === "failed" && (
            <p role="alert" className="text-xs text-red-700">
              Copying was blocked by the browser. Select the text and press Ctrl+C instead.
            </p>
          )}
          <p className="text-xs text-slate-500">AI draft – review and edit before sending.</p>
        </div>
      )}
    </div>
  );
}
