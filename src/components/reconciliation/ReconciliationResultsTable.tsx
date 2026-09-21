"use client";

import { useCallback, useMemo, useState } from "react";
import FailedInvoiceDetailsDrawer from "@/components/reconciliation/FailedInvoiceDetailsDrawer";
import Icon from "@/components/ui/Icon";
import StatusBadge from "@/components/ui/StatusBadge";
import type { ReconciliationBatchDetails, ReconciliationRowDetails } from "@/components/reconciliation/types";

type Props = { rows: ReconciliationRowDetails[]; batch: ReconciliationBatchDetails };
type Filter = "ALL" | "MATCHED" | "MISMATCHED" | "UNMATCHED" | "ERROR" | "PENDING";

export default function ReconciliationResultsTable({ rows, batch }: Props) {
  const [selectedRow, setSelectedRow] = useState<ReconciliationRowDetails | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const closeDrawer = useCallback(() => setSelectedRow(null), []);
  const visibleRows = useMemo(() => rows.filter((row) => {
    const matchesStatus = filter === "ALL" || row.reconciliationResult === filter;
    const search = query.trim().toLowerCase();
    return matchesStatus && (!search || [row.invoiceNumber, row.supplierGstin, row.matchedReference?.invoiceNumber].some((value) => value?.toLowerCase().includes(search)));
  }), [filter, query, rows]);

  return <>
    <div className="border-b border-border bg-surface-muted/35 px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="text-base font-bold text-foreground">Reconciliation results</h2><p className="mt-1 text-xs text-slate-500">Inspect mismatches and row-level errors without leaving this batch.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><span className="sr-only">Search invoices</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice or GSTIN" className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-56" /></label><label className="sr-only" htmlFor="result-filter">Filter results</label><select id="result-filter" value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"><option value="ALL">All statuses</option><option value="MATCHED">Matched</option><option value="MISMATCHED">Mismatched</option><option value="UNMATCHED">Unmatched</option><option value="ERROR">Error</option><option value="PENDING">Pending</option></select></div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Showing <strong className="text-foreground">{visibleRows.length}</strong> of {rows.length} rows</span>{query || filter !== "ALL" ? <button type="button" onClick={() => { setQuery(""); setFilter("ALL"); }} className="font-semibold text-primary hover:text-primary-hover">Clear filters</button> : null}</div>
    </div>
    {rows.length === 0 ? <div className="p-8 text-center"><p className="text-sm font-semibold text-foreground">No reconciliation rows yet</p><p className="mt-1 text-sm text-slate-500">Rows will appear here once the batch has been processed.</p></div> : visibleRows.length === 0 ? <div className="p-8 text-center"><p className="text-sm font-semibold text-foreground">No invoices match these filters</p><p className="mt-1 text-sm text-slate-500">Try a different search or clear the active filters.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="sticky top-0 bg-surface-muted/80 text-[11px] uppercase tracking-[.08em] text-slate-500 backdrop-blur"><tr><th className="px-5 py-3 font-semibold">Row</th><th className="px-5 py-3 font-semibold">Invoice</th><th className="px-5 py-3 font-semibold">Supplier GSTIN</th><th className="px-5 py-3 font-semibold">Reference</th><th className="px-5 py-3 font-semibold">Result</th><th className="px-5 py-3 font-semibold">Reason</th><th className="px-5 py-3 text-right font-semibold">Details</th></tr></thead><tbody className="divide-y divide-border">{visibleRows.map((row) => { const canInspect = isInspectable(row); return <tr key={row.id} className={`transition-colors ${canInspect ? "hover:bg-info-surface/35" : "hover:bg-surface-muted/45"}`}><td className="px-5 py-4 font-mono text-xs text-slate-500">{String(row.rowNumber).padStart(2, "0")}</td><td className="px-5 py-4 font-semibold text-foreground">{displayValue(row.invoiceNumber)}</td><td className="px-5 py-4 font-mono text-xs text-slate-600">{displayValue(row.supplierGstin)}</td><td className="px-5 py-4 text-slate-600">{row.matchedReference?.invoiceNumber ?? "Not found"}</td><td className="px-5 py-4"><StatusBadge value={row.reconciliationResult} compact /></td><td className="max-w-[320px] truncate px-5 py-4 text-slate-600" title={getReason(row)}>{getReason(row)}</td><td className="px-5 py-4 text-right">{canInspect ? <button type="button" onClick={() => setSelectedRow(row)} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-info-surface hover:text-primary" aria-label={`View details for row ${row.rowNumber}`}>View <Icon name="arrow-right" size={13} /></button> : <span className="text-slate-300">—</span>}</td></tr>; })}</tbody></table></div>}
    <FailedInvoiceDetailsDrawer open={selectedRow !== null} row={selectedRow} batch={batch} onClose={closeDrawer} />
  </>;
}

function isInspectable(row: ReconciliationRowDetails) { return row.processingStatus === "FAILED" || row.reconciliationResult === "ERROR" || row.reconciliationResult === "MISMATCHED" || row.reconciliationResult === "UNMATCHED"; }
function getReason(row: ReconciliationRowDetails) { if (row.errorMessage) return row.errorMessage; if (row.mismatchCodes.length > 0) return row.mismatchCodes.map(formatStatus).join(", "); if (row.reconciliationResult === "MATCHED") return "All compared fields matched"; return "No reason recorded"; }
function formatStatus(value: string) { return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function displayValue(value: string | null) { return value && value.length > 0 ? value : "Not available"; }
