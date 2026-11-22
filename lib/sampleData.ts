// Dummy sample invoices for "Load sample data".
// All customers, people and numbers are FICTIONAL (except the test GR's own fictional details: Valda Corp.).
//
// Dates are generated RELATIVE TO `today`, so the demo always shows early warnings, blocked 60+ items
// and every aging bucket, whatever day it is opened. The one exception is the Valda Corp. invoice that
// matches the test GR photo: it keeps the photo's fixed dates (see GR_PHOTO_INVOICE_DATES).
// Each invoice is described by how many days overdue it is (negative = due in the future).
// Terms are 30 days and goods are delivered on the invoice date, so:
//   due_date = today − overdue · invoice_date = delivery_date = due_date − 30

import { addDays } from "./dates";
import type { DisputeFlag, GrStatus, Invoice, PodStatus } from "./readiness";

type SampleSpec = {
  customer: string;
  recipient: string;
  amount: number;
  overdue: number;
  gr: GrStatus;
  pod: PodStatus;
  dispute?: DisputeFlag;
  note?: string;
};

const TERMS_DAYS = 30;

// The invoice that matches the test GR photo (public/sample/gr/gr-01-valid-signed.jpg).
// Its dates are FIXED to match the photo (printed delivery date and handwritten received date 2026-11-21),
// unlike every other sample invoice, which is dated relative to today.
export const GR_PHOTO_INVOICE_DATES = {
  invoice_date: "2026-11-21",
  delivery_date: "2026-11-21",
  due_date: "2026-12-21",
} as const;

export const SAMPLE_CUSTOMERS = [
  "Valda Corp.",
  "Bituin Retail Hub Inc.",
  "Kalamansi Bay Trading",
  "Mabuhay Grocers Co-op",
  "Pilipinas Pantry Distributors",
  "Talisay Builders Depot",
  "Isla Verde Pharmacy Group",
  "Bagong Araw Foods Corp.",
  "Sampalok Mart Chain",
  "Lakbay Auto Parts Inc.",
  "Tala Electronics Trading",
  "Habagat Home Center",
  "Sinag Office Supplies",
  "Banaue Fresh Produce Co.",
  "Dagat-Dagatan Hardware",
] as const;

