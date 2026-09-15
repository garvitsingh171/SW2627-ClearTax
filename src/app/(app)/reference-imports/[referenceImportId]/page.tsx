import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import PageContainer from "@/components/layout/PageContainer";
import Card from "@/components/ui/Card";
import { requireCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { getPrismaClient } from "@/lib/prisma";
import type { ReferenceImportStatus } from "@/generated/prisma/client";

type ReferenceImportPageProps = {
  params: Promise<{
    referenceImportId: string;
  }>;
};

const statusStyles: Record<ReferenceImportStatus, string> = {
  QUEUED: "bg-surface-muted text-slate-700",
  PROCESSING: "bg-info-surface text-info-foreground",
  READY: "bg-success-surface text-success-foreground",
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

export default async function ReferenceImportPage({
  params,
}: ReferenceImportPageProps) {
  const { referenceImportId } = await params;

  if (!isUuid(referenceImportId)) {
    notFound();
  }

  await connection();

  const user = await requireCurrentUser();

  if (!isUuid(user.businessId)) {
    notFound();
  }

  const prisma = getPrismaClient();

  const referenceImport = await prisma.referenceImport.findFirst({
    where: {
      id: referenceImportId,
      businessId: user.businessId,
    },
    select: {
      id: true,
      originalFilename: true,
      status: true,
      gstin: true,
      financialYear: true,
      returnPeriod: true,
      totalDocuments: true,
      importedDocuments: true,
      skippedDocuments: true,
      failedDocuments: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      startedAt: true,
      completedAt: true,
    },
  });

  if (!referenceImport) {
    notFound();
  }

  const business = await prisma.business.findUnique({
    where: {
      id: user.businessId,
    },
    select: {
      legalName: true,
      gstin: true,
    },
  });

  if (!business) {
    notFound();
  }

  const relatedData = await getReferenceImportRelatedData(
    prisma,
    referenceImport.id,
  );

  const summaryItems = [
    ["Total documents", referenceImport.totalDocuments],
    ["Imported", referenceImport.importedDocuments],
    ["Skipped", referenceImport.skippedDocuments],
    ["Failed", referenceImport.failedDocuments],
    ["Persisted invoices", relatedData.invoiceCount],
    ["Upload batches", relatedData.uploadBatchCount],
  ];

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Reference Import
          </p>

          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            {referenceImport.originalFilename}
          </h1>

          <p className="mt-2 break-all font-mono text-xs text-slate-500">
            {referenceImport.id}
          </p>
        </div>

        <span
          className={`inline-flex w-fit items-center rounded-md px-3 py-1.5 text-sm font-medium ${statusStyles[referenceImport.status]}`}
        >
          {formatStatus(referenceImport.status)}
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
            Import Details
          </h2>

          <dl className="mt-4 space-y-3 text-sm">
            <DetailRow
              label="Business"
              value={business.legalName}
            />
            <DetailRow
              label="Business GSTIN"
              value={business.gstin}
            />
            <DetailRow label="Import GSTIN" value={referenceImport.gstin} />
            <DetailRow
              label="Financial year"
              value={referenceImport.financialYear}
            />
            <DetailRow
              label="Return period"
              value={referenceImport.returnPeriod}
            />
            <DetailRow
              label="Active"
              value={referenceImport.isActive ? "Yes" : "No"}
            />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-foreground">
            Timeline
          </h2>

          <dl className="mt-4 space-y-3 text-sm">
            <DetailRow label="Created" value={formatDate(referenceImport.createdAt)} />
            <DetailRow label="Updated" value={formatDate(referenceImport.updatedAt)} />
            <DetailRow label="Started" value={formatDate(referenceImport.startedAt)} />
            <DetailRow
              label="Completed"
              value={formatDate(referenceImport.completedAt)}
            />
          </dl>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-border p-5">
          <h2 className="font-semibold text-foreground">
            Recent Reconciliation Batches
          </h2>
        </div>

        {relatedData.uploadBatches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Batch</th>
                  <th className="px-5 py-3 font-medium">File</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {relatedData.uploadBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-surface-muted/50">
                    <td className="px-5 py-4">
                      <Link
                        href={`/reconciliations/${batch.id}`}
                        className="break-all font-mono text-xs font-medium text-primary hover:text-primary-hover"
                      >
                        {batch.id}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {batch.originalFilename}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatStatus(batch.status)}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {formatDate(batch.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-5 text-sm text-slate-500">
            {relatedData.loadError
              ? "The import loaded, but linked batch summaries could not be loaded."
              : "No reconciliation batches have been linked to this import yet."}
          </p>
        )}
      </Card>
    </PageContainer>
  );
}

type PrismaClient = ReturnType<typeof getPrismaClient>;

async function getReferenceImportRelatedData(
  prisma: PrismaClient,
  referenceImportId: string,
) {
  try {
    const [uploadBatches, invoiceCount, uploadBatchCount] = await Promise.all([
      prisma.uploadBatch.findMany({
        where: {
          referenceImportId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          originalFilename: true,
          status: true,
          createdAt: true,
        },
        take: 5,
      }),
      prisma.referenceInvoice.count({
        where: {
          referenceImportId,
        },
      }),
      prisma.uploadBatch.count({
        where: {
          referenceImportId,
        },
      }),
    ]);

    return {
      uploadBatches,
      invoiceCount,
      uploadBatchCount,
      loadError: false,
    };
  } catch {
    return {
      uploadBatches: [],
      invoiceCount: 0,
      uploadBatchCount: 0,
      loadError: true,
    };
  }
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
