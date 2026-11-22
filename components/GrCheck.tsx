"use client";

import { useEffect, useRef, useState } from "react";
import { VerdictCard } from "@/components/VerdictCard";
import type { GuardedResult } from "@/lib/grGuards";
import { decodeQrFromFile } from "@/lib/qr";
import { checkImageFile, type VerifyContext, type VerifyResponse } from "@/lib/schemas";

type Props = {
  context: Omit<VerifyContext, "qr_text">;
  savedResult: GuardedResult | null;
  onResult: (result: GuardedResult) => void;
};

type Phase = "idle" | "scanning" | "ready" | "checking" | "error";

/** Upload a GR image, scan it for a QR code, send it for the AI check and show the result. */
export function GrCheck({ context, savedResult, onResult }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [qrText, setQrText] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<GuardedResult | null>(savedResult);
  const inputRef = useRef<HTMLInputElement>(null);

  // Free the preview's memory when it changes or the panel closes.
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function choose(next: File) {
    const problem = checkImageFile(next);
    if (problem) {
      setMessage(problem);
      setPhase("error");
      return;
    }
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setResult(null);
    setMessage(null);
    setPhase("scanning");
    setQrText(await decodeQrFromFile(next));
    setPhase("ready");
  }

  async function check() {
    if (!file) return;
    setPhase("checking");
    setMessage(null);
    const body = new FormData();
    body.append("image", file);
    body.append("context", JSON.stringify({ ...context, qr_text: qrText }));
    try {
      const res = await fetch("/api/verify-gr", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as VerifyResponse | null;
      if (!data) throw new Error("bad response");
      if (!data.ok) {
        setMessage(data.error);
        setPhase("error");
        return;
      }
      setResult(data.result);
      onResult(data.result);
      setPhase("ready");
    } catch {
      setMessage("The AI check is unavailable, please try again.");
      setPhase("error");
    }
  }

  const busy = phase === "scanning" || phase === "checking";

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="gr-image"
          className={`inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 ${
            busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {file ? "Choose a different image" : "Upload GR image"}
          <input
            id="gr-image"
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const next = e.target.files?.[0];
              if (next) void choose(next);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </label>
        <p className="mt-1 text-xs text-slate-500">JPG, PNG or WebP, up to 4 MB.</p>
      </div>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local preview of the user's own file
        <img
          src={previewUrl}
          alt="Preview of the uploaded GR document"
          className="max-h-72 w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
        />
      )}

      {phase === "scanning" && <p className="text-sm text-slate-600">Looking for a QR code…</p>}
      {file && phase !== "scanning" && (
        <p className="text-sm text-slate-600">
          {qrText ? (
            <>
              <span className="font-medium text-slate-900">QR code found:</span>{" "}
              <span className="break-all font-mono text-xs">{qrText}</span>
            </>
          ) : (
            "No QR code found in this image."
          )}
        </p>
      )}

      {file && (phase === "ready" || phase === "error") && (
        <button
          type="button"
          onClick={check}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
        >
          {phase === "error" ? "Try again" : result ? "Check again" : "Check GR"}
        </button>
      )}

      {phase === "checking" && (
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800"
          />
          Reading document…
        </p>
      )}

      {phase === "error" && message && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span aria-hidden="true">✕ </span>
          {message}
        </p>
      )}

      {result && phase !== "checking" && (
        <div className="rounded-lg border border-slate-200 p-4">
          {!file && <p className="mb-3 text-xs text-slate-500">Result of the last check in this session.</p>}
          <VerdictCard result={result} />
        </div>
      )}
    </div>
  );
}