const SPECS: SampleSpec[] = [
  // --- Payment-ready (GR valid, POD received, no dispute) ---
  { customer: "Bituin Retail Hub Inc.", recipient: "Liza Manalo", amount: 245000, overdue: -15, gr: "VALID", pod: "RECEIVED" },
  { customer: "Kalamansi Bay Trading", recipient: "Ramon Aquino", amount: 132500.5, overdue: 12, gr: "VALID", pod: "RECEIVED" },
  { customer: "Mabuhay Grocers Co-op", recipient: "Teresa Villanueva", amount: 89000, overdue: 45, gr: "VALID", pod: "RECEIVED" },
  { customer: "Talisay Builders Depot", recipient: "Edgar Lim", amount: 410000, overdue: 75, gr: "VALID", pod: "RECEIVED" },
  { customer: "Isla Verde Pharmacy Group", recipient: "Carmela Ong", amount: 56750, overdue: 0, gr: "VALID", pod: "RECEIVED" },
  { customer: "Sinag Office Supplies", recipient: "Jun Bautista", amount: 23400, overdue: -25, gr: "VALID", pod: "RECEIVED" },
  { customer: "Lakbay Auto Parts Inc.", recipient: "Noel Santiago", amount: 67800, overdue: 31, gr: "VALID", pod: "RECEIVED" },
  { customer: "Tala Electronics Trading", recipient: "Grace Mendoza", amount: 28600, overdue: 30, gr: "VALID", pod: "RECEIVED" },
  { customer: "Habagat Home Center", recipient: "Rico Fernandez", amount: 199999.99, overdue: 1, gr: "VALID", pod: "RECEIVED" },
  { customer: "Dagat-Dagatan Hardware", recipient: "Arnel Pascual", amount: 54000, overdue: 200, gr: "VALID", pod: "RECEIVED" },
  { customer: "Valda Corp.", recipient: "Manolito Bayle", amount: 64000, overdue: -18, gr: "VALID", pod: "RECEIVED" },

  // --- GR missing ---
  { customer: "Bagong Araw Foods Corp.", recipient: "Lorna Castillo", amount: 318000, overdue: -20, gr: "NONE", pod: "RECEIVED" },
  { customer: "Sampalok Mart Chain", recipient: "Dennis Uy", amount: 95000, overdue: -27, gr: "NONE", pod: "RECEIVED" }, // delivered 3 days ago: not yet a warning
  { customer: "Lakbay Auto Parts Inc.", recipient: "Noel Santiago", amount: 150000, overdue: -23, gr: "NONE", pod: "RECEIVED" }, // day 7: not yet
  { customer: "Tala Electronics Trading", recipient: "Grace Mendoza", amount: 150000, overdue: -22, gr: "NONE", pod: "RECEIVED" }, // day 8: warning
  { customer: "Habagat Home Center", recipient: "Rico Fernandez", amount: 512000, overdue: 85, gr: "NONE", pod: "RECEIVED" },
  { customer: "Banaue Fresh Produce Co.", recipient: "Marites Dizon", amount: 74300, overdue: 30, gr: "NONE", pod: "RECEIVED" },
  { customer: "Dagat-Dagatan Hardware", recipient: "Arnel Pascual", amount: 210000, overdue: 130, gr: "NONE", pod: "RECEIVED" },
  { customer: "Bagong Araw Foods Corp.", recipient: "Lorna Castillo", amount: 450000, overdue: 2, gr: "NONE", pod: "RECEIVED" },

  // --- GR received but not yet verified ---
  { customer: "Bituin Retail Hub Inc.", recipient: "Liza Manalo", amount: 175000, overdue: -10, gr: "RECEIVED_UNVERIFIED", pod: "RECEIVED" },
  { customer: "Kalamansi Bay Trading", recipient: "Ramon Aquino", amount: 175000, overdue: 5, gr: "RECEIVED_UNVERIFIED", pod: "RECEIVED" }, // same amount, older: ranks first
  { customer: "Pilipinas Pantry Distributors", recipient: "Victor Ramos", amount: 640000, overdue: 95, gr: "RECEIVED_UNVERIFIED", pod: "RECEIVED" },
  { customer: "Isla Verde Pharmacy Group", recipient: "Carmela Ong", amount: 42000, overdue: 61, gr: "RECEIVED_UNVERIFIED", pod: "RECEIVED" }, // 61: blocked
  { customer: "Sinag Office Supplies", recipient: "Jun Bautista", amount: 61200, overdue: 60, gr: "RECEIVED_UNVERIFIED", pod: "RECEIVED" }, // 60: still a warning
  { customer: "Pilipinas Pantry Distributors", recipient: "Victor Ramos", amount: 81250, overdue: -28, gr: "RECEIVED_UNVERIFIED", pod: "RECEIVED" },
  { customer: "Banaue Fresh Produce Co.", recipient: "Marites Dizon", amount: 133000, overdue: 55, gr: "RECEIVED_UNVERIFIED", pod: "RECEIVED" },

  // --- GR invalid ---
  { customer: "Mabuhay Grocers Co-op", recipient: "Teresa Villanueva", amount: 265000, overdue: 20, gr: "INVALID", pod: "RECEIVED" },
  { customer: "Lakbay Auto Parts Inc.", recipient: "Noel Santiago", amount: 98500, overdue: 120, gr: "INVALID", pod: "RECEIVED" },
  { customer: "Tala Electronics Trading", recipient: "Grace Mendoza", amount: 33000, overdue: -5, gr: "INVALID", pod: "RECEIVED" },
  { customer: "Habagat Home Center", recipient: "Rico Fernandez", amount: 120000, overdue: 121, gr: "INVALID", pod: "NONE" },
  { customer: "Sinag Office Supplies", recipient: "Jun Bautista", amount: 15750, overdue: 90, gr: "INVALID", pod: "NONE" },

  // --- POD missing (GR valid) ---
  { customer: "Bagong Araw Foods Corp.", recipient: "Lorna Castillo", amount: 188000, overdue: 70, gr: "VALID", pod: "NONE" },
  { customer: "Sampalok Mart Chain", recipient: "Dennis Uy", amount: 72000, overdue: 15, gr: "VALID", pod: "NONE" },
  { customer: "Banaue Fresh Produce Co.", recipient: "Marites Dizon", amount: 39900, overdue: -12, gr: "VALID", pod: "NONE" },
  { customer: "Talisay Builders Depot", recipient: "Edgar Lim", amount: 305000, overdue: 100, gr: "VALID", pod: "NONE" },

  // --- Disputes ---
  { customer: "Dagat-Dagatan Hardware", recipient: "Arnel Pascual", amount: 158000, overdue: 65, gr: "VALID", pod: "RECEIVED", dispute: "Y", note: "Customer reports 2 damaged units; replacement requested." },
  { customer: "Pilipinas Pantry Distributors", recipient: "Victor Ramos", amount: 47500, overdue: 10, gr: "VALID", pod: "RECEIVED", dispute: "Y", note: "Price difference versus PO under review." },
  { customer: "Isla Verde Pharmacy Group", recipient: "Carmela Ong", amount: 92000, overdue: 140, gr: "VALID", pod: "RECEIVED", dispute: "Y", note: "Short delivery claim: 5 cartons." },
  { customer: "Kalamansi Bay Trading", recipient: "Ramon Aquino", amount: 230000, overdue: 40, gr: "NONE", pod: "NONE", dispute: "Y", note: "Wrong item delivered; awaiting return pickup." },
];

function specToInvoice(spec: SampleSpec, index: number, today: string): Invoice {
  const due = addDays(today, -spec.overdue);
  const invoiceDate = addDays(due, -TERMS_DAYS);
  const n = String(201 + index).padStart(5, "0");
  return {
    invoice_no: `SI-2026-${n}`,
    customer_name: spec.customer,
    po_no: `PO-2026-${String(2001 + index)}`,
    po_recipient_name: spec.recipient,
    dr_no: `DN-2026-${String(1001 + index)}`,
    invoice_date: invoiceDate,
    delivery_date: invoiceDate,
    due_date: due,
    amount_php: spec.amount,
    gr_status: spec.gr,
    pod_status: spec.pod,
    dispute_flag: spec.dispute ?? "N",
    dispute_note: spec.note ?? null,
  };
}

/** The invoice that matches the test GR photo, on the photo's fixed dates. */
function grPhotoInvoice(): Invoice {
  return {
    invoice_no: "SI-2026-00123",
    customer_name: "Valda Corp.",
    po_no: "PO-2026-1192",
    po_recipient_name: "Manolito Bayle",
    dr_no: "DN-2026-0845",
    ...GR_PHOTO_INVOICE_DATES,
    amount_php: 86000,
    gr_status: "RECEIVED_UNVERIFIED",
    pod_status: "RECEIVED",
    dispute_flag: "N",
    dispute_note: null,
  };
}

/** 40 dummy invoices dated relative to `today` (YYYY-MM-DD). */
export function generateSampleInvoices(today: string): Invoice[] {
  return [grPhotoInvoice(), ...SPECS.map((spec, i) => specToInvoice(spec, i, today))];
}
