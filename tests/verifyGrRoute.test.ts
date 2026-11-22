// Tests for POST /api/verify-gr. The AI is replaced by a fake, so no real calls (and no cost).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unreadableResult } from "../lib/ai";

const verifyGr = vi.fn();
vi.mock("@/lib/ai.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/ai")>()),
  verifyGr: (...args: unknown[]) => verifyGr(...args),
}));

const CONTEXT = {
  invoice_no: "SI-2026-00123",
  customer_name: "Valda Corp.",
  po_no: "PO-2026-1192",
  dr_no: "DN-2026-0845",
  po_recipient_name: "Manolito Bayle",
  delivery_date: "2026-11-21",
  qr_text: null,
};
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(100).fill(1)]);

let ipCounter = 0;
function request({
  image = new Blob([JPEG], { type: "image/jpeg" }) as Blob | null,
  context = JSON.stringify(CONTEXT) as string | null,
  ip = `10.0.0.${++ipCounter}`,
} = {}) {
  const form = new FormData();
  if (image) form.append("image", image, "gr.jpg");
  if (context !== null) form.append("context", context);
  return new Request("http://localhost/api/verify-gr", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": ip },
  });
}

async function call(req: Request) {
  const { POST } = await import("../app/api/verify-gr/route");
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key-not-real");
  vi.stubEnv("OPENROUTER_MODEL", "test/model");
  verifyGr.mockReset();
  verifyGr.mockResolvedValue({ ok: true, result: unreadableResult("fake"), usage: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/verify-gr", () => {
  it("returns the guarded result for a valid upload", async () => {
    const { status, body } = await call(request());
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, result: { verdict: "NEEDS_REVIEW" } });
    const input = verifyGr.mock.calls[0][0];
    expect(input.mediaType).toBe("image/jpeg");
    expect(input.context.po_recipient_name).toBe("Manolito Bayle");
    expect(input.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("missing API key → 'Service not configured', no AI call", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const { status, body } = await call(request());
    expect(status).toBe(500);
    expect(body).toEqual({ ok: false, error: "Service not configured." });
    expect(verifyGr).not.toHaveBeenCalled();
  });

  it("rejects a file that is not really an image (checked by content)", async () => {
    const pdf = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3])], { type: "image/jpeg" });
    const { status, body } = await call(request({ image: pdf }));
    expect(status).toBe(415);
    expect(body.error).toContain("JPG, PNG or WebP");
    expect(verifyGr).not.toHaveBeenCalled();
  });

  it("rejects images over 4 MB", async () => {
    const big = new Blob([JPEG, new Uint8Array(4 * 1024 * 1024)], { type: "image/jpeg" });
    const { status, body } = await call(request({ image: big }));
    expect(status).toBe(413);
    expect(body.error).toContain("larger than 4 MB");
  });

  it("rejects a missing image or incomplete invoice details", async () => {
    expect((await call(request({ image: null }))).status).toBe(400);
    expect((await call(request({ context: "{not json" }))).status).toBe(400);
    expect((await call(request({ context: JSON.stringify({ ...CONTEXT, po_no: "" }) }))).status).toBe(400);
    expect(verifyGr).not.toHaveBeenCalled();
  });

  it("allows 20 checks per IP, then returns 429 with a friendly message", async () => {
    const ip = "203.0.113.99";
    for (let i = 0; i < 20; i++) expect((await call(request({ ip }))).status).toBe(200);
    const res = await call(request({ ip }));
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("Too many checks, please wait a few minutes.");
  });

  it.each([
    ["TIMEOUT", 504, "took too long"],
    ["CREDITS", 503, "unavailable"],
    ["PROVIDER", 503, "unavailable"],
    ["AUTH", 500, "Service not configured"],
  ])("AI failure %s → %i with a friendly message, logged without details", async (failure, code, text) => {
    verifyGr.mockResolvedValue({ ok: false, failure, status: null });
    const { status, body } = await call(request());
    expect(status).toBe(code);
    expect(body.error).toContain(text);
    const logged = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.flat().join(" ");
    expect(logged).not.toContain("Manolito");
    expect(logged).not.toContain("Valda");
  });
});
