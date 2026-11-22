import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">GR Check</h1>
            <p className="text-sm text-slate-600">
              Find invoices blocked by a missing or invalid Goods Receipt, and chase the right ones first.
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Dashboard />
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-500 sm:px-6">
        Decision support for credit officers. Data stays in your browser for this session only.
      </footer>
    </div>
  );
}
