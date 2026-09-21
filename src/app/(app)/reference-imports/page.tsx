import Link from "next/link";
import { connection } from "next/server";
import PageContainer from "@/components/layout/PageContainer";
import Card from "@/components/ui/Card";
import { requireCurrentUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";
import type { ReferenceImportStatus } from "@/generated/prisma/client";
import ReferenceImportSetupForm from "@/components/reference-imports/ReferenceImportSetupForm";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/ui/Icon";

const statusStyles: Record<ReferenceImportStatus, string> = {
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

export default async function ReferenceImportsPage() {
  await connection();

  const user = await requireCurrentUser();
  const prisma = getPrismaClient();

  const referenceImports = await prisma.referenceImport.findMany({
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
      financialYear: true,
      returnPeriod: true,
      totalDocuments: true,
      importedDocuments: true,
      skippedDocuments: true,
      failedDocuments: true,
      isActive: true,
      createdAt: true,
      business: {
        select: {
          legalName: true,
          gstin: true,
        },
      },
      _count: {
        select: {
          invoices: true,
          uploadBatches: true,
        },
      },
    },
    take: 25,
  });

  return (
    <PageContainer>
      <PageHeader eyebrow="Workspace" title="Reference imports" description="Manage the GSTR-2B datasets that power reconciliation matching." actions={<Link href="/" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted"><Icon name="arrow-right" size={15} className="rotate-180" /> Dashboard</Link>} />
      <ReferenceImportSetupForm />

      <Card className="mt-7 overflow-hidden">
        {referenceImports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="bg-surface-muted/70 text-[11px] uppercase tracking-[.08em] text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Import</th>
                  <th className="px-5 py-3 font-medium">Business</th>
                  <th className="px-5 py-3 font-medium">Return Period</th>
                  <th className="px-5 py-3 font-medium">Documents</th>
                  <th className="px-5 py-3 font-medium">Linked Batches</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {referenceImports.map((referenceImport) => (
                  <tr
                    key={referenceImport.id}
                    className="hover:bg-surface-muted/50"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/reference-imports/${referenceImport.id}`}
                        className="font-medium text-primary hover:text-primary-hover"
                      >
                        {referenceImport.originalFilename}
                      </Link>
                      <p className="mt-1 break-all font-mono text-xs text-slate-500">
                        {referenceImport.id}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <p className="font-medium text-foreground">
                        {referenceImport.business.legalName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {referenceImport.business.gstin}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {referenceImport.returnPeriod},{" "}
                      {referenceImport.financialYear}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {referenceImport.importedDocuments} imported /{" "}
                      {referenceImport.skippedDocuments} skipped /{" "}
                      {referenceImport.failedDocuments} failed
                      <p className="mt-1 text-xs text-slate-500">
                        {referenceImport._count.invoices} persisted from{" "}
                        {referenceImport.totalDocuments} documents
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {referenceImport._count.uploadBatches}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {formatDate(referenceImport.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`status-badge ${statusStyles[referenceImport.status]}`}
                      >
                        {formatStatus(referenceImport.status)}
                      </span>

                      {referenceImport.isActive ? (
                        <p className="mt-2 text-xs font-medium text-success-foreground">
                          Active
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-5 text-sm text-slate-500">
            No reference imports have been persisted yet.
          </p>
        )}
      </Card>
    </PageContainer>
  );
}
