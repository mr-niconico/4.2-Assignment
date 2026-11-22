"use client";

import { useMemo, useState } from "react";
import { AgingBadge, BlockerBadges, GrBadge } from "@/components/Badges";
import { CheckGrButton, EmptyState, SortableTh, TableShell, TableSummary, Td, Th } from "@/components/Table";
import { nextSort, SORT_BY_AMOUNT, sortInvoices, summarize, type SortKey, type SortState } from "@/lib/amountFilter";
import { BLOCKER_LABEL, formatCount, formatDate, formatPhp, MAIN_BLOCKER_LABEL } from "@/lib/format";
import {
  AGING_BUCKETS,
  sortEarlyWarnings,
  type AgingBucket,
  type Blocker,
  type EvaluatedInvoice,
  type MainBlocker,
} from "@/lib/readiness";

// The invoices passed in are already filtered by the amount filter (Dashboard).
type TabProps = {
  invoices: EvaluatedInvoice[];
  today: string;
  amountFiltered: boolean;
  onCheckGr: (invoice: EvaluatedInvoice) => void;
};

const daysOverdue = (i: EvaluatedInvoice) => i.days_overdue;
const daysSinceDelivery = (i: EvaluatedInvoice) => i.days_since_delivery;

function Summary({ rows, note }: { rows: EvaluatedInvoice[]; note?: string }) {
  const { count, total } = summarize(rows);
  return <TableSummary count={formatCount(count)} total={formatPhp(total)} note={note} />;
}

function NoMatch({ amountFiltered, children }: { amountFiltered: boolean; children: React.ReactNode }) {
  return <EmptyState>{amountFiltered ? "No invoices in this tab match the amount filter." : children}</EmptyState>;
}

/** Sort header helper: which column is active and what clicking does. */
function useSort(initial: SortState | null) {
  const [sort, setSort] = useState<SortState | null>(initial);
  const header = (key: SortKey) => ({
    active: sort?.key === key,
    direction: sort?.key === key ? sort.direction : ("desc" as const),
    onClick: () => setSort(nextSort(sort, key)),
  });
  return { sort, setSort, header };
}

