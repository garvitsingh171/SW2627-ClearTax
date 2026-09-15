import {
  API_ERROR_CODES,
  apiError,
  handleApiError,
  parseJsonObject,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { requireApiUser } from "@/lib/api-auth";
import { getPrismaClient } from "@/lib/prisma";
import {
  completeApiRequest,
  createApiRequestLogContext,
  logUnauthorizedRequest,
  logUploadValidationFailed,
  type ApiRequestLogContext,
} from "@/lib/request-logging";
import {
  createOwnedReferenceImportSchema,
  referenceImportUploadFormSchema,
} from "@/lib/validation/reconciliation";
import {
  deriveFinancialYearFromReturnPeriod,
  getOptionalFormString,
  getRequiredUploadFile,
  isMultipartRequest,
  JSON_UPLOAD_EXTENSIONS,
  JSON_UPLOAD_MIME_TYPES,
  parseMultipartFormData,
  parseGstr2bJson,
  readValidatedTextFile,
  type UploadValidationError,
} from "@/lib/upload-validation";
import { revalidatePath } from "next/cache";

type ApiAuthContext = {
  userId: string;
  businessId: string;
};

export const dynamic = "force-dynamic";

const referenceImportSelect = {
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
} as const;

export async function GET(request: Request) {
  const requestContext = createApiRequestLogContext(
    request,
    "/api/reference-imports",
  );
  const authResult = await requireApiUser();

  if (!authResult.success) {
    logUnauthorizedRequest(requestContext);
    return completeApiRequest(requestContext, authResult.response);
  }

  try {
    const prisma = getPrismaClient();

    const referenceImports = await prisma.referenceImport.findMany({
      where: {
        businessId: authResult.auth.businessId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: referenceImportSelect,
      take: 25,
    });

    return completeApiRequest(
      requestContext,
      successResponse(referenceImports),
      {
        resultCount: referenceImports.length,
      },
    );
  } catch (error) {
    return handleApiError(requestContext, error);
  }
}

export async function POST(request: Request) {
  const requestContext = createApiRequestLogContext(
    request,
    "/api/reference-imports",
  );
  const authResult = await requireApiUser();

  if (!authResult.success) {
    logUnauthorizedRequest(requestContext);
    return completeApiRequest(requestContext, authResult.response);
  }

  if (isMultipartRequest(request)) {
    return createReferenceImportFromUpload(
      request,
      authResult.auth,
      requestContext,
    );
  }

  const parsedBody = await parseJsonObject(request);

  if (!parsedBody.success) {
    return completeApiRequest(requestContext, parsedBody.response);
  }

  const validationResult = createOwnedReferenceImportSchema.safeParse(
    parsedBody.body,
  );

  if (!validationResult.success) {
    return completeApiRequest(
      requestContext,
      validationErrorResponse(validationResult.error),
    );
  }

  const {
    gstin,
    financialYear,
    returnPeriod,
    originalFilename,
    storageObjectKey,
  } = validationResult.data;

  try {
    const prisma = getPrismaClient();
    requestContext.logger.info(
      {
        event: "reference_import.started",
        importType: "gstr2b",
      },
      "Reference import creation started",
    );

    const business = await prisma.business.findFirst({
      where: {
        id: authResult.auth.businessId,
        ownerId: authResult.auth.userId,
      },
      select: {
        id: true,
      },
    });

    if (!business) {
      return completeApiRequest(
        requestContext,
        apiError(
          404,
          API_ERROR_CODES.NOT_FOUND,
          "The requested business was not found.",
        ),
      );
    }

    const referenceImport = await prisma.referenceImport.create({
      data: {
        businessId: business.id,
        gstin,
        financialYear,
        returnPeriod,
        originalFilename,
        ...(storageObjectKey ? { storageObjectKey } : {}),
      },
      select: referenceImportSelect,
    });

    revalidatePath("/");
    revalidatePath("/reference-imports");

    requestContext.logger.info(
      {
        event: "reference_import.completed",
        importId: referenceImport.id,
        importType: "gstr2b",
      },
      "Reference import created",
    );

    return completeApiRequest(
      requestContext,
      successResponse(referenceImport, {
        status: 201,
      }),
      {
        importId: referenceImport.id,
      },
    );
  } catch (error) {
    return handleApiError(requestContext, error);
  }
}

async function createReferenceImportFromUpload(
  request: Request,
  auth: ApiAuthContext,
  requestContext: ApiRequestLogContext,
) {
  requestContext.logger.info(
    {
      event: "reference_import.started",
      importType: "gstr2b",
      uploadType: "multipart",
    },
    "Reference import upload started",
  );

  const formDataResult = await parseMultipartFormData(request);

  if (!formDataResult.success) {
    return completeApiRequest(
      requestContext,
      uploadErrorResponse(requestContext, formDataResult.error, "gstr2b"),
    );
  }

  const fileResult = getRequiredUploadFile(formDataResult.data);

  if (!fileResult.success) {
    return completeApiRequest(
      requestContext,
      uploadErrorResponse(requestContext, fileResult.error, "gstr2b"),
    );
  }

  requestContext.logger.info(
    {
      event: "upload.received",
      importType: "gstr2b",
      fileType: fileResult.data.type || null,
      fileSize: fileResult.data.size,
    },
    "Upload received",
  );

  const fileResultData = await readValidatedTextFile(fileResult.data, {
    acceptedExtensions: JSON_UPLOAD_EXTENSIONS,
    acceptedMimeTypes: JSON_UPLOAD_MIME_TYPES,
    fileKind: "GSTR-2B JSON",
  });

  if (!fileResultData.success) {
    return completeApiRequest(
      requestContext,
      uploadErrorResponse(requestContext, fileResultData.error, "gstr2b"),
    );
  }

  const gstr2bValidationResult = parseGstr2bJson(fileResultData.data.text);

  if (!gstr2bValidationResult.success) {
    return completeApiRequest(
      requestContext,
      uploadErrorResponse(
        requestContext,
        gstr2bValidationResult.error,
        "gstr2b",
      ),
    );
  }

  requestContext.logger.info(
    {
      event: "upload.validation_succeeded",
      importType: "gstr2b",
      fileType: fileResultData.data.contentType,
      fileSize: fileResult.data.size,
      documentCount: gstr2bValidationResult.data.totalDocuments,
    },
    "Upload validation succeeded",
  );

  const formValidationResult = referenceImportUploadFormSchema.safeParse({
    financialYear: getOptionalFormString(formDataResult.data, "financialYear"),
    returnPeriod: getOptionalFormString(formDataResult.data, "returnPeriod"),
  });

  if (!formValidationResult.success) {
    logUploadValidationFailed(requestContext.logger, {
      importType: "gstr2b",
      reason: "invalid_form_fields",
    });
    return completeApiRequest(
      requestContext,
      validationErrorResponse(formValidationResult.error),
    );
  }

  const prisma = getPrismaClient();

  try {
    const business = await prisma.business.findFirst({
      where: {
        id: auth.businessId,
        ownerId: auth.userId,
      },
      select: {
        id: true,
        gstin: true,
      },
    });

    if (!business) {
      return completeApiRequest(
        requestContext,
        apiError(
          404,
          API_ERROR_CODES.NOT_FOUND,
          "The requested business was not found.",
        ),
      );
    }

    const uploadedGstin = gstr2bValidationResult.data.gstin.toUpperCase();

    if (uploadedGstin !== business.gstin.toUpperCase()) {
      logUploadValidationFailed(requestContext.logger, {
        importType: "gstr2b",
        reason: "gstin_mismatch",
      });
      return completeApiRequest(
        requestContext,
        apiError(
          400,
          API_ERROR_CODES.INVALID_FILE,
          "Uploaded GSTR-2B GSTIN does not match the authenticated business.",
        ),
      );
    }

    const formReturnPeriod = formValidationResult.data.returnPeriod;
    const uploadedReturnPeriod = gstr2bValidationResult.data.returnPeriod;

    if (
      formReturnPeriod &&
      uploadedReturnPeriod &&
      formReturnPeriod !== uploadedReturnPeriod
    ) {
      logUploadValidationFailed(requestContext.logger, {
        importType: "gstr2b",
        reason: "return_period_mismatch",
      });
      return completeApiRequest(
        requestContext,
        apiError(
          400,
          API_ERROR_CODES.INVALID_FILE,
          "Uploaded GSTR-2B return period does not match the submitted return period.",
        ),
      );
    }

    const returnPeriod = uploadedReturnPeriod ?? formReturnPeriod;

    if (!returnPeriod) {
      logUploadValidationFailed(requestContext.logger, {
        importType: "gstr2b",
        reason: "missing_return_period",
      });
      return completeApiRequest(
        requestContext,
        apiError(
          400,
          API_ERROR_CODES.INVALID_FILE,
          "GSTR-2B return period is required.",
        ),
      );
    }

    const derivedFinancialYear =
      deriveFinancialYearFromReturnPeriod(returnPeriod);
    const financialYear =
      derivedFinancialYear ?? formValidationResult.data.financialYear;

    if (!financialYear) {
      logUploadValidationFailed(requestContext.logger, {
        importType: "gstr2b",
        reason: "missing_financial_year",
      });
      return completeApiRequest(
        requestContext,
        apiError(
          400,
          API_ERROR_CODES.VALIDATION_ERROR,
          "The request contains invalid fields.",
          {
            financialYear: [
              "financialYear is required when returnPeriod is not in MMYYYY format.",
            ],
          },
        ),
      );
    }

    const now = new Date();
    const referenceImport = await prisma.$transaction(async (transaction) => {
      await transaction.referenceImport.updateMany({
        where: {
          businessId: business.id,
          gstin: business.gstin,
          financialYear,
          returnPeriod,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      const createdImport = await transaction.referenceImport.create({
        data: {
          businessId: business.id,
          gstin: business.gstin,
          financialYear,
          returnPeriod,
          originalFilename: fileResultData.data.originalFilename,
          status: "READY",
          totalDocuments: gstr2bValidationResult.data.totalDocuments,
          importedDocuments: gstr2bValidationResult.data.invoices.length,
          skippedDocuments: 0,
          failedDocuments: 0,
          isActive: true,
          startedAt: now,
          completedAt: now,
        },
        select: {
          id: true,
        },
      });

      await transaction.referenceInvoice.createMany({
        data: gstr2bValidationResult.data.invoices.map((invoice) => ({
          referenceImportId: createdImport.id,
          supplierGstin: invoice.supplierGstin,
          invoiceNumber: invoice.invoiceNumber,
          normalizedInvoiceNumber: invoice.normalizedInvoiceNumber,
          invoiceDate: invoice.invoiceDate,
          taxableValue: invoice.taxableValue,
          igstAmount: invoice.igstAmount,
          cgstAmount: invoice.cgstAmount,
          sgstAmount: invoice.sgstAmount,
          cessAmount: invoice.cessAmount,
          totalInvoiceValue: invoice.totalInvoiceValue,
        })),
      });

      return transaction.referenceImport.findUniqueOrThrow({
        where: {
          id: createdImport.id,
        },
        select: referenceImportSelect,
      });
    });

    revalidatePath("/");
    revalidatePath("/reference-imports");

    requestContext.logger.info(
      {
        event: "reference_import.completed",
        importId: referenceImport.id,
        importType: "gstr2b",
        documentCount: gstr2bValidationResult.data.totalDocuments,
        importedDocuments: gstr2bValidationResult.data.invoices.length,
      },
      "Reference import upload completed",
    );

    return completeApiRequest(
      requestContext,
      successResponse(referenceImport, {
        status: 201,
      }),
      {
        importId: referenceImport.id,
      },
    );
  } catch (error) {
    requestContext.logger.error(
      {
        event: "reference_import.failed",
        importType: "gstr2b",
        err: error,
      },
      "Reference import upload failed",
    );
    return handleApiError(requestContext, error);
  }
}

function uploadErrorResponse(
  requestContext: ApiRequestLogContext,
  error: UploadValidationError,
  importType: "gstr2b",
) {
  logUploadValidationFailed(requestContext.logger, {
    importType,
    reason: error.code,
    statusCode: error.status,
  });

  return apiError(error.status, error.code, error.message, error.details);
}
