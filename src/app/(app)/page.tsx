import UploadProgress from "@/components/upload/UploadProgress";
import Link from "next/link";
import { connection } from "next/server";
import PageContainer from "@/components/layout/PageContainer";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { requireCurrentUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

import type {
  Prisma,
  ReferenceImportStatus,
  UploadBatchStatus,
} from "@/generated/prisma/client";

type RecentBatch = Prisma.UploadBatchGetPayload<{
  select: {
    id: true;
    originalFilename: true;
    status: true;
    totalRows: true;
    matchedRows: true;
    mismatchedRows: true;
    errorRows: true;
    createdAt: true;
    business: {
      select: {
        gstin: true;
      };
    };
    referenceImport: {
      select: {
        financialYear: true;
        returnPeriod: true;
      };
    };
  };
}>;

type RecentImport = Prisma.ReferenceImportGetPayload<{
  select: {
    id: true;
    originalFilename: true;
    status: true;
    totalDocuments: true;
    importedDocuments: true;
    createdAt: true;
    business: {
      select: {
        gstin: true;
      };
    };
    financialYear: true;
    returnPeriod: true;
  };
}>;

const uploadStatusStyles: Record<UploadBatchStatus, string> = {
  QUEUED: "status-neutral",
  PROCESSING: "status-info",
  COMPLETED: "status-success",
  COMPLETED_WITH_ERRORS: "status-warning",
  FAILED: "status-error",
};

const importStatusStyles: Record<ReferenceImportStatus, string> = {
  QUEUED: "status-neutral",
  PROCESSING: "status-info",
  READY: "status-success",
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

export default async function DashboardPage() {
  await connection();

  const user = await requireCurrentUser();
  const prisma = getPrismaClient();

  let dashboardDataError = false;
  let totalUploads = 0;
  let processingUploads = 0;
  let completedUploads = 0;
  let needsAttentionUploads = 0;
  let recentBatches: RecentBatch[] = [];
  let recentImports: RecentImport[] = [];

  try {
    totalUploads = await prisma.uploadBatch.count({
      where: {
        businessId: user.businessId,
      },
    });

    processingUploads = await prisma.uploadBatch.count({
      where: {
        businessId: user.businessId,
        status: {
          in: ["QUEUED", "PROCESSING"],
        },
      },
    });

    completedUploads = await prisma.uploadBatch.count({
      where: {
        businessId: user.businessId,
        status: "COMPLETED",
      },
    });

    needsAttentionUploads = await prisma.uploadBatch.count({
      where: {
        businessId: user.businessId,
        OR: [
          {
            status: {
              in: ["COMPLETED_WITH_ERRORS", "FAILED"],
            },
          },
          {
            mismatchedRows: {
              gt: 0,
            },
          },
          {
            errorRows: {
              gt: 0,
            },
          },
        ],
      },
    });

    recentBatches = await prisma.uploadBatch.findMany({
      where: {
        businessId: user.businessId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        originalFilename: true,
        status: true,
        totalRows: true,
        matchedRows: true,
        mismatchedRows: true,
        errorRows: true,
        createdAt: true,
        business: {
          select: {
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
      take: 5,
    });

    recentImports = await prisma.referenceImport.findMany({
      where: {
        businessId: user.businessId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        originalFilename: true,
        status: true,
        totalDocuments: true,
        importedDocuments: true,
        createdAt: true,
        business: {
          select: {
            gstin: true,
          },
        },
        financialYear: true,
        returnPeriod: true,
      },
      take: 5,
    });
  } catch {
    dashboardDataError = true;
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operations overview"
        title="Good morning, your workspace is ready"
        description="Monitor imports and reconciliation batches from one place."
        actions={<Link href="/reconciliations" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-hover active:translate-y-px"><Icon name="activity" size={16} /> View history</Link>}
      />
      <UploadProgress
        referenceImports={recentImports.map((referenceImport) => ({
          id: referenceImport.id,
          originalFilename: referenceImport.originalFilename,
          financialYear: referenceImport.financialYear,
          returnPeriod: referenceImport.returnPeriod,
          status: referenceImport.status,
        }))}
      />

      {dashboardDataError ? (
        <Card className="mt-6 border-warning bg-warning-surface p-5">
          <p className="text-sm font-medium text-warning-foreground">
            Dashboard data is temporarily unavailable.
          </p>

          <p className="mt-1 text-sm text-warning-foreground">
            The workspace is still available while the database connection
            recovers.
          </p>
        </Card>
      ) : null}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total uploads" value={totalUploads} detail="All purchase registers" icon={<Icon name="file" size={17} />} tone="blue" />
        <StatCard label="In progress" value={processingUploads} detail="Queued or processing" icon={<Icon name="activity" size={17} />} tone="amber" />
        <StatCard label="Completed" value={completedUploads} detail="Ready to review" icon={<Icon name="check" size={17} />} tone="green" />
        <StatCard label="Needs attention" value={needsAttentionUploads} detail="Errors or mismatches" icon={<Icon name="warning" size={17} />} tone="red" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-bold text-foreground">
                Recent Reconciliation Batches
              </h2>

              <Link
                href="/reconciliations"
                className="text-sm font-medium text-primary hover:text-primary-hover"
              >
                View all
              </Link>
            </div>
          </div>

          {recentBatches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-surface-muted/70 text-[11px] uppercase tracking-[.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">File</th>
                    <th className="px-5 py-3 font-medium">GSTIN</th>
                    <th className="px-5 py-3 font-medium">Period</th>
                    <th className="px-5 py-3 font-medium">Rows</th>
                    <th className="px-5 py-3 font-medium">Result</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {recentBatches.map((batch) => (
                    <tr key={batch.id} className="transition-colors hover:bg-surface-muted/50">
                      <td className="px-5 py-4">
                        <Link
                          href={`/reconciliations/${batch.id}`}
                          className="font-medium text-primary hover:text-primary-hover"
                        >
                          {batch.originalFilename}
                        </Link>
                        <p className="mt-1 font-mono text-xs text-slate-500">
                          {formatDate(batch.createdAt)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {batch.business.gstin}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {batch.referenceImport.returnPeriod},{" "}
                        {batch.referenceImport.financialYear}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {batch.totalRows}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {batch.matchedRows} matched / {batch.mismatchedRows}{" "}
                        mismatched / {batch.errorRows} errors
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`status-badge ${uploadStatusStyles[batch.status]}`}
                        ><span className="sr-only">Status: </span>{formatStatus(batch.status)}</span>
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

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-bold text-foreground">
                Reference Imports
              </h2>

              <Link
                href="/reference-imports"
                className="text-sm font-medium text-primary hover:text-primary-hover"
              >
                View all
              </Link>
            </div>
          </div>

          {recentImports.length > 0 ? (
            <div className="divide-y divide-border">
              {recentImports.map((referenceImport) => (
                <div key={referenceImport.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/reference-imports/${referenceImport.id}`}
                        className="font-medium text-primary hover:text-primary-hover"
                      >
                        {referenceImport.originalFilename}
                      </Link>

                      <p className="mt-1 text-sm text-slate-500">
                        {referenceImport.business.gstin},{" "}
                        {referenceImport.returnPeriod},{" "}
                        {referenceImport.financialYear}
                      </p>
                    </div>

                    <span
                      className={`status-badge shrink-0 ${importStatusStyles[referenceImport.status]}`}
                    >
                      {formatStatus(referenceImport.status)}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-600">
                    {referenceImport.importedDocuments} imported from{" "}
                    {referenceImport.totalDocuments} documents
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-5 text-sm text-slate-500">
              No reference imports have been persisted yet.
            </p>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
