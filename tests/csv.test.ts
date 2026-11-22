import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALL_HEADERS,
  checkCsvFile,
  formatRowError,
  invoicesToCsv,
  MAX_CSV_ROWS,
  parseInvoiceCsv,
  REQUIRED_HEADERS,
  TEMPLATE_CSV,
} from "../lib/csv";

const HEADER = ALL_HEADERS.join(",");
const GOOD =
  "SI-2026-00001,Test Customer (fictional),PO-1,Test Person,DR-1,2026-10-01,2026-10-01,2026-10-31,125000.50,NONE,RECEIVED,N,";

function csv(...rows: string[]) {
  return [HEADER, ...rows].join("\n");
}
function errorsOf(text: string) {
  const result = parseInvoiceCsv(text);
  if (!result.ok) throw new Error(result.error);
  return result.errors.map(formatRowError);
}

describe("CSV headers (T4)", () => {
  it("rejects the file and lists missing required headers", () => {
    const result = parseInvoiceCsv("invoice_no,customer_name\nSI-1,Test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("missing required columns");
      expect(result.error).toContain("due_date");
      expect(result.error).not.toContain("customer_name,");
    }
  });
  it("accepts headers in any letter case, with spaces, in any order, without dispute_note", () => {
    const headers = [...REQUIRED_HEADERS].reverse().map((h) => ` ${h.toUpperCase()} `);
    const row = "N,RECEIVED,VALID,1000,2026-10-31,2026-10-01,2026-10-01,DR-1,Test Person,PO-1,Test Customer,SI-1";
    const result = parseInvoiceCsv(`${headers.join(",")}\n${row}`);
    expect(result.ok && result.invoices.length).toBe(1);
  });
  it("rejects an empty file", () => {
    expect(parseInvoiceCsv("").ok).toBe(false);
  });
});

describe("CSV rows (T4)", () => {
  it("reads a valid row into clean values", () => {
    const result = parseInvoiceCsv(csv(GOOD));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.errors).toEqual([]);
      expect(result.invoices[0]).toMatchObject({ amount_php: 125000.5, gr_status: "NONE", dispute_note: null });
    }
  });

  it("reports a bad date with the spreadsheet row number and skips that row", () => {
    const text = csv(GOOD, GOOD.replace("SI-2026-00001", "SI-2").replace("2026-10-31", "31/10/2026"));
    const result = parseInvoiceCsv(text);
    expect(errorsOf(text)).toEqual(["Row 3: due_date is not a valid date (use YYYY-MM-DD)."]);
    expect(result.ok && result.invoices.length).toBe(1);
  });

  it("keeps row numbers correct when there are blank lines", () => {
    const text = csv(GOOD, "", GOOD.replace("SI-2026-00001", "SI-3").replace("2026-10-01,2026-10-01", "2026-02-30,2026-10-01"));
    expect(errorsOf(text)).toEqual(["Row 4: invoice_date is not a valid date (use YYYY-MM-DD)."]);
  });

  it.each([
    [GOOD.replace("Test Customer (fictional)", ""), "Row 2: customer_name is required."],
    [GOOD.replace("125000.50", "0"), "Row 2: amount_php must be a number greater than 0."],
    [GOOD.replace("125000.50", "abc"), "Row 2: amount_php must be a number greater than 0."],
    [GOOD.replace(",NONE,", ",MISSING,"), "Row 2: gr_status must be one of NONE, RECEIVED_UNVERIFIED, VALID, INVALID."],
    [GOOD.replace(",N,", ",maybe,"), "Row 2: dispute_flag must be one of Y, N."],
    [GOOD.replace("2026-10-31", "2026-09-30"), "Row 2: due_date is before invoice_date."],
    [GOOD.replace("2026-10-01,2026-10-01", "2026-10-01,2026-08-31"), "Row 2: delivery_date is more than 30 days before invoice_date."],
    [`${GOOD.slice(0, -1)},${"x".repeat(201)}`, "Row 2: dispute_note is longer than 200 characters."],
  ])("rejects %s", (row, message) => {
    expect(errorsOf(csv(row))).toEqual([message]);
  });

  it("accepts amounts written with peso sign and commas, and lower-case statuses", () => {
    const row = GOOD.replace("125000.50", '"₱125,000.50"').replace(",NONE,RECEIVED,N,", ",valid,received,n,");
    const result = parseInvoiceCsv(csv(row));
    expect(result.ok && result.invoices[0]).toMatchObject({ amount_php: 125000.5, gr_status: "VALID", dispute_flag: "N" });
  });

  it("delivery exactly 30 days before the invoice date is allowed", () => {
    expect(errorsOf(csv(GOOD.replace("2026-10-01,2026-10-01", "2026-10-01,2026-09-01")))).toEqual([]);
  });

  it("reports a duplicate invoice number and keeps the first", () => {
    const text = csv(GOOD, GOOD);
    expect(errorsOf(text)).toEqual(["Row 3: invoice_no SI-2026-00001 appears more than once (first on row 2)."]);
  });
});

describe("CSV limits", () => {
  it("rejects more than 5,000 rows", () => {
    const rows = Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => GOOD.replace("SI-2026-00001", `SI-${i}`));
    const result = parseInvoiceCsv(csv(...rows));
    expect(result.ok).toBe(false);
  });
  it("accepts exactly 5,000 rows", () => {
    const rows = Array.from({ length: MAX_CSV_ROWS }, (_, i) => GOOD.replace("SI-2026-00001", `SI-${i}`));
    const result = parseInvoiceCsv(csv(...rows));
    expect(result.ok && result.invoices.length).toBe(MAX_CSV_ROWS);
  });
  it("checks file name and size before reading", () => {
    expect(checkCsvFile({ name: "invoices.CSV", size: 1000 })).toBeNull();
    expect(checkCsvFile({ name: "invoices.xlsx", size: 1000 })).toBe("Please upload a .csv file.");
    expect(checkCsvFile({ name: "big.csv", size: 2 * 1024 * 1024 + 1 })).toBe("The file is larger than 2 MB.");
  });
});

describe("template and export", () => {
  it("the template file has exactly the spec headers and no rows", () => {
    const file = readFileSync("public/sample/invoice-template.csv", "utf8").trim();
    expect(file).toBe(TEMPLATE_CSV.trim());
    expect(file.split(",")).toEqual(ALL_HEADERS);
  });
  it("exported CSV reads back unchanged", () => {
    const first = parseInvoiceCsv(csv(GOOD));
    if (!first.ok) throw new Error("setup");
    const again = parseInvoiceCsv(invoicesToCsv(first.invoices));
    expect(again.ok && again.invoices).toEqual(first.invoices);
  });
});
