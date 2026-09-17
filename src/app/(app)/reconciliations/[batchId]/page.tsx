import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";
import PageContainer from "@/components/layout/PageContainer";
import Card from "@/components/ui/Card";
import { isUuid } from "@/lib/ids";
import type { UploadBatchStatus } from "@/generated/prisma/client";
import BatchControls from "@/components/batch/BatchControls";
import ReconciliationResultsTable from "@/components/reconciliation/ReconciliationResultsTable";
import type {
  JsonValue,
  ReconciliationBatchDetails,
  ReconciliationRowDetails,
} from "@/components/reconciliation/types";

type ReconciliationBatchPageProps = {
  params: Promise<{
    batchId: string;
  }>;
};

const statusStyles: Record<UploadBatchStatus, string> = {
  QUEUED: "bg-surface-muted text-slate-700",
  PROCESSING: "bg-info-surface text-info-foreground",
  COMPLETED: "bg-success-surface text-success-foreground",
  COMPLETED_WITH_ERRORS: "bg-warning-surface text-warning-foreground",
  FAILED: "bg-error-surface text-error-foreground",
};

function formatDate(value: Date | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function ReconciliationBatchPage({
  params,
}: ReconciliationBatchPageProps) {
  const { batchId } = await params;

  if (!isUuid(batchId)) {
    notFound();
  }

  // Reconciliation batches may continue processing in the background, so read
  // persisted counters and status at request time instead of during prerender.

  const user = await requireCurrentUser();
  const prisma = getPrismaClient();

  const batch = await prisma.uploadBatch.findFirst({
    where: {
      id: batchId,
      businessId: user.businessId,
    },
    select: {
      id: true,
      originalFilename: true,
      status: true,
      totalRows: true,
      processedRows: true,
      matchedRows: true,
      mismatchedRows: true,
      errorRows: true,
      fileErrorMessage: true,
      createdAt: true,
      updatedAt: true,
      startedAt: true,
      completedAt: true,
      business: {
        select: {
          legalName: true,
          gstin: true,
        },
      },
      referenceImport: {
        select: {
          id: true,
          financialYear: true,
          returnPeriod: true,
          status: true,
        },
      },
      _count: {
        select: {
          rows: true,
        },
      },
    },
  });

  if (!batch) {
    notFound();
  }

  const resultRows = await prisma.reconciliationRow.findMany({
    where: {
      batchId: batch.id,
    },
    orderBy: {
      rowNumber: "asc",
    },
    select: {
      id: true,
      batchId: true,
      rowNumber: true,
      rawData: true,
      invoiceNumber: true,
      normalizedInvoiceNumber: true,
      supplierGstin: true,
      invoiceDate: true,
      taxableValue: true,
      igstAmount: true,
      cgstAmount: true,
      sgstAmount: true,
      cessAmount: true,
      totalInvoiceValue: true,
      processingStatus: true,
      reconciliationResult: true,
      errorCode: true,
      errorMessage: true,
      matchedReferenceId: true,
      mismatchCodes: true,
      mismatchDetails: true,
      createdAt: true,
      updatedAt: true,
      processedAt: true,
      matchedReference: {
        select: {
          id: true,
          supplierGstin: true,
          invoiceNumber: true,
          normalizedInvoiceNumber: true,
          invoiceDate: true,
          taxableValue: true,
          igstAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          cessAmount: true,
          totalInvoiceValue: true,
        },
      },
    },
    take: 50,
  });

  const serializedBatch: ReconciliationBatchDetails = {
    id: batch.id,
    originalFilename: batch.originalFilename,
    status: batch.status,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
    startedAt: dateToIsoString(batch.startedAt),
    completedAt: dateToIsoString(batch.completedAt),
    referenceImport: {
      id: batch.referenceImport.id,
      financialYear: batch.referenceImport.financialYear,
      returnPeriod: batch.referenceImport.returnPeriod,
      status: batch.referenceImport.status,
    },
  };

  const serializedRows: ReconciliationRowDetails[] = resultRows.map((row) => ({
    id: row.id,
    batchId: row.batchId,
    rowNumber: row.rowNumber,
    rawData: toJsonValue(row.rawData),
    invoiceNumber: row.invoiceNumber,
    normalizedInvoiceNumber: row.normalizedInvoiceNumber,
    supplierGstin: row.supplierGstin,
    invoiceDate: dateToIsoString(row.invoiceDate),
    taxableValue: decimalToString(row.taxableValue),
    igstAmount: decimalToString(row.igstAmount),
    cgstAmount: decimalToString(row.cgstAmount),
    sgstAmount: decimalToString(row.sgstAmount),
    cessAmount: decimalToString(row.cessAmount),
    totalInvoiceValue: decimalToString(row.totalInvoiceValue),
    processingStatus: row.processingStatus,
    reconciliationResult: row.reconciliationResult,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    matchedReferenceId: row.matchedReferenceId,
    mismatchCodes: row.mismatchCodes,
    mismatchDetails: toJsonValue(row.mismatchDetails),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    processedAt: dateToIsoString(row.processedAt),
    matchedReference: row.matchedReference
      ? {
          id: row.matchedReference.id,
          supplierGstin: row.matchedReference.supplierGstin,
          invoiceNumber: row.matchedReference.invoiceNumber,
          normalizedInvoiceNumber:
            row.matchedReference.normalizedInvoiceNumber,
          invoiceDate: row.matchedReference.invoiceDate.toISOString(),
          taxableValue: decimalToString(row.matchedReference.taxableValue) ?? "",
          igstAmount: decimalToString(row.matchedReference.igstAmount) ?? "",
          cgstAmount: decimalToString(row.matchedReference.cgstAmount) ?? "",
          sgstAmount: decimalToString(row.matchedReference.sgstAmount) ?? "",
          cessAmount: decimalToString(row.matchedReference.cessAmount) ?? "",
          totalInvoiceValue:
            decimalToString(row.matchedReference.totalInvoiceValue) ?? "",
        }
      : null,
  }));

  const summaryItems = [
    ["Total rows", batch.totalRows],
    ["Processed", batch.processedRows],
    ["Matched", batch.matchedRows],
    ["Mismatched", batch.mismatchedRows],
    ["Errors", batch.errorRows],
    ["Persisted rows", batch._count.rows],
  ];

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Reconciliation Batch
          </p>

          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            {batch.originalFilename}
          </h1>

          <p className="mt-2 break-all font-mono text-xs text-slate-500">
            {batch.id}
          </p>
          <BatchControls
            batchId={batch.id}
            status={formatStatus(batch.status)}
          />
        </div>

        <span
          className={`inline-flex w-fit items-center rounded-md px-3 py-1.5 text-sm font-medium ${statusStyles[batch.status]}`}
        >
          {formatStatus(batch.status)}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaryItems.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="text-sm text-slate-500">{label}</p>

            <p className="mt-2 text-2xl font-semibold text-foreground">
              {value}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold text-foreground">
            Batch Details
          </h2>

          <dl className="mt-4 space-y-3 text-sm">
            <DetailRow label="Business" value={batch.business.legalName} />
            <DetailRow label="GSTIN" value={batch.business.gstin} />
            <DetailRow label="Created" value={formatDate(batch.createdAt)} />
            <DetailRow label="Updated" value={formatDate(batch.updatedAt)} />
            <DetailRow label="Started" value={formatDate(batch.startedAt)} />
            <DetailRow
              label="Completed"
              value={formatDate(batch.completedAt)}
            />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-foreground">
            Reference Import
          </h2>

          <dl className="mt-4 space-y-3 text-sm">
            <DetailRow
              label="Financial year"
              value={batch.referenceImport.financialYear}
            />
            <DetailRow
              label="Return period"
              value={batch.referenceImport.returnPeriod}
            />
            <DetailRow
              label="Import status"
              value={formatStatus(batch.referenceImport.status)}
            />
          </dl>

          <Link
            href={`/reference-imports/${batch.referenceImport.id}`}
            className="mt-5 inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            Open reference import
          </Link>
        </Card>
      </div>

      {batch.fileErrorMessage ? (
        <Card className="mt-6 border-error bg-error-surface p-5">
          <h2 className="font-semibold text-error-foreground">
            File Error
          </h2>

          <p className="mt-2 text-sm text-error-foreground">
            {batch.fileErrorMessage}
          </p>
        </Card>
      ) : null}

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-border p-5">
          <h2 className="font-semibold text-foreground">
            Reconciliation Results
          </h2>
        </div>

        <ReconciliationResultsTable
          rows={serializedRows}
          batch={serializedBatch}
        />
      </Card>
    </PageContainer>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-words font-medium text-foreground">{value}</dd>
    </div>
  );
}

function dateToIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

function decimalToString(value: { toString(): string } | null) {
  return value ? value.toString() : null;
}

function toJsonValue(value: unknown): JsonValue | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        toJsonValue(item),
      ]),
    );
  }

  return null;
}
