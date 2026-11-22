// Status badges: always text + symbol + colour, so meaning never depends on colour alone.

import { BLOCKER_LABEL, GR_LABEL, POD_LABEL } from "@/lib/format";
import type { AgingBucket, Blocker, GrStatus, PodStatus } from "@/lib/readiness";

type Tone = "green" | "amber" | "red" | "gray" | "blue";

const TONE: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-900 ring-amber-600/25",
  red: "bg-red-50 text-red-800 ring-red-600/20",
  gray: "bg-slate-100 text-slate-700 ring-slate-500/20",
  blue: "bg-sky-50 text-sky-800 ring-sky-600/20",
};

const SYMBOL: Record<Tone, string> = { green: "✓", amber: "!", red: "✕", gray: "–", blue: "•" };

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[tone]}`}
    >
      <span aria-hidden="true">{SYMBOL[tone]}</span>
      {children}
    </span>
  );
}

const GR_TONE: Record<GrStatus, Tone> = { VALID: "green", RECEIVED_UNVERIFIED: "amber", NONE: "red", INVALID: "red" };

export function GrBadge({ status }: { status: GrStatus }) {
  return <Badge tone={GR_TONE[status]}>GR {GR_LABEL[status].toLowerCase()}</Badge>;
}

export function PodBadge({ status }: { status: PodStatus }) {
  return <Badge tone={status === "RECEIVED" ? "green" : "red"}>POD {POD_LABEL[status].toLowerCase()}</Badge>;
}

const BLOCKER_TONE: Record<Blocker, Tone> = {
  GR_MISSING: "red",
  GR_UNVERIFIED: "amber",
  GR_INVALID: "red",
  POD_MISSING: "red",
  DISPUTE: "amber",
};

export function BlockerBadges({ blockers }: { blockers: Blocker[] }) {
  if (blockers.length === 0) return <Badge tone="green">Payment-ready</Badge>;
  return (
    <span className="flex flex-wrap gap-1">
      {blockers.map((b) => (
        <Badge key={b} tone={BLOCKER_TONE[b]}>
          {BLOCKER_LABEL[b]}
        </Badge>
      ))}
    </span>
  );
}

export function AgingBadge({ bucket }: { bucket: AgingBucket }) {
  const tone: Tone = bucket === "Current" ? "gray" : bucket === "1–30" || bucket === "31–60" ? "amber" : "red";
  return <Badge tone={tone}>{bucket === "Current" ? "Current" : `${bucket} days`}</Badge>;
}