// ---------- Tab 1: Early warning (R7; default order R8, headers can re-sort) ----------
export function EarlyWarningTab({ invoices, today, amountFiltered, onCheckGr }: TabProps) {
  const { sort, setSort, header } = useSort(null); // null = priority order (R8)
  const rows = useMemo(() => {
    const flagged = invoices.filter((i) => i.early_warning);
    return sort ? sortInvoices(flagged, sort, daysSinceDelivery) : sortEarlyWarnings(flagged, today);
  }, [invoices, today, sort]);

  if (rows.length === 0) {
    return (
      <NoMatch amountFiltered={amountFiltered}>
        No early warnings: every invoice delivered more than 7 days ago has a valid GR.
      </NoMatch>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Summary
          rows={rows}
          note="GR not yet valid, delivered more than 7 days ago, at most 60 days overdue."
        />
        <p className="text-xs text-slate-500">
          {sort ? (
            <button type="button" onClick={() => setSort(null)} className="font-medium text-sky-700 hover:underline">
              Back to priority order (amount, then days)
            </button>
          ) : (
            "Priority order: largest amount first, then oldest delivery."
          )}
        </p>
      </div>
      <TableShell caption="Early warnings">
        <thead className="bg-slate-50">
          <tr>
            <Th align="right">#</Th>
            <Th>Customer</Th>
            <Th>Invoice no.</Th>
            <SortableTh align="right" {...header("amount")} active={sort === null || sort.key === "amount"}>
              Amount
            </SortableTh>
            <SortableTh align="right" {...header("days")}>
              Days since delivery
            </SortableTh>
            <Th>GR status</Th>
            <Th>
              <span className="sr-only">Action</span>
            </Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((inv, i) => (
            <tr key={inv.invoice_no} className="hover:bg-slate-50">
              <Td align="right" className="text-slate-500">
                {i + 1}
              </Td>
              <Td className="font-medium text-slate-900">{inv.customer_name}</Td>
              <Td className="whitespace-nowrap font-mono text-xs">{inv.invoice_no}</Td>
              <Td align="right">{formatPhp(inv.amount_php)}</Td>
              <Td align="right">{inv.days_since_delivery}</Td>
              <Td>
                <GrBadge status={inv.gr_status} />
              </Td>
              <Td align="right">
                <CheckGrButton onClick={() => onCheckGr(inv)} label={`Check GR for invoice ${inv.invoice_no}`} />
              </Td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}

// ---------- Tab 2: Blocked 60+ (grouped by main blocker; amount first by default) ----------
const GROUP_ORDER: MainBlocker[] = ["GR", "POD", "DISPUTE"];

export function BlockedTab({ invoices, amountFiltered, onCheckGr }: TabProps) {
  const { sort, header } = useSort(SORT_BY_AMOUNT);
  const active = sort ?? SORT_BY_AMOUNT;

  const { groups, allRows } = useMemo(() => {
    const blocked = invoices.filter((i) => i.blocked_60_plus);
    const grouped = GROUP_ORDER.map((group) => {
      const rows = sortInvoices(
        blocked.filter((i) => i.main_blocker === group),
        active,
        daysOverdue,
      );
      return { group, rows, subtotal: summarize(rows).total };
    }).filter((g) => g.rows.length > 0);
    return { groups: grouped, allRows: blocked };
  }, [invoices, active]);

  if (groups.length === 0) {
    return <NoMatch amountFiltered={amountFiltered}>Nothing is blocked for more than 60 days.</NoMatch>;
  }
  return (
    <div className="space-y-2">
      <Summary
        rows={allRows}
        note="Not payment-ready and more than 60 days overdue, grouped by the main blocker (GR first, then POD, then dispute)."
      />
      <TableShell caption="Invoices blocked more than 60 days, grouped by main blocker">
        <thead className="bg-slate-50">
          <tr>
            <Th>Customer</Th>
            <Th>Invoice no.</Th>
            <SortableTh align="right" {...header("amount")}>
              Amount
            </SortableTh>
            <SortableTh align="right" {...header("days")}>
              Days overdue
            </SortableTh>
            <Th>Aging</Th>
            <Th>Blockers</Th>
            <Th>
              <span className="sr-only">Action</span>
            </Th>
          </tr>
        </thead>
        {groups.map(({ group, rows, subtotal }) => (
          <tbody key={group} className="divide-y divide-slate-100">
            <tr className="bg-slate-100/70">
              <th scope="rowgroup" colSpan={2} className="px-3 py-2 text-left text-sm font-semibold text-slate-800">
                {MAIN_BLOCKER_LABEL[group]} · {formatCount(rows.length)}
              </th>
              <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-800">
                {formatPhp(subtotal)}
              </td>
              <td colSpan={4} className="px-3 py-2 text-xs text-slate-500">
                subtotal
              </td>
            </tr>
            {rows.map((inv) => (
              <tr key={inv.invoice_no} className="hover:bg-slate-50">
                <Td className="font-medium text-slate-900">{inv.customer_name}</Td>
                <Td className="whitespace-nowrap font-mono text-xs">{inv.invoice_no}</Td>
                <Td align="right">{formatPhp(inv.amount_php)}</Td>
                <Td align="right">{inv.days_overdue}</Td>
                <Td>
                  <AgingBadge bucket={inv.aging_bucket} />
                </Td>
                <Td>
                  <BlockerBadges blockers={inv.blockers} />
                </Td>
                <Td align="right">
                  <CheckGrButton onClick={() => onCheckGr(inv)} label={`Check GR for invoice ${inv.invoice_no}`} />
                </Td>
              </tr>
            ))}
          </tbody>
        ))}
      </TableShell>
    </div>
  );
}

// ---------- Tab 3: All invoices (search + filters; amount first by default) ----------
type BlockerFilter = "ALL" | "READY" | Blocker;
const BLOCKER_OPTIONS: Blocker[] = ["GR_MISSING", "GR_UNVERIFIED", "GR_INVALID", "POD_MISSING", "DISPUTE"];

export function AllInvoicesTab({ invoices, onCheckGr }: TabProps) {
  const [search, setSearch] = useState("");
  const [blocker, setBlocker] = useState<BlockerFilter>("ALL");
  const [aging, setAging] = useState<"ALL" | AgingBucket>("ALL");
  const { sort, header } = useSort(SORT_BY_AMOUNT);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = invoices
      .filter((i) =>
        q
          ? [i.customer_name, i.invoice_no, i.po_no, i.dr_no, i.po_recipient_name].some((v) =>
              v.toLowerCase().includes(q),
            )
          : true,
      )
      .filter((i) =>
        blocker === "ALL" ? true : blocker === "READY" ? i.payment_ready : i.blockers.includes(blocker),
      )
      .filter((i) => (aging === "ALL" ? true : i.aging_bucket === aging));
    return sortInvoices(filtered, sort ?? SORT_BY_AMOUNT, daysOverdue);
  }, [invoices, search, blocker, aging, sort]);

  const filtered = search !== "" || blocker !== "ALL" || aging !== "ALL";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-end">
        <div className="flex-1">
          <label htmlFor="search" className="block text-xs font-medium text-slate-600">
            Search
          </label>
          <input
            id="search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Customer, invoice, PO, DR or recipient"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <div>
          <label htmlFor="blocker-filter" className="block text-xs font-medium text-slate-600">
            Blocker
          </label>
          <select
            id="blocker-filter"
            value={blocker}
            onChange={(e) => setBlocker(e.target.value as BlockerFilter)}
            className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="ALL">All</option>
            <option value="READY">Payment-ready (no blocker)</option>
            {BLOCKER_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {BLOCKER_LABEL[b]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="aging-filter" className="block text-xs font-medium text-slate-600">
            Aging
          </label>
          <select
            id="aging-filter"
            value={aging}
            onChange={(e) => setAging(e.target.value as "ALL" | AgingBucket)}
            className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="ALL">All</option>
            {AGING_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {b === "Current" ? "Current" : `${b} days`}
              </option>
            ))}
          </select>
        </div>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setBlocker("ALL");
              setAging("ALL");
            }}
            className="rounded-md px-2 py-1.5 text-sm font-medium text-sky-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <Summary rows={rows} />

      {rows.length === 0 ? (
        <EmptyState>No invoices match these filters.</EmptyState>
      ) : (
        <TableShell caption="All invoices">
          <thead className="bg-slate-50">
            <tr>
              <Th>Customer</Th>
              <Th>Invoice no.</Th>
              <SortableTh align="right" {...header("amount")}>
                Amount
              </SortableTh>
              <Th>Due date</Th>
              <SortableTh align="right" {...header("days")}>
                Days overdue
              </SortableTh>
              <Th>Aging</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Action</span>
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((inv) => (
              <tr key={inv.invoice_no} className="hover:bg-slate-50">
                <Td className="font-medium text-slate-900">{inv.customer_name}</Td>
                <Td className="whitespace-nowrap font-mono text-xs">{inv.invoice_no}</Td>
                <Td align="right">{formatPhp(inv.amount_php)}</Td>
                <Td className="whitespace-nowrap">{formatDate(inv.due_date)}</Td>
                <Td align="right">{inv.days_overdue}</Td>
                <Td>
                  <AgingBadge bucket={inv.aging_bucket} />
                </Td>
                <Td>
                  <BlockerBadges blockers={inv.blockers} />
                </Td>
                <Td align="right">
                  <CheckGrButton onClick={() => onCheckGr(inv)} label={`Check GR for invoice ${inv.invoice_no}`} />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
