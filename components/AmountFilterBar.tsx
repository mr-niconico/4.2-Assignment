"use client";

import { useState } from "react";
import {
  AMOUNT_PRESETS,
  isAmountFilterActive,
  NO_AMOUNT_FILTER,
  parseMinAmount,
  type AmountFilter,
} from "@/lib/amountFilter";

/** Amount presets + custom minimum. Applies to all three tabs. */
export function AmountFilterBar({ filter, onChange }: { filter: AmountFilter; onChange: (f: AmountFilter) => void }) {
  const [minText, setMinText] = useState(filter.minAmount === null ? "" : String(filter.minAmount));
  const parsed = parseMinAmount(minText);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <fieldset>
        <legend className="text-xs font-medium text-slate-600">Amount</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {AMOUNT_PRESETS.map((p) => {
            const active = filter.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...filter, preset: p.id })}
                className={`rounded-full border px-3 py-1 text-sm tabular-nums ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-end gap-3">
        <div>
          <label htmlFor="min-amount" className="block text-xs font-medium text-slate-600">
            Minimum amount (₱)
          </label>
          <input
            id="min-amount"
            inputMode="decimal"
            value={minText}
            placeholder="e.g. 250,000"
            aria-invalid={!parsed.valid}
            aria-describedby={!parsed.valid ? "min-amount-error" : undefined}
            onChange={(e) => {
              setMinText(e.target.value);
              const next = parseMinAmount(e.target.value);
              if (next.valid) onChange({ ...filter, minAmount: next.value });
            }}
            className={`mt-1 w-40 rounded-md border px-3 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-1 ${
              parsed.valid
                ? "border-slate-300 focus:border-slate-500 focus:ring-slate-500"
                : "border-red-400 focus:border-red-500 focus:ring-red-500"
            }`}
          />
          {!parsed.valid && (
            <p id="min-amount-error" className="mt-1 text-xs text-red-700">
              Enter a number, e.g. 250,000
            </p>
          )}
        </div>
        {isAmountFilterActive(filter) && (
          <button
            type="button"
            onClick={() => {
              setMinText("");
              onChange(NO_AMOUNT_FILTER);
            }}
            className="pb-1.5 text-sm font-medium text-sky-700 hover:underline"
          >
            Clear amount filter
          </button>
        )}
      </div>
    </div>
  );
}
