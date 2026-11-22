// Quick connection test for OpenRouter.
// Run with: npm run check:ai
// (which runs: node --env-file=.env.local scripts/check-ai.mjs)
//
// It sends one tiny prompt and prints the model, the reply and the token usage.
// The API key is never printed.

import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

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

const openrouter = createOpenRouter({ apiKey });

console.log(`Model requested: ${modelId}`);
console.log("Sending test prompt...");

try {
  const result = await generateText({
    model: openrouter.chat(modelId),
    prompt: "Reply with exactly: GR Check connection OK",
    // Keep the answer small. Without a limit, OpenRouter reserves credit for the
    // model's maximum answer length (65k tokens) and may refuse with HTTP 402.
    // Leave room for "thinking" models, whose reasoning also counts as output.
    maxOutputTokens: 500,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(30_000),
  });

  const usage = result.usage ?? {};
  console.log("");
  console.log(`Model used:      ${result.response?.modelId ?? modelId}`);
  console.log(`Reply:           ${result.text.trim()}`);
  console.log(
    `Token usage:     input ${usage.inputTokens ?? "?"} · output ${usage.outputTokens ?? "?"} · total ${usage.totalTokens ?? "?"}`,
  );
  console.log("");
  console.log(
    result.text.trim() === "GR Check connection OK"
      ? "✅ Connection works."
      : "⚠️ Connected, but the reply was not exactly as requested.",
  );
} catch (error) {
  console.error("");
  console.error(`❌ The AI call failed: ${friendlyMessage(error)}`);
  process.exit(1);
}

// Turn technical errors into plain English, without printing the key or full responses.
function friendlyMessage(error) {
  // The SDK wraps retried failures in a RetryError; the real cause is lastError.
  const err = error?.lastError ?? error;
  const status = err?.statusCode;

  if (err?.name === "TimeoutError" || err?.name === "AbortError") {
    return "No answer within 30 seconds. Try again in a minute.";
  }
  switch (status) {
    case 401:
      return "The API key was rejected (invalid or revoked). Copy a fresh key from openrouter.ai/keys into .env.local.";
    case 402:
      return "Not enough OpenRouter credits for this request (or the key's spending limit is too low). Add credits at openrouter.ai/settings/credits or raise the key's limit.";
    case 403:
      return `This key is not allowed to use "${modelId}" (check the key's limits or your OpenRouter privacy/provider settings).`;
    case 400:
    case 404:
      return `The model "${modelId}" was not found or not accepted. Check the exact model name on openrouter.ai/models.`;
    case 429:
      return "Too many requests right now (rate limit). Wait a minute and try again.";
    default:
      if (status && status >= 500) {
        return `OpenRouter or the model provider had a temporary problem (HTTP ${status}). Try again later.`;
      }
      if (!status) {
        return "Could not reach OpenRouter. Check your internet connection.";
      }
      return `Unexpected error (HTTP ${status}).`;
  }
}
