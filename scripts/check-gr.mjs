// Try the GR verification (spec section 6) on one image, outside the web app.
//
// Usage:
//   npm run check:gr                       (uses the defaults below)
//   npm run check:gr -- <image> <context.json> [<context2.json> ...]
// Defaults: public/sample/gr/gr-01-valid-signed.jpg and scripts/gr-context-a.json
// Example:
//   npm run check:gr -- public/sample/gr/gr-01-valid-signed.jpg scripts/gr-context-a.json scripts/gr-context-b.json
//
// Each context file holds the invoice details to check the image against.
// With two or more context files, the results are shown side by side.
// The API key is never printed.
//
// The prompt, Zod schemas, AI call and guards are the SAME code the web app uses
// (lib/ai.ts, lib/schemas.ts, lib/grGuards.ts); Node loads those TypeScript files directly.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { verifyGr } from "../lib/ai.ts";
import { detectImageType, MAX_IMAGE_BYTES, VerifyContextSchema } from "../lib/schemas.ts";

const FAILURE_TEXT = {
  TIMEOUT: "The AI check took longer than 30 seconds.",
  AUTH: "The API key was rejected. Check OPENROUTER_API_KEY in .env.local.",
  CREDITS: "Not enough OpenRouter credits for this request.",
  MODEL: "The model was not accepted. Check OPENROUTER_MODEL.",
  RATE_LIMITED: "Too many requests. Wait a minute and try again.",
  PROVIDER: "The AI check is unavailable (provider error).",
  NETWORK: "Could not reach OpenRouter. Check your internet connection.",
};

async function verify(input) {
  const outcome = await verifyGr(input);
  if (outcome.ok) return { ...outcome.result, usage: outcome.usage };
  return { verdict: "ERROR", reasons: [FAILURE_TEXT[outcome.failure] ?? "Unexpected error."], failed: true };
}

// ---------- cost estimate ----------
// Prices come from OpenRouter's public model list (USD per token); no key needed.
// The PHP figure uses a rough fixed rate, for orientation only.
const USD_TO_PHP = 58;
let pricing = null;

async function loadPricing(id) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(10_000) });
    const model = (await res.json()).data?.find((m) => m.id === id);
    if (model) pricing = { input: Number(model.pricing.prompt), output: Number(model.pricing.completion) };
  } catch {
    // No price available: the cost row just shows "—".
  }
}

function estimateCost(usage) {
  if (!usage || !pricing) return null;
  const usd = (usage.inputTokens ?? 0) * pricing.input + (usage.outputTokens ?? 0) * pricing.output;
  return `$${usd.toFixed(4)} / ₱${(usd * USD_TO_PHP).toFixed(2)}`;
}

// ---------- side-by-side printout ----------
function printSideBySide(labels, results) {
  const show = (v) => (v === null || v === undefined ? "—" : Array.isArray(v) ? v.join(", ") || "—" : String(v));
  const badge = (v) => ({ VALID: "🟢 VALID", INVALID: "🔴 INVALID", NEEDS_REVIEW: "🟡 NEEDS REVIEW" })[v] ?? `⚠️ ${v}`;

  const rows = [
    ["PO recipient (context)", (r, c) => c.po_recipient_name],
    ["Document type", (r) => r.document_type],
    ["Signer name", (r) => r.extracted?.signer_name],
    ["Signature present", (r) => r.extracted?.signature_present],
    ["Stamp present (info)", (r) => r.extracted?.stamp_present],
    ["Received date", (r) => r.extracted?.received_date],
    ["References found", (r) => r.extracted?.references_found],
    ["✓ Signer matches", (r) => r.checks?.signer_matches_po_recipient],
    ["✓ Reference matches", (r) => r.checks?.reference_matches],
    ["✓ Date valid (code)", (r) => r.checks?.date_valid],
    ["✓ Acknowledgement", (r) => r.checks?.acknowledgement_present],
    ["AI verdict", (r) => r.ai_verdict],
    ["Guards applied", (r) => r.guard_notes],
    ["FINAL VERDICT", (r) => badge(r.verdict)],
    ["Confidence", (r) => r.confidence],
    ["Tokens (in / out)", (r) => (r.usage ? `${r.usage.inputTokens} / ${r.usage.outputTokens}` : null)],
    ["  of which thinking", (r) => r.usage?.outputTokenDetails?.reasoningTokens ?? r.usage?.reasoningTokens],
    ["Est. cost (USD / PHP)", (r) => estimateCost(r.usage)],
  ];

  const colW = 34;
  const firstW = 24;
  const cut = (s, w) => (s.length > w ? s.slice(0, w - 1) + "…" : s.padEnd(w));
  const line = "─".repeat(firstW + (colW + 3) * results.length);

  console.log(line);
  console.log(cut("", firstW) + labels.map((l) => " │ " + cut(l, colW)).join(""));
  console.log(line);
  for (const [name, get] of rows) {
    console.log(cut(name, firstW) + results.map((r) => " │ " + cut(show(get(r.result, r.context)), colW)).join(""));
  }
  console.log(line);
  results.forEach((r, i) => {
    console.log(`\nReasons – ${labels[i]}:`);
    for (const reason of r.result.reasons ?? []) console.log(`  • ${reason}`);
  });
  console.log("\nAI decision support – confirm before acting.");
}

