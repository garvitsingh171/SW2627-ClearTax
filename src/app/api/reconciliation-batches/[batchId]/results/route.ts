import {
  API_ERROR_CODES,
  apiError,
  handleApiError,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { requireApiUser } from "@/lib/api-auth";
import { getPrismaClient } from "@/lib/prisma";
import {
  completeApiRequest,
  createApiRequestLogContext,
  logUnauthorizedRequest,
} from "@/lib/request-logging";
import {
  batchRouteParamsSchema,
  reconciliationResultsQuerySchema,
} from "@/lib/validation/reconciliation";

type BatchResultsRouteContext = {
  params: Promise<{
    batchId: string;
  }>;
};

export const dynamic = "force-dynamic";

const resultSelect = {
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
} as const;

export async function GET(
  request: Request,
  { params }: BatchResultsRouteContext,
) {
  const requestContext = createApiRequestLogContext(
    request,
    "/api/reconciliation-batches/[batchId]/results",
  );
  const authResult = await requireApiUser();

  if (!authResult.success) {
    logUnauthorizedRequest(requestContext);
    return completeApiRequest(requestContext, authResult.response);
  }

  const paramsValidationResult = batchRouteParamsSchema.safeParse(await params);

  if (!paramsValidationResult.success) {
    return completeApiRequest(
      requestContext,
      validationErrorResponse(paramsValidationResult.error),
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const queryValidationResult = reconciliationResultsQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    result: searchParams.get("result") ?? undefined,
  });

  if (!queryValidationResult.success) {
    return completeApiRequest(
      requestContext,
      validationErrorResponse(queryValidationResult.error),
    );
  }

  const { batchId } = paramsValidationResult.data;
  const { cursor, limit, result } = queryValidationResult.data;

  try {
    const prisma = getPrismaClient();

    const batch = await prisma.uploadBatch.findFirst({
      where: {
        id: batchId,
        businessId: authResult.auth.businessId,
      },
      select: {
        id: true,
      },
    });

    if (!batch) {
      return completeApiRequest(
        requestContext,
        apiError(
          404,
          API_ERROR_CODES.BATCH_NOT_FOUND,
          "The requested reconciliation batch was not found.",
        ),
        {
          batchId,
        },
      );
    }

    if (cursor) {
      const cursorRow = await prisma.reconciliationRow.findFirst({
        where: {
          id: cursor,
          batchId,
        },
        select: {
          id: true,
        },
      });

      if (!cursorRow) {
        return completeApiRequest(
          requestContext,
          apiError(
            400,
            API_ERROR_CODES.VALIDATION_ERROR,
            "The requested cursor was not found for this reconciliation batch.",
          ),
          {
            batchId,
          },
        );
      }
    }

    const rowWhere = {
      batchId,
      ...(result ? { reconciliationResult: result } : {}),
    };

    const [rows, total] = await prisma.$transaction([
      prisma.reconciliationRow.findMany({
      where: {
        ...rowWhere,
      },
      orderBy: {
        id: "asc",
      },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: {
              id: cursor,
            },
            skip: 1,
          }
        : {}),
      select: resultSelect,
      }),
      prisma.reconciliationRow.count({ where: rowWhere }),
    ]);

    const hasMore = rows.length > limit;
    const results = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? results[results.length - 1]?.id : null;

    return completeApiRequest(
      requestContext,
      successResponse({
        results,
        pagination: {
          nextCursor,
          hasMore,
          total,
        },
      }),
      {
        batchId,
        resultCount: results.length,
        hasMore,
      },
    );
  } catch (error) {
    return handleApiError(requestContext, error, {
      batchId,
    });
  }
}
