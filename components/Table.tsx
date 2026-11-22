// Small shared table pieces so all three tabs look the same.

export function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

/** A column header you can click to sort. Shows ↓ / ↑ for the current sort. */
export function SortableTh({
  children,
  active,
  direction,
  onClick,
  align = "left",
}: {
  children: React.ReactNode;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "desc" ? "descending" : "ascending") : "none"}
      className={`whitespace-nowrap px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:text-slate-900 ${
          active ? "text-slate-900" : "text-slate-500"
        }`}
      >
        {children}
        <span aria-hidden="true" className={active ? "" : "opacity-30"}>
          {active && direction === "asc" ? "↑" : "↓"}
        </span>
      </button>
    </th>
  );
}

/** "Showing X invoices totalling ₱Y" above each table. */
export function TableSummary({ count, total, note }: { count: string; total: string; note?: string }) {
  return (
    <div className="space-y-0.5" aria-live="polite">
      <p className="text-sm text-slate-800">
        Showing <span className="font-semibold tabular-nums">{count}</span> invoices totalling{" "}
        <span className="font-semibold tabular-nums">{total}</span>
      </p>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td className={`px-3 py-2.5 align-middle ${align === "right" ? "text-right tabular-nums" : ""} ${className}`}>
      {children}
    </td>
  );
}

export function TableShell({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function CheckGrButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-50"
    >
      Check GR
    </button>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">
      {children}
    </div>
  );
}
