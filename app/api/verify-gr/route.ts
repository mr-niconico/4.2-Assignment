// POST /api/verify-gr – AI feature 1 (spec sections 5.3, 6 and 8).
// Request: multipart form with `image` (JPG/PNG/WebP ≤ 4 MB) and `context` (JSON invoice details).
// Logs never contain image content, names or full AI responses – only the kind of failure.

import { verifyGr, type VerifyFailure } from "@/lib/ai.ts";
import { todayInManila } from "@/lib/dates";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";
import { detectImageType, MAX_IMAGE_BYTES, VerifyContextSchema, type VerifyResponse } from "@/lib/schemas.ts";

// Two AI calls of up to 30 s each (one retry on an unreadable answer).
export const maxDuration = 60;

const RATE_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 }; // 20 checks per 10 minutes per IP
const rateLimit = createRateLimiter(RATE_LIMIT);

const UNAVAILABLE = "The AI check is unavailable, please try again.";
const FAILURE_MESSAGE: Record<VerifyFailure, { status: number; message: string }> = {
  TIMEOUT: { status: 504, message: "The AI check took too long. Please try again." },
  AUTH: { status: 500, message: "Service not configured." },
  CREDITS: { status: 503, message: UNAVAILABLE },
  MODEL: { status: 500, message: "Service not configured." },
  RATE_LIMITED: { status: 503, message: UNAVAILABLE },
  PROVIDER: { status: 503, message: UNAVAILABLE },
  NETWORK: { status: 503, message: UNAVAILABLE },
};

function reply(body: VerifyResponse, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers });
}
const fail = (status: number, error: string, headers?: HeadersInit) => reply({ ok: false, error }, status, headers);

export async function POST(request: Request) {
  // 1. Server configuration (details only in the server log).
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const modelId = process.env.OPENROUTER_MODEL?.trim();
  if (!apiKey || !modelId) {
    console.error("[verify-gr] not configured: OPENROUTER_API_KEY or OPENROUTER_MODEL is missing");
    return fail(500, "Service not configured.");
  }

  // 2. Per-IP rate limit.
  const limited = rateLimit(clientIp(request.headers), Date.now());
  if (!limited.allowed) {
    return fail(429, "Too many checks, please wait a few minutes.", {
      "Retry-After": String(limited.retryAfterSeconds),
    });
  }

  // 3. Read and validate the upload.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_IMAGE_BYTES + 64 * 1024) {
    return fail(413, "The image is larger than 4 MB. Please use a smaller photo.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "The upload could not be read. Please try again.");
  }

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return fail(400, "Please choose a GR image to check.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return fail(413, "The image is larger than 4 MB. Please use a smaller photo.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = detectImageType(bytes); // from the file's content, not its name
  if (!mediaType) {
    return fail(415, "Please choose a JPG, PNG or WebP image.");
  }

  let contextJson: unknown;
  try {
    contextJson = JSON.parse(String(form.get("context") ?? ""));
  } catch {
    contextJson = null;
  }
  const context = VerifyContextSchema.safeParse(contextJson);
  if (!context.success) {
    return fail(400, "The invoice details sent with the image are incomplete. Please reload and try again.");
  }

  // 4. AI check + code guards.
  const outcome = await verifyGr({
    apiKey,
    modelId,
    image: bytes,
    mediaType,
    context: context.data,
    today: todayInManila(),
  });

  if (!outcome.ok) {
    console.error(`[verify-gr] AI call failed: ${outcome.failure}${outcome.status ? ` (HTTP ${outcome.status})` : ""}`);
    const { status, message } = FAILURE_MESSAGE[outcome.failure];
    return fail(status, message);
  }

  return reply({ ok: true, result: outcome.result });
}
