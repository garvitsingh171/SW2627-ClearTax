import Link from "next/link";
import { connection } from "next/server";
import PageContainer from "@/components/layout/PageContainer";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/ui/Icon";
import { requireCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getPrismaClient, withDatabaseRetry } from "@/lib/prisma";
import type { UploadBatchStatus } from "@/generated/prisma/client";

const statusStyles: Record<UploadBatchStatus, string> = {
  QUEUED: "status-neutral",
  PROCESSING: "status-info",
  COMPLETED: "status-success",
  COMPLETED_WITH_ERRORS: "status-warning",
  FAILED: "status-error",
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

export default async function ReconciliationsPage() {
  // Reconciliation progress is persisted and may change after upload, so this
  // page must render from the latest database state on each request.
  await connection();

  const user = await requireCurrentUser();
  const prisma = getPrismaClient();

  let batches: Awaited<ReturnType<typeof loadReconciliationBatches>> = [];
  let batchesError = false;

  try {
    batches = await withDatabaseRetry(() =>
      loadReconciliationBatches(prisma, user.businessId),
    );
  } catch (error) {
    batchesError = true;
    logger.error(
      {
        event: "reconciliation_batches.page_load_failed",
        err: error,
      },
      "Failed to load reconciliation batches",
    );
  }

  return (
    <PageContainer>
      <PageHeader eyebrow="Workspace" title="Reconciliation history" description="Every purchase register upload, its current state, and the results available for review." actions={<Link href="/" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted"><Icon name="arrow-right" size={15} className="rotate-180" /> Dashboard</Link>} />

      {batchesError ? (
        <Card className="mt-6 border-warning bg-warning-surface p-5">
          <h2 className="text-base font-semibold text-warning-foreground">
            Reconciliation history is temporarily unavailable
          </h2>
          <p className="mt-2 text-sm text-warning-foreground">
            The database connection timed out while loading upload batches.
            Please refresh in a moment.
          </p>
        </Card>
      ) : (
        <Card className="mt-7 overflow-hidden">
          {batches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-surface-muted/70 text-[11px] uppercase tracking-[.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">File</th>
                    <th className="px-5 py-3 font-medium">Business</th>
                    <th className="px-5 py-3 font-medium">Return Period</th>
                    <th className="px-5 py-3 font-medium">Uploaded</th>
                    <th className="px-5 py-3 font-medium">Rows</th>
                    <th className="px-5 py-3 font-medium">Result</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-surface-muted/50">
                      <td className="px-5 py-4">
                        <Link
                          href={`/reconciliations/${batch.id}`}
                          className="font-medium text-primary hover:text-primary-hover"
                        >
                          {batch.originalFilename}
                        </Link>
                        <p className="mt-1 break-all font-mono text-xs text-slate-500">
                          {batch.id}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <p className="font-medium text-foreground">
                          {batch.business.legalName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {batch.business.gstin}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {batch.referenceImport.returnPeriod},{" "}
                        {batch.referenceImport.financialYear}
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {formatDate(batch.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {batch.processedRows} / {batch.totalRows}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {batch.matchedRows} matched / {batch.mismatchedRows}{" "}
                        mismatched / {batch.errorRows} errors
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`status-badge ${statusStyles[batch.status]}`}
                        >
                          {formatStatus(batch.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-5 text-sm text-slate-500">
              No reconciliation batches have been persisted yet.
            </p>
          )}
        </Card>
      )}
    </PageContainer>
  );
}

function loadReconciliationBatches(
  prisma: ReturnType<typeof getPrismaClient>,
  businessId: string,
) {
  return prisma.uploadBatch.findMany({
    where: {
      businessId,
    },
    orderBy: {
      createdAt: "desc",
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
      createdAt: true,
      business: {
        select: {
          legalName: true,
          gstin: true,
        },
      },
      referenceImport: {
        select: {
          financialYear: true,
          returnPeriod: true,
        },
      },
    },
    take: 25,
  });
}
