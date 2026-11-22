import { describe, expect, it } from "vitest";
import { unreadableResult } from "../lib/ai";
import { grStatusAfterVerdict } from "../lib/grStatus";
import { clientIp, createRateLimiter } from "../lib/rateLimit";
import { checkImageFile, detectImageType, MAX_IMAGE_BYTES, VerdictSchema, VerifyContextSchema } from "../lib/schemas";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const PDF = bytes(0x25, 0x50, 0x44, 0x46); // "%PDF"

describe("image checks", () => {
  it("recognises JPG, PNG and WebP from their content", () => {
    expect(detectImageType(JPEG)).toBe("image/jpeg");
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(WEBP)).toBe("image/webp");
  });
  it("rejects other files, even if renamed", () => {
    expect(detectImageType(PDF)).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
  it("browser pre-check: type and 4 MB limit", () => {
    expect(checkImageFile({ type: "image/png", size: MAX_IMAGE_BYTES })).toBeNull();
    expect(checkImageFile({ type: "image/png", size: MAX_IMAGE_BYTES + 1 })).toContain("larger than 4 MB");
    expect(checkImageFile({ type: "application/pdf", size: 10 })).toContain("JPG, PNG or WebP");
  });
});

describe("request context", () => {
  const good = {
    invoice_no: "SI-2026-00123",
    customer_name: "Valda Corp.",
    po_no: "PO-2026-1192",
    dr_no: "DN-2026-0845",
    po_recipient_name: "Manolito Bayle",
    delivery_date: "2026-11-21",
    qr_text: null,
  };
  it("accepts complete invoice details", () => {
    expect(VerifyContextSchema.safeParse(good).success).toBe(true);
  });
  it("rejects missing or oversized fields", () => {
    expect(VerifyContextSchema.safeParse({ ...good, po_recipient_name: "" }).success).toBe(false);
    expect(VerifyContextSchema.safeParse({ ...good, delivery_date: "21/11/2026" }).success).toBe(false);
    expect(VerifyContextSchema.safeParse({ ...good, qr_text: "x".repeat(2001) }).success).toBe(false);
    expect(VerifyContextSchema.safeParse(null).success).toBe(false);
  });
});

describe("unreadable AI answer", () => {
  it("is a valid NEEDS_REVIEW result with the reason", () => {
    const result = unreadableResult("Could not read the AI response.");
    expect(result.verdict).toBe("NEEDS_REVIEW");
    expect(result.reasons).toEqual(["Could not read the AI response."]);
    expect(VerdictSchema.safeParse(result).success).toBe(true);
  });
});

describe("GR status after a verdict (spec 5.3)", () => {
  it("VALID and INVALID are kept; NEEDS_REVIEW leaves it unverified", () => {
    expect(grStatusAfterVerdict("VALID")).toBe("VALID");
    expect(grStatusAfterVerdict("INVALID")).toBe("INVALID");
    expect(grStatusAfterVerdict("NEEDS_REVIEW")).toBe("RECEIVED_UNVERIFIED");
  });
});

describe("rate limit: 20 per 10 minutes per IP", () => {
  const WINDOW = 10 * 60 * 1000;

  it("allows 20, blocks the 21st, then allows again after the window", () => {
    const check = createRateLimiter({ limit: 20, windowMs: WINDOW });
    for (let i = 0; i < 20; i++) expect(check("1.2.3.4", 1000 + i).allowed).toBe(true);
    const blocked = check("1.2.3.4", 2000);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterSeconds).toBeGreaterThan(590);
    expect(check("1.2.3.4", 1000 + WINDOW).allowed).toBe(true); // first hit has expired
  });

  it("counts each IP separately", () => {
    const check = createRateLimiter({ limit: 1, windowMs: WINDOW });
    expect(check("a", 0).allowed).toBe(true);
    expect(check("a", 1).allowed).toBe(false);
    expect(check("b", 1).allowed).toBe(true);
  });

  it("reads the visitor IP from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
