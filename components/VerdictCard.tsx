// The GR check result card (spec 5.3). Verdicts and checks always show text as well as colour.

import type { CheckValue, GuardedResult } from "@/lib/grGuards";

const VERDICT_STYLE = {
  VALID: { label: "VALID", symbol: "✓", className: "bg-emerald-50 text-emerald-800 ring-emerald-600/30" },
  INVALID: { label: "INVALID", symbol: "✕", className: "bg-red-50 text-red-800 ring-red-600/30" },
  NEEDS_REVIEW: { label: "NEEDS REVIEW", symbol: "!", className: "bg-amber-50 text-amber-900 ring-amber-600/30" },
} as const;

const CHECK_ICON: Record<CheckValue, { icon: string; text: string }> = {
  YES: { icon: "✅", text: "Yes" },
  NO: { icon: "❌", text: "No" },
  UNCLEAR: { icon: "❓", text: "Unclear" },
};

const DOC_TYPE: Record<GuardedResult["document_type"], string> = {
  PAPER_DELIVERY_RECEIPT: "Paper delivery receipt",
  ELECTRONIC_ACKNOWLEDGEMENT: "Electronic acknowledgement",
  QR_CODE_GR: "QR-code GR",
  OTHER: "Other document",
  UNREADABLE: "Unreadable",
};

const yesNo = (v: boolean) => (v ? "Yes" : "No");
const orDash = (v: string | null) => (v && v.trim() ? v : "—");

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9.5rem_1fr] gap-3 py-1.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="break-words text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function CheckRow({ label, value }: { label: string; value: CheckValue }) {
  const c = CHECK_ICON[value];
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-slate-700">{label}</span>
      <span className="whitespace-nowrap font-medium text-slate-900">
        <span aria-hidden="true">{c.icon}</span> {c.text}
      </span>
    </li>
  );
}

export function VerdictCard({ result }: { result: GuardedResult }) {
  const v = VERDICT_STYLE[result.verdict];
  const e = result.extracted;

  return (
    <div className="space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-base font-semibold ring-1 ring-inset ${v.className}`}
        >
          <span aria-hidden="true">{v.symbol}</span>
          {v.label}
        </span>
        <span className="text-sm text-slate-600">
          Confidence: <span className="font-medium text-slate-900">{result.confidence.toLowerCase()}</span>
        </span>
      </div>

      <section aria-labelledby="checks-heading">
        <h4 id="checks-heading" className="text-sm font-semibold text-slate-900">
          Checklist
        </h4>
        <ul className="mt-1 divide-y divide-slate-100">
          <CheckRow label="Signer matches PO recipient" value={result.checks.signer_matches_po_recipient} />
          <CheckRow label="Reference matches DR / PO / invoice" value={result.checks.reference_matches} />
          <CheckRow label="Received date is valid" value={result.checks.date_valid} />
          <CheckRow label="Acknowledgement present" value={result.checks.acknowledgement_present} />
        </ul>
      </section>

      {result.reasons.length > 0 && (
        <section aria-labelledby="reasons-heading">
          <h4 id="reasons-heading" className="text-sm font-semibold text-slate-900">
            Reasons
          </h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {result.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="extracted-heading">
        <h4 id="extracted-heading" className="text-sm font-semibold text-slate-900">
          Read from the document
        </h4>
        <dl className="mt-1 divide-y divide-slate-100">
          <Field label="Document type">{DOC_TYPE[result.document_type]}</Field>
          <Field label="Signer name">{orDash(e.signer_name)}</Field>
          <Field label="Signature present">{yesNo(e.signature_present)}</Field>
          <Field label="Stamp present">
            {yesNo(e.stamp_present)} <span className="text-slate-500">(for information only)</span>
          </Field>
          <Field label="Received date">{orDash(e.received_date)}</Field>
          <Field label="References found">{e.references_found.length ? e.references_found.join(", ") : "—"}</Field>
          {e.qr_text && <Field label="QR content">{e.qr_text}</Field>}
          <Field label="Customer on document">{orDash(e.customer_name_on_document)}</Field>
        </dl>
      </section>

      {result.guard_notes.length > 0 && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
          Checked by code: {result.guard_notes.join("; ")}.
        </p>
      )}

      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        AI decision support – confirm before acting.
      </p>
    </div>
  );
}
