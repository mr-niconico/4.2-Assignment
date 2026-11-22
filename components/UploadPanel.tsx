"use client";

import { useRef } from "react";
import { formatCount } from "@/lib/format";
import { formatRowError, type RowError } from "@/lib/csv";

export type LoadInfo = { source: string; loaded: number; skipped: number; asOf: string };

type Props = {
  onFile: (file: File) => void;
  onSample: () => void;
  fileError: string | null;
  rowErrors: RowError[];
  info: LoadInfo | null;
  busy: boolean;
};

export function UploadPanel({ onFile, onSample, fileError, rowErrors, info, busy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section aria-labelledby="upload-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="upload-heading" className="text-base font-semibold text-slate-900">
            Invoice register
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Upload your invoice register to see which invoices are blocked from payment by a missing or invalid Goods
            Receipt, and which ones to chase first.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="csv-upload"
            className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-slate-900"
          >
            Upload CSV
            <input
              id="csv-upload"
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
                if (inputRef.current) inputRef.current.value = ""; // allow re-uploading the same file
              }}
            />
          </label>
          <button
            type="button"
            onClick={onSample}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Load sample data
          </button>
          <a
            href="/sample/invoice-template.csv"
            download="invoice-template.csv"
            className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline"
          >
            Download template
          </a>
        </div>
      </div>

      {fileError && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span aria-hidden="true">✕ </span>
          {fileError}
        </p>
      )}

      {info && !fileError && (
        <p className="mt-4 text-sm text-slate-600" aria-live="polite">
          <span className="font-medium text-slate-900">{info.source}</span> · {formatCount(info.loaded)} invoices loaded
          {info.skipped > 0 && <> · {formatCount(info.skipped)} rows skipped</>} · figures as of {info.asOf}
        </p>
      )}

      {rowErrors.length > 0 && (
        <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <summary className="cursor-pointer font-medium">
            <span aria-hidden="true">! </span>
            {formatCount(rowErrors.length)} problem{rowErrors.length === 1 ? "" : "s"} found; those rows were skipped
            (click to see)
          </summary>
          <ul className="mt-2 max-h-56 list-disc space-y-0.5 overflow-auto pl-5">
            {rowErrors.map((e, i) => (
              <li key={i}>{formatRowError(e)}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
