import { formatCount, formatPhp } from "@/lib/format";
import type { dashboardKpis } from "@/lib/readiness";

type Kpis = ReturnType<typeof dashboardKpis>;

function Tile({ label, value, detail, accent }: { label: string; value: string; detail?: string; accent: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm border-l-4 ${accent}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {detail && <p className="mt-0.5 text-sm tabular-nums text-slate-600">{detail}</p>}
    </div>
  );
}

export function KpiTiles({ kpis, invoiceCount }: { kpis: Kpis; invoiceCount: number }) {
  return (
    <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        label="Total AR"
        value={formatPhp(kpis.total_ar_php)}
        detail={`${formatCount(invoiceCount)} invoices`}
        accent="border-l-slate-400"
      />
      <Tile
        label="Payment-ready"
        value={`${kpis.payment_ready_pct.toFixed(1)}%`}
        detail={`${formatPhp(kpis.payment_ready_php)} of AR`}
        accent="border-l-emerald-500"
      />
      <Tile
        label="Blocked 60+ days"
        value={formatCount(kpis.blocked_60_plus_count)}
        detail={formatPhp(kpis.blocked_60_plus_php)}
        accent="border-l-red-500"
      />
      <Tile
        label="Early warnings"
        value={formatCount(kpis.early_warning_count)}
        detail="GR not valid, delivered 8+ days ago"
        accent="border-l-amber-500"
      />
    </section>
  );
}
