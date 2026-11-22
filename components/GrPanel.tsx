"use client";

import { useEffect, useRef } from "react";
import { AgingBadge, BlockerBadges, GrBadge, PodBadge } from "@/components/Badges";
import { formatDate, formatPhp } from "@/lib/format";
import type { EvaluatedInvoice } from "@/lib/readiness";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 py-2">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{children}</dd>
    </div>
  );
}

/** Side panel for one invoice (spec 5.3). The AI GR check is added in the next step. */
export function GrPanel({ invoice, onClose }: { invoice: EvaluatedInvoice; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Close panel" onClick={onClose} className="absolute inset-0 bg-slate-900/30" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="gr-panel-title"
        className="relative z-50 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">GR check</p>
            <h2 id="gr-panel-title" className="mt-0.5 text-lg font-semibold text-slate-900">
              {invoice.customer_name}
            </h2>
            <p className="font-mono text-xs text-slate-600">{invoice.invoice_no}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            Close <span aria-hidden="true">✕</span>
          </button>
        </header>

        <div className="space-y-5 px-5 py-4">
          <section aria-labelledby="summary-heading">
            <h3 id="summary-heading" className="text-sm font-semibold text-slate-900">
              Invoice summary
            </h3>
            <dl className="mt-1 divide-y divide-slate-100">
              <Row label="Customer">{invoice.customer_name}</Row>
              <Row label="Invoice no.">{invoice.invoice_no}</Row>
              <Row label="PO no.">{invoice.po_no}</Row>
              <Row label="DR no.">{invoice.dr_no}</Row>
              <Row label="PO-named recipient">{invoice.po_recipient_name}</Row>
              <Row label="Delivery date">
                {formatDate(invoice.delivery_date)} ({invoice.days_since_delivery} days ago)
              </Row>
              <Row label="Due date">
                {formatDate(invoice.due_date)}
                {invoice.days_overdue > 0 && ` (${invoice.days_overdue} days overdue)`}
              </Row>
              <Row label="Amount">
                <span className="font-semibold tabular-nums">{formatPhp(invoice.amount_php)}</span>
              </Row>
            </dl>
          </section>

          <section aria-labelledby="status-heading">
            <h3 id="status-heading" className="text-sm font-semibold text-slate-900">
              Status
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <GrBadge status={invoice.gr_status} />
              <PodBadge status={invoice.pod_status} />
              <AgingBadge bucket={invoice.aging_bucket} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500">
                {invoice.blockers.length > 0 ? "Blocking payment:" : "Payment:"}
              </span>
              <BlockerBadges blockers={invoice.blockers} />
            </div>
            {invoice.dispute_note && (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <span className="font-medium">Dispute note:</span> {invoice.dispute_note}
              </p>
            )}
          </section>

          <section
            aria-labelledby="ai-heading"
            className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4"
          >
            <h3 id="ai-heading" className="text-sm font-semibold text-slate-900">
              Verify GR document
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Uploading a GR image for the AI check will be available here in the next step.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
