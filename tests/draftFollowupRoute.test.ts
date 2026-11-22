// Tests for POST /api/draft-followup. The AI is replaced by a fake, so no real calls (and no cost).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const draftFollowup = vi.fn();
vi.mock("@/lib/ai.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/ai")>()),
  draftFollowup: (...args: unknown[]) => draftFollowup(...args),
}));

const INVOICE = {
  invoice_no: "SI-2026-00123",
  customer_name: "Valda Corp.",
  po_no: "PO-2026-1192",
  po_recipient_name: "Manolito Bayle",
  dr_no: "DN-2026-0845",
  delivery_date: "2026-11-21",
  due_date: "2026-12-21",
  amount_php: 86000,
  gr_status: "INVALID",
  pod_status: "RECEIVED",
  dispute_flag: "N",
  dispute_note: null,
};

let ipCounter = 0;
function request(body: unknown, ip = `10.1.0.${++ipCounter}`) {
  return new Request("http://localhost/api/draft-followup", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
  });
}
async function call(req: Request) {
  const { POST } = await import("../app/api/draft-followup/route");
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key-not-real");
  vi.stubEnv("OPENROUTER_MODEL", "test/model");
  draftFollowup.mockReset();
  draftFollowup.mockResolvedValue({
    ok: true,
    subject: "Re-acknowledgement needed",
    body: "Dear Receiving team,\n\nPlease re-acknowledge.\n\n[Your name]\nCredit Team",
    usage: null,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/draft-followup", () => {
  it("code picks the recipient and all facts; the AI only writes the text", async () => {
    const { status, body } = await call(request({ invoice: INVOICE, gr_reasons: ["Signed by R. Lim, not Manolito Bayle."] }));
    expect(status).toBe(200);
    expect(body.draft).toMatchObject({
      recipient_type: "CUSTOMER_RECEIVING",
      recipient_label: "Customer – Receiving",
      situation_label: "GR invalid",
      subject: "Re-acknowledgement needed",
    });
    const facts = draftFollowup.mock.calls[0][0].facts;
    expect(facts).toMatchObject({
      invoice_no: "SI-2026-00123",
      po_no: "PO-2026-1192",
      dr_no: "DN-2026-0845",
      amount: "₱86,000.00",
      gr_check_reasons: ["Signed by R. Lim, not Manolito Bayle."],
    });
    expect(facts.target_date).toMatch(/^[A-Z][a-z]+day, \d{1,2} [A-Z][a-z]+ \d{4}$/);
  });

  it("sends the PO recipient's name only for 'GR invalid' (so the AI cannot greet the wrong person)", async () => {
    await call(request({ invoice: { ...INVOICE, gr_status: "VALID", dispute_flag: "Y", dispute_note: "Damaged units." } }));
    expect(draftFollowup.mock.calls[0][0].facts).toMatchObject({ po_recipient_name: null, dispute_note: "Damaged units." });
    await call(request({ invoice: INVOICE }));
    expect(draftFollowup.mock.calls[1][0].facts.po_recipient_name).toBe("Manolito Bayle");
  });

  it("the server works out the routing itself (it does not trust a recipient from the browser)", async () => {
    await call(request({ invoice: { ...INVOICE, gr_status: "VALID", pod_status: "NONE" }, recipient_type: "CUSTOMER_AP" }));
    expect(draftFollowup.mock.calls[0][0].facts.recipient).toBe("Internal – Logistics");
  });

  it("the quoted references are always in the reply, even if the AI forgot them", async () => {
    const { body } = await call(request({ invoice: INVOICE }));
    expect(body.draft.body).toContain("SI-2026-00123");
    expect(body.draft.body).toContain("₱86,000.00");
  });

  it("GR unverified → 422 'check the GR first', no AI call", async () => {
    const { status, body } = await call(request({ invoice: { ...INVOICE, gr_status: "RECEIVED_UNVERIFIED" } }));
    expect(status).toBe(422);
    expect(body.error).toContain("Check the GR first");
    expect(draftFollowup).not.toHaveBeenCalled();
  });

  it("missing API key → 'Service not configured'", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const { status, body } = await call(request({ invoice: INVOICE }));
    expect(status).toBe(500);
    expect(body.error).toBe("Service not configured.");
  });

  it.each([
    ["not JSON", "{oops"],
    ["missing invoice", {}],
    ["negative amount", { invoice: { ...INVOICE, amount_php: -5 } }],
    ["bad status", { invoice: { ...INVOICE, gr_status: "MAYBE" } }],
    ["note too long", { invoice: { ...INVOICE, dispute_note: "x".repeat(201) } }],
  ])("rejects %s with 400", async (_name, payload) => {
    const { status } = await call(request(payload));
    expect(status).toBe(400);
    expect(draftFollowup).not.toHaveBeenCalled();
  });

  it("rejects an oversized request with 413", async () => {
    const { status } = await call(request({ invoice: INVOICE, padding: "x".repeat(20_000) }));
    expect(status).toBe(413);
  });

  it("allows 20 drafts per IP, then 429 with a friendly message", async () => {
    const ip = "203.0.113.77";
    for (let i = 0; i < 20; i++) expect((await call(request({ invoice: INVOICE }, ip))).status).toBe(200);
    const res = await call(request({ invoice: INVOICE }, ip));
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("Too many drafts, please wait a few minutes.");
  });

  it.each([
    ["TIMEOUT", 504, "took too long"],
    ["CREDITS", 503, "unavailable"],
    ["AUTH", 500, "Service not configured"],
  ])("AI failure %s → %i, logged without names", async (failure, code, text) => {
    draftFollowup.mockResolvedValue({ ok: false, failure, status: null });
    const { status, body } = await call(request({ invoice: { ...INVOICE, dispute_flag: "Y", dispute_note: "Secret note" } }));
    expect(status).toBe(code);
    expect(body.error).toContain(text);
    const logged = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.flat().join(" ");
    expect(logged).not.toMatch(/Valda|Manolito|Secret note/);
  });
});
