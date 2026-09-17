"use client";

import { useEffect, useRef } from "react";
import type {
  JsonValue,
  ReconciliationBatchDetails,
  ReconciliationRowDetails,
} from "@/components/reconciliation/types";

type FailedInvoiceDetailsDrawerProps = {
  open: boolean;
  row: ReconciliationRowDetails | null;
  batch: ReconciliationBatchDetails;
  onClose: () => void;
};

const fieldLabels: Record<string, string> = {
  invoiceNumber: "Invoice Number",
  normalizedInvoiceNumber: "Normalized Invoice",
  supplierGstin: "Supplier GSTIN",
  invoiceDate: "Invoice Date",
  taxableValue: "Taxable Value",
  igstAmount: "IGST",
  cgstAmount: "CGST",
  sgstAmount: "SGST",
  cessAmount: "CESS",
  totalInvoiceValue: "Total",
};

const mismatchLabels: Record<string, string> = {
  REFERENCE_NOT_FOUND: "GSTR-2B reference not found",
  INVOICE_DATE_MISMATCH: "Invoice date mismatch",
  TAXABLE_VALUE_MISMATCH: "Taxable value mismatch",
  TAX_AMOUNT_MISMATCH: "Tax amount mismatch",
  IGST_MISMATCH: "IGST mismatch",
  CGST_MISMATCH: "CGST mismatch",
  SGST_MISMATCH: "SGST mismatch",
  CESS_MISMATCH: "CESS mismatch",
  TOTAL_VALUE_MISMATCH: "Total invoice value mismatch",
  SUPPLIER_GSTIN_MISMATCH: "Supplier GSTIN mismatch",
};

const mismatchFields: Record<string, keyof ReconciliationRowDetails> = {
  INVOICE_DATE_MISMATCH: "invoiceDate",
  TAXABLE_VALUE_MISMATCH: "taxableValue",
  IGST_MISMATCH: "igstAmount",
  CGST_MISMATCH: "cgstAmount",
  SGST_MISMATCH: "sgstAmount",
  CESS_MISMATCH: "cessAmount",
  TOTAL_VALUE_MISMATCH: "totalInvoiceValue",
  SUPPLIER_GSTIN_MISMATCH: "supplierGstin",
};

const moneyFields = new Set([
  "taxableValue",
  "igstAmount",
  "cgstAmount",
  "sgstAmount",
  "cessAmount",
  "totalInvoiceValue",
]);

const comparisonFields = [
  "invoiceNumber",
  "supplierGstin",
  "invoiceDate",
  "taxableValue",
  "igstAmount",
  "cgstAmount",
  "sgstAmount",
  "cessAmount",
  "totalInvoiceValue",
] as const;