// ---------- main ----------
const DEFAULT_IMAGE = "public/sample/gr/gr-01-valid-signed.jpg";
const DEFAULT_CONTEXT = "scripts/gr-context-a.json";

const [imageArg, ...contextArgs] = process.argv.slice(2);
const imagePath = imageArg ?? DEFAULT_IMAGE;
const contextPaths = contextArgs.length > 0 ? contextArgs : [DEFAULT_CONTEXT];

const apiKey = (process.env.OPENROUTER_API_KEY ?? "").trim();
const modelId = (process.env.OPENROUTER_MODEL ?? "").trim();
if (!apiKey) {
  console.error("OPENROUTER_API_KEY is empty in .env.local");
  process.exit(1);
}
if (!modelId) {
  console.error("OPENROUTER_MODEL is empty in .env.local");
  process.exit(1);
}

const image = await readFile(imagePath).catch(() => null);
if (!image) {
  console.error(`Could not open the image: ${imagePath}`);
  process.exit(1);
}
const mediaType = detectImageType(new Uint8Array(image));
if (!mediaType) {
  console.error("The image must be JPG, PNG or WebP.");
  process.exit(1);
}
if (image.length > MAX_IMAGE_BYTES) {
  console.error(`The image is larger than 4 MB (${(image.length / 1024 / 1024).toFixed(2)} MB). Please resize it.`);
  process.exit(1);
}

const contexts = [];
for (const p of contextPaths) {
  const raw = await readFile(p, "utf8").catch(() => null);
  if (raw === null) {
    console.error(`Could not open the context file: ${p}`);
    process.exit(1);
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    console.error(`${p} is not valid JSON.`);
    process.exit(1);
  }
  const parsed = VerifyContextSchema.safeParse(json);
  if (!parsed.success) {
    console.error(`${p} has a problem:`);
    for (const issue of parsed.error.issues) console.error(`  • ${issue.path.join(".")}: ${issue.message}`);
    process.exit(1);
  }
  // The label is only for the printout; it is not sent to the AI.
  contexts.push({ file: p, label: typeof json.label === "string" ? json.label : null, context: parsed.data });
}

// Today's date in Philippine time (YYYY-MM-DD), not UTC.
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
await loadPricing(modelId);

console.log(`Model: ${modelId} · Image: ${imagePath} (${(image.length / 1024 / 1024).toFixed(1)} MB) · Today: ${today}`);
console.log(`Running ${contexts.length} check(s)...\n`);

const results = await Promise.all(
  contexts.map(async ({ context }) => ({
    context,
    result: await verify({ apiKey, modelId, image: new Uint8Array(image), mediaType, context, today }),
  })),
);

printSideBySide(
  contexts.map(({ file, label }) => label ?? path.basename(file)),
  results,
);
