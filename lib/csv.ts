// Invoice register CSV: parsing and validation (spec section 3).

import Papa from "papaparse";
import { z } from "zod";
import { addDays, isIsoDate } from "./dates";
import { DISPUTE_FLAGS, GR_STATUSES, POD_STATUSES, type Invoice } from "./readiness";

export const REQUIRED_HEADERS = [
  "invoice_no",
  "customer_name",
  "po_no",
  "po_recipient_name",
  "dr_no",
  "invoice_date",
  "delivery_date",
  "due_date",
  "amount_php",
  "gr_status",
  "pod_status",
  "dispute_flag",
] as const;
export const OPTIONAL_HEADERS = ["dispute_note"] as const;
export const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

export const MAX_CSV_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_CSV_ROWS = 5000;
const MAX_NOTE_LENGTH = 200;

// ---------- one row (Zod) ----------
// Every cell arrives as text (or undefined if the column is missing); each field turns it into a clean value
// and explains any problem in plain English.

const cell = z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string());

const requiredText = (name: string) =>
  cell.superRefine((v, ctx) => {
    if (!v) ctx.addIssue({ code: "custom", message: `${name} is required.` });
  });

const date = (name: string) =>
  cell.superRefine((v, ctx) => {
    if (!v) ctx.addIssue({ code: "custom", message: `${name} is required.` });
    else if (!isIsoDate(v)) ctx.addIssue({ code: "custom", message: `${name} is not a valid date (use YYYY-MM-DD).` });
  });

const choice = <T extends readonly [string, ...string[]]>(name: string, options: T) =>
  cell
    .transform((v) => v.toUpperCase())
    .superRefine((v, ctx) => {
      if (!v) ctx.addIssue({ code: "custom", message: `${name} is required.` });
      else if (!options.includes(v))
        ctx.addIssue({ code: "custom", message: `${name} must be one of ${options.join(", ")}.` });
    })
    .transform((v) => v as T[number]);

// Accepts "125000.50", "125,000.50" or "₱125,000.50".
const amount = (name: string) =>
  cell
    .transform((v) => v.replace(/[₱,\s]/g, ""))
    .superRefine((v, ctx) => {
      if (!v) ctx.addIssue({ code: "custom", message: `${name} is required.` });
      else if (!/^\d+(\.\d+)?$/.test(v) || Number(v) <= 0)
        ctx.addIssue({ code: "custom", message: `${name} must be a number greater than 0.` });
    })
    .transform(Number);

export const InvoiceRowSchema = z
  .object({
    invoice_no: requiredText("invoice_no"),
    customer_name: requiredText("customer_name"),
    po_no: requiredText("po_no"),
    po_recipient_name: requiredText("po_recipient_name"),
    dr_no: requiredText("dr_no"),
    invoice_date: date("invoice_date"),
    delivery_date: date("delivery_date"),
    due_date: date("due_date"),
    amount_php: amount("amount_php"),
    gr_status: choice("gr_status", GR_STATUSES),
    pod_status: choice("pod_status", POD_STATUSES),
    dispute_flag: choice("dispute_flag", DISPUTE_FLAGS),
    dispute_note: cell
      .superRefine((v, ctx) => {
        if (v.length > MAX_NOTE_LENGTH)
          ctx.addIssue({ code: "custom", message: `dispute_note is longer than ${MAX_NOTE_LENGTH} characters.` });
      })
      .transform((v) => (v ? v : null)),
  })
  .superRefine((row, ctx) => {
    // Rules between columns (only checked once each date is valid on its own).
    if (row.due_date < row.invoice_date) {
      ctx.addIssue({ code: "custom", message: "due_date is before invoice_date." });
    }
    if (row.delivery_date < addDays(row.invoice_date, -30)) {
      ctx.addIssue({ code: "custom", message: "delivery_date is more than 30 days before invoice_date." });
    }
  });

// ---------- whole file ----------

export type RowError = { row: number; message: string };

export type CsvResult =
  | { ok: true; invoices: Invoice[]; errors: RowError[]; rowsRead: number }
  | { ok: false; error: string };

/** Quick check before reading a file (name and size only). Returns a message, or null if fine. */
export function checkCsvFile(file: { name: string; size: number }): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) return "Please upload a .csv file.";
  if (file.size > MAX_CSV_BYTES) return "The file is larger than 2 MB.";
  return null;
}

/** "Row 14: due_date is not a valid date (use YYYY-MM-DD)." */
export function formatRowError(error: RowError): string {
  return `Row ${error.row}: ${error.message}`;
}

/**
 * Parse and validate an invoice CSV.
 * Row numbers match the spreadsheet: the header is row 1, the first invoice is row 2.
 * Invalid rows are skipped and listed; the file is rejected only if it is too big or headers are missing.
 */
export function parseInvoiceCsv(text: string): CsvResult {
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) {
    return { ok: false, error: "The file is larger than 2 MB." };
  }

  const parsed = Papa.parse<Record<string, string | undefined>>(text, {
    header: true,
    skipEmptyLines: false, // keep blank lines so row numbers stay correct; skipped below
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const headers = parsed.meta.fields ?? [];
  if (headers.length === 0 || headers.every((h) => h === "")) {
    return { ok: false, error: "The file is empty." };
  }
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `The file is missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    };
  }

  const rows = parsed.data
    .map((data, index) => ({ data, row: index + 2 }))
    .filter(({ data }) => Object.values(data).some((v) => typeof v === "string" && v.trim() !== ""));

  if (rows.length > MAX_CSV_ROWS) {
    return { ok: false, error: `The file has more than ${MAX_CSV_ROWS.toLocaleString("en-US")} invoice rows.` };
  }

  const invoices: Invoice[] = [];
  const errors: RowError[] = [];
  const firstRowOf = new Map<string, number>();

  for (const { data, row } of rows) {
    const result = InvoiceRowSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) errors.push({ row, message: issue.message });
      continue;
    }
    const key = result.data.invoice_no.toUpperCase();
    const first = firstRowOf.get(key);
    if (first !== undefined) {
      errors.push({ row, message: `invoice_no ${result.data.invoice_no} appears more than once (first on row ${first}).` });
      continue;
    }
    firstRowOf.set(key, row);
    invoices.push(result.data);
  }

  return { ok: true, invoices, errors, rowsRead: rows.length };
}

/** Turn invoices back into CSV text (for the sample download), columns in template order. */
export function invoicesToCsv(invoices: Invoice[]): string {
  return Papa.unparse(
    invoices.map((inv) => ({ ...inv, dispute_note: inv.dispute_note ?? "" })),
    { columns: [...ALL_HEADERS] },
  );
}

/** The downloadable template: headers only. */
export const TEMPLATE_CSV = `${ALL_HEADERS.join(",")}\n`;