export default function FailedInvoiceDetailsDrawer({
  open,
  row,
  batch,
  onClose,
}: FailedInvoiceDetailsDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close invoice details"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/30"
        />
      ) : null}

      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-labelledby="invoice-details-title"
        className={`
          fixed
          inset-y-0
          right-0
          z-50
          flex
          w-full
          max-w-[560px]
          flex-col
          border-l
          border-border
          bg-surface
          shadow-dropdown
          transition-transform
          duration-200
          sm:w-[min(560px,92vw)]
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Invoice Details
            </p>
            <h2
              id="invoice-details-title"
              className="mt-1 text-xl font-semibold text-foreground"
            >
              {displayValue(row?.invoiceNumber)}
            </h2>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            tabIndex={open ? 0 : -1}
            className="flex h-9 w-9 items-center justify-center rounded-md text-xl text-slate-500 hover:bg-surface-muted hover:text-foreground"
            aria-label="Close invoice details"
          >
            ×
          </button>
        </div>

        {row ? (
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill value={formatStatus(row.reconciliationResult)} />
              <span className="rounded-md bg-surface-muted px-2.5 py-1 text-xs font-medium text-slate-600">
                Row {row.rowNumber}
              </span>
              <span className="rounded-md bg-surface-muted px-2.5 py-1 text-xs font-medium text-slate-600">
                {batch.originalFilename}
              </span>
            </div>

            <section className="mt-6 rounded-md border border-error bg-error-surface p-4">
              <h3 className="text-sm font-semibold text-error-foreground">
                Failure Reason
              </h3>
              <div className="mt-3 space-y-3 text-sm text-error-foreground">
                {getIssues(row).map((issue) => (
                  <div key={issue.title}>
                    <p className="font-medium">{issue.title}</p>
                    {issue.description ? (
                      <p className="mt-1">{issue.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <DetailsSection title="Purchase Register">
              <DefinitionList
                rows={[
                  ["Invoice Number", row.invoiceNumber],
                  ["Supplier GSTIN", row.supplierGstin],
                  ["Invoice Date", formatDate(row.invoiceDate)],
                  ["Taxable Value", formatMoney(row.taxableValue)],
                  ["CGST", formatMoney(row.cgstAmount)],
                  ["SGST", formatMoney(row.sgstAmount)],
                  ["IGST", formatMoney(row.igstAmount)],
                  ["CESS", formatMoney(row.cessAmount)],
                  ["Total", formatMoney(row.totalInvoiceValue)],
                ]}
              />
            </DetailsSection>

            <DetailsSection title="GSTR-2B Reference">
              {row.matchedReference ? (
                <DefinitionList
                  rows={[
                    ["Invoice Number", row.matchedReference.invoiceNumber],
                    ["Supplier GSTIN", row.matchedReference.supplierGstin],
                    [
                      "Invoice Date",
                      formatDate(row.matchedReference.invoiceDate),
                    ],
                    [
                      "Taxable Value",
                      formatMoney(row.matchedReference.taxableValue),
                    ],
                    ["CGST", formatMoney(row.matchedReference.cgstAmount)],
                    ["SGST", formatMoney(row.matchedReference.sgstAmount)],
                    ["IGST", formatMoney(row.matchedReference.igstAmount)],
                    ["CESS", formatMoney(row.matchedReference.cessAmount)],
                    [
                      "Total",
                      formatMoney(row.matchedReference.totalInvoiceValue),
                    ],
                  ]}
                />
              ) : (
                <p className="text-sm text-slate-600">
                  No corresponding invoice was found in the uploaded GSTR-2B
                  data.
                </p>
              )}
            </DetailsSection>

            <DetailsSection title="Comparison">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="border-b border-border px-3 py-2 font-medium">
                        Field
                      </th>
                      <th className="border-b border-border px-3 py-2 font-medium">
                        Purchase Register
                      </th>
                      <th className="border-b border-border px-3 py-2 font-medium">
                        GSTR-2B
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonFields.map((field) => {
                      const different = isFieldDifferent(row, field);

                      return (
                        <tr
                          key={field}
                          className={
                            different
                              ? "bg-warning-surface text-warning-foreground"
                              : "text-slate-600"
                          }
                        >
                          <td className="border-b border-border px-3 py-2 font-medium">
                            {fieldLabels[field]}
                          </td>
                          <td className="border-b border-border px-3 py-2">
                            {formatFieldValue(field, row[field])}
                          </td>
                          <td className="border-b border-border px-3 py-2">
                            {formatFieldValue(
                              field,
                              row.matchedReference?.[field] ?? null,
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DetailsSection>

            <DetailsSection title="Processing Information">
              <DefinitionList
                rows={[
                  ["Processing Status", formatStatus(row.processingStatus)],
                  ["Reconciliation Status", formatStatus(row.reconciliationResult)],
                  ["Error Code", row.errorCode ? formatStatus(row.errorCode) : null],
                  ["Processed At", formatDateTime(row.processedAt)],
                  ["Created At", formatDateTime(row.createdAt)],
                  ["Updated At", formatDateTime(row.updatedAt)],
                  [
                    "Reference Import",
                    `${batch.referenceImport.returnPeriod}, ${batch.referenceImport.financialYear}`,
                  ],
                  ["Batch Status", formatStatus(batch.status)],
                ]}
              />
            </DetailsSection>
          </div>
        ) : (
          <div className="p-5 text-sm text-slate-500">
            Select a failed invoice to view details.
          </div>
        )}
      </aside>
    </>
  );
}

function DetailsSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3 rounded-md border border-border bg-surface p-4">
        {children}
      </div>
    </section>
  );
}

function DefinitionList({ rows }: { rows: [string, string | null][] }) {
  return (
    <dl className="space-y-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 sm:grid-cols-[150px_1fr]">
          <dt className="text-slate-500">{label}</dt>
          <dd className="break-words font-medium text-foreground">
            {displayValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-md bg-error-surface px-2.5 py-1 text-xs font-medium text-error-foreground">
      {value}
    </span>
  );
}

function getIssues(row: ReconciliationRowDetails) {
  const details = getObject(row.mismatchDetails);
  const issues = row.mismatchCodes.map((code) => {
    const detail = getObject(details?.[code] ?? details?.[fieldKeyForCode(code)]);
    const message = getString(detail?.message);
    const uploaded = getString(detail?.uploaded);
    const reference = getString(detail?.reference);

    return {
      title: mismatchLabels[code] ?? formatStatus(code),
      description:
        message ??
        (uploaded || reference
          ? `Purchase Register ${displayValue(uploaded)} differs from GSTR-2B ${displayValue(reference)}.`
          : null),
    };
  });

  if (row.errorCode || row.errorMessage) {
    return [
      {
        title: row.errorCode ? formatStatus(row.errorCode) : "Processing error",
        description: row.errorMessage,
      },
      ...issues,
    ];
  }

  if (issues.length > 0) {
    return issues;
  }

  if (row.reconciliationResult === "UNMATCHED") {
    return [
      {
        title: "GSTR-2B reference not found",
        description: "No matching GSTR-2B reference invoice was found.",
      },
    ];
  }

  return [
    {
      title: formatStatus(row.reconciliationResult),
      description: "No additional failure details were recorded for this row.",
    },
  ];
}

function isFieldDifferent(
  row: ReconciliationRowDetails,
  field: (typeof comparisonFields)[number],
) {
  if (!row.matchedReference) {
    return row.mismatchCodes.includes("REFERENCE_NOT_FOUND");
  }

  return row.mismatchCodes.some((code) => mismatchFields[code] === field);
}

function fieldKeyForCode(code: string) {
  const field = mismatchFields[code];
  return typeof field === "string" ? field : code;
}

function formatFieldValue(field: string, value: string | null | undefined) {
  if (field === "invoiceDate") {
    return formatDate(value ?? null);
  }

  if (moneyFields.has(field)) {
    return formatMoney(value ?? null);
  }

  return displayValue(value ?? null);
}

function formatMoney(value: string | null) {
  if (!value) {
    return "—";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(numericValue);
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function displayValue(value: string | null | undefined) {
  return value && value.length > 0 ? value : "—";
}

function getObject(value: JsonValue | undefined) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value;
  }

  return null;
}

function getString(value: JsonValue | undefined) {
  return typeof value === "string" ? value : null;
}
