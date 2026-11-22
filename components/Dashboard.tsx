"use client";

import { useCallback, useMemo, useState } from "react";
import { AmountFilterBar } from "@/components/AmountFilterBar";
import { GrPanel } from "@/components/GrPanel";
import { KpiTiles } from "@/components/KpiTiles";
import { AllInvoicesTab, BlockedTab, EarlyWarningTab } from "@/components/Tabs";
import { UploadPanel, type LoadInfo } from "@/components/UploadPanel";
import { filterByAmount, isAmountFilterActive, NO_AMOUNT_FILTER, type AmountFilter } from "@/lib/amountFilter";
import { checkCsvFile, parseInvoiceCsv, type RowError } from "@/lib/csv";
import { todayInManila } from "@/lib/dates";
import type { GuardedResult } from "@/lib/grGuards";
import { grStatusAfterVerdict } from "@/lib/grStatus";
import { formatCount, formatDate } from "@/lib/format";
import { dashboardKpis, evaluateInvoice, type EvaluatedInvoice, type Invoice } from "@/lib/readiness";
import { generateSampleInvoices } from "@/lib/sampleData";

type TabId = "early" | "blocked" | "all";

export function Dashboard() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  // "today" is only read when data is loaded (never while the page is being prepared on the server).
  const [today, setToday] = useState<string | null>(null);
  const [info, setInfo] = useState<LoadInfo | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabId>("early");
  const [selectedNo, setSelectedNo] = useState<string | null>(null);
  const [amountFilter, setAmountFilter] = useState<AmountFilter>(NO_AMOUNT_FILTER);
  // Last GR check result per invoice, for this session only.
  const [grResults, setGrResults] = useState<Record<string, GuardedResult>>({});

  const evaluated = useMemo(
    () => (today ? invoices.map((inv) => evaluateInvoice(inv, today)) : []),
    [invoices, today],
  );
  // The amount filter applies to all three tabs; the KPI tiles always show the whole register.
  const visible = useMemo(() => filterByAmount(evaluated, amountFilter), [evaluated, amountFilter]);
  const amountFiltered = isAmountFilterActive(amountFilter);
  const kpis = useMemo(() => (today ? dashboardKpis(invoices, today) : null), [invoices, today]);
  const selected = evaluated.find((i) => i.invoice_no === selectedNo) ?? null;

  function show(list: Invoice[], source: string, skipped: number, errors: RowError[]) {
    const now = todayInManila();
    setToday(now);
    setInvoices(list);
    setRowErrors(errors);
    setFileError(null);
    setInfo({ source, loaded: list.length, skipped, asOf: formatDate(now) });
    setTab("early");
    setSelectedNo(null);
    setGrResults({});
  }

  /** A GR verdict updates that invoice's GR status for this session; every figure then recalculates. */
  const recordGrResult = useCallback((invoiceNo: string, result: GuardedResult) => {
    setGrResults((prev) => ({ ...prev, [invoiceNo]: result }));
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.invoice_no === invoiceNo ? { ...inv, gr_status: grStatusAfterVerdict(result.verdict) } : inv,
      ),
    );
  }, []);

  function loadSample() {
    show(generateSampleInvoices(todayInManila()), "Sample data (fictional)", 0, []);
  }

  async function loadFile(file: File) {
    const problem = checkCsvFile(file);
    if (problem) {
      setFileError(problem);
      return;
    }
    setBusy(true);
    try {
      const result = parseInvoiceCsv(await file.text());
      if (!result.ok) {
        setFileError(result.error);
        setRowErrors([]);
        return;
      }
      if (result.invoices.length === 0) {
        setFileError("No valid invoice rows were found in this file.");
        setRowErrors(result.errors);
        return;
      }
      const skippedRows = new Set(result.errors.map((e) => e.row)).size;
      show(result.invoices, file.name, skippedRows, result.errors);
    } catch {
      setFileError("The file could not be read. Please check it is a CSV file and try again.");
    } finally {
      setBusy(false);
    }
  }

  const openPanel = useCallback((inv: EvaluatedInvoice) => setSelectedNo(inv.invoice_no), []);
  const closePanel = useCallback(() => setSelectedNo(null), []);

  const counts = {
    early: visible.filter((i) => i.early_warning).length,
    blocked: visible.filter((i) => i.blocked_60_plus).length,
    all: visible.length,
  };
  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "early", label: "Early warning", count: counts.early },
    { id: "blocked", label: "Blocked 60+", count: counts.blocked },
    { id: "all", label: "All invoices", count: counts.all },
  ];

  return (
    <div className="space-y-6">
      <UploadPanel
        onFile={loadFile}
        onSample={loadSample}
        fileError={fileError}
        rowErrors={rowErrors}
        info={info}
        busy={busy}
      />

      {kpis && today && (
        <>
          <KpiTiles kpis={kpis} invoiceCount={invoices.length} />

          <section aria-label="Invoice lists" className="space-y-4">
            <AmountFilterBar filter={amountFilter} onChange={setAmountFilter} />
            <div role="tablist" aria-label="Invoice lists" className="flex gap-1 border-b border-slate-200">
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    id={`tab-${t.id}`}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    aria-controls={`panel-${t.id}`}
                    onClick={() => setTab(t.id)}
                    className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                      active
                        ? "border-slate-900 text-slate-900"
                        : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    }`}
                  >
                    {t.label}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs tabular-nums ${
                        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {formatCount(t.count)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
              {tab === "early" && (
                <EarlyWarningTab invoices={visible} today={today} amountFiltered={amountFiltered} onCheckGr={openPanel} />
              )}
              {tab === "blocked" && (
                <BlockedTab invoices={visible} today={today} amountFiltered={amountFiltered} onCheckGr={openPanel} />
              )}
              {tab === "all" && (
                <AllInvoicesTab invoices={visible} today={today} amountFiltered={amountFiltered} onCheckGr={openPanel} />
              )}
            </div>
          </section>
        </>
      )}

      {!kpis && !fileError && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">
          Upload your invoice register, or click <span className="font-medium">Load sample data</span> to try the app
          with fictional invoices.
        </p>
      )}

      {selected && (
        <GrPanel
          key={selected.invoice_no}
          invoice={selected}
          savedResult={grResults[selected.invoice_no] ?? null}
          onResult={(result) => recordGrResult(selected.invoice_no, result)}
          onClose={closePanel}
        />
      )}
    </div>
  );
}
