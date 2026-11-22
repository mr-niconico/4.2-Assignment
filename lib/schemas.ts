// Zod schemas for the GR check (spec section 6), shared by the API route, the UI and scripts/check-gr.mjs.
// Imports use ".ts" endings so plain Node (the test script) can load this file too.

import { z } from "zod";
import type { GuardedResult } from "./grGuards.ts";

// ---------- AI response (spec section 6) ----------
const Check = z.enum(["YES", "NO", "UNCLEAR"]);

export const VerdictSchema = z.object({
  document_type: z.enum(["PAPER_DELIVERY_RECEIPT", "ELECTRONIC_ACKNOWLEDGEMENT", "QR_CODE_GR", "OTHER", "UNREADABLE"]),
  extracted: z.object({
    signer_name: z.string().nullable(),
    signature_present: z.boolean(),
    stamp_present: z.boolean(),
    received_date: z.string().nullable().describe("YYYY-MM-DD or null"),
    references_found: z.array(z.string()),
    qr_text: z.string().nullable(),
    customer_name_on_document: z.string().nullable(),
  }),
  checks: z.object({
    signer_matches_po_recipient: Check,
    reference_matches: Check,
    date_valid: Check,
    acknowledgement_present: Check,
  }),
  verdict: z.enum(["VALID", "INVALID", "NEEDS_REVIEW"]),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reasons: z.array(z.string()),
});

// ---------- request context (invoice details sent with the image) ----------
const field = (max: number) => z.string().trim().min(1).max(max);

export const VerifyContextSchema = z.object({
  invoice_no: field(60),
  customer_name: field(200),
  po_no: field(60),
  dr_no: field(60),
  po_recipient_name: field(120),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  qr_text: z.string().max(2000).nullable(),
});
export type VerifyContext = z.infer<typeof VerifyContextSchema>;

// ---------- uploaded image ----------
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/**
 * Work out the image type from the file's first bytes (its "signature"), not from the name or the
 * browser's claim, so a renamed file cannot slip through. Returns null if it is not JPG, PNG or WebP.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** Quick browser-side check before uploading. Returns a message, or null if fine. */
export function checkImageFile(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return "Please choose a JPG, PNG or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "The image is larger than 4 MB. Please use a smaller photo.";
  return null;
}

// ---------- API response ----------
export type VerifyResponse = { ok: true; result: GuardedResult } | { ok: false; error: string };
