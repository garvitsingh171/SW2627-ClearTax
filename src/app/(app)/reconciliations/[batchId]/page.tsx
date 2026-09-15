import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";
import PageContainer from "@/components/layout/PageContainer";
import Card from "@/components/ui/Card";
import { isUuid } from "@/lib/ids";
import type {
  ReconciliationResult,
  UploadBatchStatus,
} from "@/generated/prisma/client";
import BatchControls from "@/components/batch/BatchControls";

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

const resultStyles: Record<ReconciliationResult, string> = {
  PENDING: "bg-surface-muted text-slate-700",
  MATCHED: "bg-success-surface text-success-foreground",
  MISMATCHED: "bg-warning-surface text-warning-foreground",
  UNMATCHED: "bg-warning-surface text-warning-foreground",
  ERROR: "bg-error-surface text-error-foreground",
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
      rowNumber: true,
      invoiceNumber: true,
      supplierGstin: true,
      reconciliationResult: true,
      errorMessage: true,
      mismatchCodes: true,
      matchedReference: {
        select: {
          invoiceNumber: true,
        },
      },
    },
    take: 50,
  });

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

        {resultRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Row</th>
                  <th className="px-5 py-3 font-medium">Invoice</th>
                  <th className="px-5 py-3 font-medium">Supplier GSTIN</th>
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-5 py-3 font-medium">Result</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {resultRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-4 text-slate-600">
                      {row.rowNumber}
                    </td>
                    <td className="px-5 py-4 font-medium text-foreground">
                      {row.invoiceNumber ?? "Not available"}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">
                      {row.supplierGstin ?? "Not available"}
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
                    <td className="max-w-[280px] px-5 py-4 text-slate-600">
                      {row.errorMessage ??
                        (row.mismatchCodes.join(", ") ||
                          "All compared fields matched")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 text-sm text-slate-500">
            No reconciliation rows have been persisted for this batch yet.
          </div>
        )}
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
