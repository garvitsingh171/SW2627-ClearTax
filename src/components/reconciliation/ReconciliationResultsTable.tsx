"use client";

import { useCallback, useState } from "react";
import FailedInvoiceDetailsDrawer from "@/components/reconciliation/FailedInvoiceDetailsDrawer";
import type {
  ReconciliationBatchDetails,
  ReconciliationRowDetails,
} from "@/components/reconciliation/types";

type ReconciliationResultsTableProps = {
  rows: ReconciliationRowDetails[];
  batch: ReconciliationBatchDetails;
};

const resultStyles = {
  PENDING: "bg-surface-muted text-slate-700",
  MATCHED: "bg-success-surface text-success-foreground",
  MISMATCHED: "bg-warning-surface text-warning-foreground",
  UNMATCHED: "bg-warning-surface text-warning-foreground",
  ERROR: "bg-error-surface text-error-foreground",
} as const;

export default function ReconciliationResultsTable({
  rows,
  batch,
}: ReconciliationResultsTableProps) {
  const [selectedRow, setSelectedRow] =
    useState<ReconciliationRowDetails | null>(null);

  const closeDrawer = useCallback(() => {
    setSelectedRow(null);
  }, []);

  if (rows.length === 0) {
    return (
      <div className="p-5 text-sm text-slate-500">
        No reconciliation rows have been persisted for this batch yet.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Row</th>
              <th className="px-5 py-3 font-medium">Invoice</th>
              <th className="px-5 py-3 font-medium">Supplier GSTIN</th>
              <th className="px-5 py-3 font-medium">Reference</th>
              <th className="px-5 py-3 font-medium">Result</th>
              <th className="px-5 py-3 font-medium">Reason</th>
              <th className="px-5 py-3 text-right font-medium">Details</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const canInspect = isInspectable(row);

              return (
                <tr
                  key={row.id}
                  className={
                    canInspect
                      ? "transition-colors hover:bg-surface-muted/70"
                      : undefined
                  }
                >
                  <td className="px-5 py-4 text-slate-600">
                    {row.rowNumber}
                  </td>
                  <td className="px-5 py-4 font-medium text-foreground">
                    {displayValue(row.invoiceNumber)}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-600">
                    {displayValue(row.supplierGstin)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {row.matchedReference?.invoiceNumber ?? "Not found"}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-medium ${resultStyles[row.reconciliationResult]}`}
                    >
                      {formatStatus(row.reconciliationResult)}
                    </span>
                  </td>
                  <td className="max-w-[320px] px-5 py-4 text-slate-600">
                    {getReason(row)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {canInspect ? (
                      <button
                        type="button"
                        onClick={() => setSelectedRow(row)}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted"
                        aria-label={`View details for row ${row.rowNumber}`}
                      >
                        View →
                      </button>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FailedInvoiceDetailsDrawer
        open={selectedRow !== null}
        row={selectedRow}
        batch={batch}
        onClose={closeDrawer}
      />
    </>
  );
}

function isInspectable(row: ReconciliationRowDetails) {
  return (
    row.processingStatus === "FAILED" ||
    row.reconciliationResult === "ERROR" ||
    row.reconciliationResult === "MISMATCHED" ||
    row.reconciliationResult === "UNMATCHED"
  );
}

function getReason(row: ReconciliationRowDetails) {
  if (row.errorMessage) {
    return row.errorMessage;
  }

  if (row.mismatchCodes.length > 0) {
    return row.mismatchCodes.map(formatStatus).join(", ");
  }

  if (row.reconciliationResult === "MATCHED") {
    return "All compared fields matched";
  }

  return "No reason recorded";
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function displayValue(value: string | null) {
  return value && value.length > 0 ? value : "Not available";
}
