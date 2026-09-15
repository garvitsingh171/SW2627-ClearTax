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
  createOwnedReconciliationBatchSchema,
  reconciliationBatchUploadFormSchema,
} from "@/lib/validation/reconciliation";
import {
  CSV_UPLOAD_EXTENSIONS,
  CSV_UPLOAD_MIME_TYPES,
  formatDateKey,
  getRequiredFormString,
  getRequiredUploadFile,
  isMultipartRequest,
  isNegativeMoneyValue,
  isValidGstin,
  normalizeInvoiceNumber,
  normalizeMoneyValue,
  parseInvoiceDate,
  parseMultipartFormData,
  parsePurchaseRegisterCsv,
  readValidatedTextFile,
  type UploadValidationError,
} from "@/lib/upload-validation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

type ApiAuthContext = {
  userId: string;
  businessId: string;
};

type ReferenceInvoiceForMatch = {
  id: string;
  supplierGstin: string;
  invoiceNumber: string;
  normalizedInvoiceNumber: string;
  invoiceDate: Date;
  taxableValue: unknown;
  igstAmount: unknown;
  cgstAmount: unknown;
  sgstAmount: unknown;
  cessAmount: unknown;
  totalInvoiceValue: unknown;
};

export const dynamic = "force-dynamic";

const batchSelect = {
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
} as const;

export async function GET(request: Request) {
  const requestContext = createApiRequestLogContext(
    request,
    "/api/reconciliation-batches",
  );
  const authResult = await requireApiUser();

  if (!authResult.success) {
    logUnauthorizedRequest(requestContext);
    return completeApiRequest(requestContext, authResult.response);
  }

  try {
    const prisma = getPrismaClient();

    const batches = await prisma.uploadBatch.findMany({
      where: {
        businessId: authResult.auth.businessId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: batchSelect,
      take: 25,
    });

    return completeApiRequest(
      requestContext,
      successResponse(batches),
      {
        resultCount: batches.length,
      },
    );
  } catch (error) {
    return handleApiError(requestContext, error);
  }
}

export async function POST(request: Request) {
  const requestContext = createApiRequestLogContext(
    request,
    "/api/reconciliation-batches",
  );
  const authResult = await requireApiUser();

  if (!authResult.success) {
    logUnauthorizedRequest(requestContext);
    return completeApiRequest(requestContext, authResult.response);
  }

  if (isMultipartRequest(request)) {
    return createReconciliationBatchFromUpload(
      request,
      authResult.auth,
      requestContext,
    );
  }

  const parsedBody = await parseJsonObject(request);

  if (!parsedBody.success) {
    return completeApiRequest(requestContext, parsedBody.response);
  }

  const validationResult = createOwnedReconciliationBatchSchema.safeParse(
    parsedBody.body,
  );

  if (!validationResult.success) {
    return completeApiRequest(
      requestContext,
      validationErrorResponse(validationResult.error),
    );
  }

  const { referenceImportId, originalFilename, storageObjectKey } =
    validationResult.data;

  try {
    const prisma = getPrismaClient();
    requestContext.logger.info(
      {
        event: "batch.creation_started",
        referenceImportId,
      },
      "Reconciliation batch creation started",
    );
    // Resolve business context first because the reference import
    // must belong to the resolved business before creating a batch.

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

    const referenceImport = await prisma.referenceImport.findFirst({
      where: {
        id: referenceImportId,
        businessId: business.id,
      },
      select: {
        id: true,
      },
    });

    if (!referenceImport) {
      return completeApiRequest(
        requestContext,
        apiError(
          404,
          API_ERROR_CODES.REFERENCE_IMPORT_NOT_FOUND,
          "The requested reference import was not found.",
        ),
      );
    }

    const batch = await prisma.uploadBatch.create({
      data: {
        businessId: business.id,
        referenceImportId,
        originalFilename,
        ...(storageObjectKey ? { storageObjectKey } : {}),
      },
      select: batchSelect,
    });

    revalidatePath("/");
    revalidatePath("/reconciliations");
    revalidatePath("/reference-imports");
    revalidatePath(`/reference-imports/${referenceImportId}`);

    requestContext.logger.info(
      {
        event: "batch.created",
        batchId: batch.id,
        referenceImportId,
      },
      "Reconciliation batch created",
    );

    return completeApiRequest(
      requestContext,
      successResponse(batch, {
        status: 201,
      }),
      {
        batchId: batch.id,
        referenceImportId,
      },
    );
  } catch (error) {
    return handleApiError(requestContext, error, {
      referenceImportId,
    });
  }
}

async function createReconciliationBatchFromUpload(
  request: Request,
  auth: ApiAuthContext,
  requestContext: ApiRequestLogContext,
) {
  requestContext.logger.info(
    {
      event: "purchase_register_import.started",
      uploadType: "multipart",
    },
    "Purchase register upload started",
  );

  const formDataResult = await parseMultipartFormData(request);

  if (!formDataResult.success) {
    return completeApiRequest(
      requestContext,
      uploadErrorResponse(requestContext, formDataResult.error),
    );
  }

  const formValidationResult = reconciliationBatchUploadFormSchema.safeParse({
    referenceImportId: getRequiredFormString(
      formDataResult.data,
      "referenceImportId",
    ),
  });

  if (!formValidationResult.success) {
    logUploadValidationFailed(requestContext.logger, {
      importType: "purchase_register",
      reason: "invalid_form_fields",
    });
    return completeApiRequest(
      requestContext,
      validationErrorResponse(formValidationResult.error),
    );
  }

  const fileResult = getRequiredUploadFile(formDataResult.data);

  if (!fileResult.success) {
    return completeApiRequest(
      requestContext,
      uploadErrorResponse(requestContext, fileResult.error),
    );
  }

  requestContext.logger.info(
    {
      event: "upload.received",
      importType: "purchase_register",
      fileType: fileResult.data.type || null,
      fileSize: fileResult.data.size,
    },
    "Upload received",
  );

  const fileResultData = await readValidatedTextFile(fileResult.data, {
    acceptedExtensions: CSV_UPLOAD_EXTENSIONS,
    acceptedMimeTypes: CSV_UPLOAD_MIME_TYPES,
    fileKind: "Purchase Register CSV",
  });

  if (!fileResultData.success) {
    return completeApiRequest(
      requestContext,
      uploadErrorResponse(requestContext, fileResultData.error),
    );
  }

  const csvValidationResult = parsePurchaseRegisterCsv(
    fileResultData.data.text,
  );

  if (!csvValidationResult.success) {
    return completeApiRequest(
      requestContext,
      uploadErrorResponse(requestContext, csvValidationResult.error),
    );
  }

  const { referenceImportId } = formValidationResult.data;
  requestContext.logger.info(
    {
      event: "upload.validation_succeeded",
      importType: "purchase_register",
      referenceImportId,
      fileType: fileResultData.data.contentType,
      fileSize: fileResult.data.size,
      rowCount: csvValidationResult.data.totalRows,
    },
    "Upload validation succeeded",
  );

  try {
    const prisma = getPrismaClient();

    const business = await prisma.business.findFirst({
      where: {
        id: auth.businessId,
        ownerId: auth.userId,
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

    const batch = await prisma.$transaction(async (transaction) => {
      const referenceImport = await transaction.referenceImport.findFirst({
        where: {
          id: referenceImportId,
          businessId: business.id,
        },
        select: {
          id: true,
        },
      });

      if (!referenceImport) {
        return null;
      }

      const referenceInvoices = await transaction.referenceInvoice.findMany({
        where: {
          referenceImportId,
        },
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
      });
      const processedRows = buildPurchaseRegisterRows(
        csvValidationResult.data,
        referenceInvoices,
      );
      const matchedRows = processedRows.filter(
        (row) => row.reconciliationResult === "MATCHED",
      ).length;
      const mismatchedRows = processedRows.filter(
        (row) => row.reconciliationResult === "MISMATCHED",
      ).length;
      const errorRows = processedRows.filter(
        (row) => row.reconciliationResult === "ERROR",
      ).length;
      const now = new Date();
      const createdBatch = await transaction.uploadBatch.create({
        data: {
          businessId: business.id,
          referenceImportId,
          originalFilename: fileResultData.data.originalFilename,
          totalRows: csvValidationResult.data.totalRows,
          processedRows: processedRows.length,
          matchedRows,
          mismatchedRows,
          errorRows,
          status: errorRows > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
          startedAt: now,
          completedAt: now,
        },
      });

      await transaction.reconciliationRow.createMany({
        data: processedRows.map((row) => ({
          ...row,
          batchId: createdBatch.id,
        })),
      });

      return transaction.uploadBatch.findUniqueOrThrow({
        where: {
          id: createdBatch.id,
        },
        select: batchSelect,
      });
    });

    if (!batch) {
      return completeApiRequest(
        requestContext,
        apiError(
          404,
          API_ERROR_CODES.REFERENCE_IMPORT_NOT_FOUND,
          "The requested reference import was not found.",
        ),
      );
    }

    revalidatePath("/");
    revalidatePath("/reconciliations");
    revalidatePath("/reference-imports");
    revalidatePath(`/reference-imports/${referenceImportId}`);

    requestContext.logger.info(
      {
        event: "batch.created",
        batchId: batch.id,
        referenceImportId,
        rowCount: csvValidationResult.data.totalRows,
        matchedRows: batch.matchedRows,
        mismatchedRows: batch.mismatchedRows,
        errorRows: batch.errorRows,
      },
      "Reconciliation batch created from upload",
    );

    requestContext.logger.info(
      {
        event: "purchase_register_import.completed",
        batchId: batch.id,
        referenceImportId,
        rowCount: csvValidationResult.data.totalRows,
        matchedRows: batch.matchedRows,
        mismatchedRows: batch.mismatchedRows,
        errorRows: batch.errorRows,
      },
      "Purchase register upload completed",
    );

    return completeApiRequest(
      requestContext,
      successResponse(batch, {
        status: 201,
      }),
      {
        batchId: batch.id,
        referenceImportId,
      },
    );
  } catch (error) {
    requestContext.logger.error(
      {
        event: "purchase_register_import.failed",
        referenceImportId,
        err: error,
      },
      "Purchase register upload failed",
    );
    return handleApiError(requestContext, error, {
      referenceImportId,
    });
  }
}

function uploadErrorResponse(
  requestContext: ApiRequestLogContext,
  error: UploadValidationError,
) {
  logUploadValidationFailed(requestContext.logger, {
    importType: "purchase_register",
    reason: error.code,
    statusCode: error.status,
  });

  return apiError(error.status, error.code, error.message, error.details);
}

function buildPurchaseRegisterRows(
  csv: {
    headers: string[];
    rows: {
      rowNumber: number;
      values: Record<string, string>;
      cellCount: number;
    }[];
  },
  referenceInvoices: ReferenceInvoiceForMatch[],
) {
  const referenceIndex = buildReferenceInvoiceIndex(referenceInvoices);
  const seenBatchKeys = new Set<string>();

  return csv.rows.map((row) => {
    const rawData = row.values as Prisma.InputJsonObject;
    const malformedRow = validateCsvRowShape(row, csv.headers);

    if (malformedRow) {
      return buildErrorRow(row.rowNumber, rawData, "MALFORMED_ROW", malformedRow);
    }

    const invoiceNumber = row.values.invoice_number.trim();
    const supplierGstin = row.values.supplier_gstin.trim().toUpperCase();
    const invoiceDateText = row.values.invoice_date.trim();
    const invoiceDate = parseInvoiceDate(invoiceDateText);
    const normalizedInvoiceNumber = normalizeInvoiceNumber(invoiceNumber);

    if (!invoiceNumber) {
      return buildErrorRow(
        row.rowNumber,
        rawData,
        "MISSING_INVOICE_NUMBER",
        "Invoice number is required before reconciliation.",
      );
    }

    if (!supplierGstin || !isValidGstin(supplierGstin)) {
      return buildErrorRow(
        row.rowNumber,
        rawData,
        "INVALID_GSTIN",
        "Supplier GSTIN is missing or invalid.",
        {
          invoiceNumber,
          normalizedInvoiceNumber,
          supplierGstin: supplierGstin || null,
        },
      );
    }

    if (!invoiceDate) {
      return buildErrorRow(
        row.rowNumber,
        rawData,
        "INVALID_INVOICE_DATE",
        "Invoice date is missing or invalid.",
        {
          invoiceNumber,
          normalizedInvoiceNumber,
          supplierGstin,
        },
      );
    }

    const moneyValues = parsePurchaseRegisterMoneyValues(row.values);

    if (!moneyValues.success) {
      return buildErrorRow(
        row.rowNumber,
        rawData,
        moneyValues.errorCode,
        moneyValues.message,
        {
          invoiceNumber,
          normalizedInvoiceNumber,
          supplierGstin,
          invoiceDate,
        },
      );
    }

    const batchKey = [
      supplierGstin,
      normalizedInvoiceNumber,
      formatDateKey(invoiceDate),
    ].join("|");

    if (seenBatchKeys.has(batchKey)) {
      return buildErrorRow(
        row.rowNumber,
        rawData,
        "DUPLICATE_IN_BATCH",
        "Duplicate supplier GSTIN, invoice number, and invoice date in this batch.",
        {
          invoiceNumber,
          normalizedInvoiceNumber,
          supplierGstin,
          invoiceDate,
          ...moneyValues.data,
        },
      );
    }

    seenBatchKeys.add(batchKey);

    const referenceInvoice = findReferenceInvoice(
      referenceIndex,
      supplierGstin,
      normalizedInvoiceNumber,
      invoiceDate,
    );
    const reconciliation = reconcileRow(
      {
        invoiceDate,
        ...moneyValues.data,
      },
      referenceInvoice,
    );

    return {
      rowNumber: row.rowNumber,
      rawData,
      invoiceNumber,
      normalizedInvoiceNumber,
      supplierGstin,
      invoiceDate,
      taxableValue: moneyValues.data.taxableValue,
      igstAmount: moneyValues.data.igstAmount,
      cgstAmount: moneyValues.data.cgstAmount,
      sgstAmount: moneyValues.data.sgstAmount,
      cessAmount: moneyValues.data.cessAmount,
      totalInvoiceValue: moneyValues.data.totalInvoiceValue,
      processingStatus: "COMPLETED" as const,
      reconciliationResult: reconciliation.result,
      errorCode: null,
      errorMessage: null,
      matchedReferenceId: referenceInvoice?.id ?? null,
      mismatchCodes: reconciliation.mismatchCodes,
      mismatchDetails: reconciliation.mismatchDetails,
      processedAt: new Date(),
    };
  });
}

function validateCsvRowShape(
  row: {
    rowNumber: number;
    cellCount: number;
  },
  headers: string[],
) {
  if (row.cellCount === headers.length) {
    return null;
  }

  return `Row ${row.rowNumber} has ${row.cellCount} columns; expected ${headers.length}.`;
}

function buildReferenceInvoiceIndex(referenceInvoices: ReferenceInvoiceForMatch[]) {
  const index = new Map<string, ReferenceInvoiceForMatch[]>();

  for (const invoice of referenceInvoices) {
    const key = [
      invoice.supplierGstin.toUpperCase(),
      invoice.normalizedInvoiceNumber,
    ].join("|");
    index.set(key, [...(index.get(key) ?? []), invoice]);
  }

  return index;
}

function findReferenceInvoice(
  index: Map<string, ReferenceInvoiceForMatch[]>,
  supplierGstin: string,
  normalizedInvoiceNumber: string,
  invoiceDate: Date,
) {
  const candidates =
    index.get([supplierGstin, normalizedInvoiceNumber].join("|")) ?? [];
  const invoiceDateKey = formatDateKey(invoiceDate);

  return (
    candidates.find(
      (candidate) => formatDateKey(candidate.invoiceDate) === invoiceDateKey,
    ) ??
    candidates[0] ??
    null
  );
}

function parsePurchaseRegisterMoneyValues(values: Record<string, string>) {
  const fields = [
    ["taxable_value", "taxableValue", "INVALID_TAXABLE_VALUE"],
    ["igst_amount", "igstAmount", "INVALID_IGST"],
    ["cgst_amount", "cgstAmount", "INVALID_CGST"],
    ["sgst_amount", "sgstAmount", "INVALID_SGST"],
    ["cess_amount", "cessAmount", "INVALID_CESS"],
    ["total_invoice_value", "totalInvoiceValue", "INVALID_TOTAL_VALUE"],
  ] as const;
  const parsedValues: Record<string, string> = {};

  for (const [csvField, modelField, errorCode] of fields) {
    const rawValue = values[csvField]?.trim() ?? "";
    const normalizedValue = normalizeMoneyValue(rawValue);

    if (!normalizedValue) {
      return {
        success: false as const,
        errorCode,
        message: `${formatCsvFieldName(csvField)} is missing or invalid.`,
      };
    }

    if (isNegativeMoneyValue(normalizedValue)) {
      return {
        success: false as const,
        errorCode: "NEGATIVE_AMOUNT" as const,
        message: `${formatCsvFieldName(csvField)} cannot be negative.`,
      };
    }

    parsedValues[modelField] = normalizedValue;
  }

  return {
    success: true as const,
    data: parsedValues as {
      taxableValue: string;
      igstAmount: string;
      cgstAmount: string;
      sgstAmount: string;
      cessAmount: string;
      totalInvoiceValue: string;
    },
  };
}

function reconcileRow(
  purchase: {
    invoiceDate: Date;
    taxableValue: string;
    igstAmount: string;
    cgstAmount: string;
    sgstAmount: string;
    cessAmount: string;
    totalInvoiceValue: string;
  },
  referenceInvoice: ReferenceInvoiceForMatch | null,
) {
  if (!referenceInvoice) {
    return {
      result: "MISMATCHED" as const,
      mismatchCodes: ["REFERENCE_NOT_FOUND"],
      mismatchDetails: {
        REFERENCE_NOT_FOUND: {
          message: "No matching GSTR-2B reference invoice was found.",
        },
      } satisfies Prisma.InputJsonObject,
    };
  }

  const comparisons = [
    {
      code: "INVOICE_DATE_MISMATCH",
      uploaded: formatDateKey(purchase.invoiceDate),
      reference: formatDateKey(referenceInvoice.invoiceDate),
    },
    {
      code: "TAXABLE_VALUE_MISMATCH",
      uploaded: purchase.taxableValue,
      reference: formatDecimalValue(referenceInvoice.taxableValue),
    },
    {
      code: "IGST_MISMATCH",
      uploaded: purchase.igstAmount,
      reference: formatDecimalValue(referenceInvoice.igstAmount),
    },
    {
      code: "CGST_MISMATCH",
      uploaded: purchase.cgstAmount,
      reference: formatDecimalValue(referenceInvoice.cgstAmount),
    },
    {
      code: "SGST_MISMATCH",
      uploaded: purchase.sgstAmount,
      reference: formatDecimalValue(referenceInvoice.sgstAmount),
    },
    {
      code: "CESS_MISMATCH",
      uploaded: purchase.cessAmount,
      reference: formatDecimalValue(referenceInvoice.cessAmount),
    },
    {
      code: "TOTAL_VALUE_MISMATCH",
      uploaded: purchase.totalInvoiceValue,
      reference: formatDecimalValue(referenceInvoice.totalInvoiceValue),
    },
  ];
  const mismatches = comparisons.filter(
    (comparison) => comparison.uploaded !== comparison.reference,
  );

  if (mismatches.length === 0) {
    return {
      result: "MATCHED" as const,
      mismatchCodes: [],
      mismatchDetails: Prisma.JsonNull,
    };
  }

  return {
    result: "MISMATCHED" as const,
    mismatchCodes: mismatches.map((mismatch) => mismatch.code),
    mismatchDetails: mismatches.reduce<Record<string, Prisma.InputJsonValue>>(
      (details, mismatch) => {
        details[mismatch.code] = {
          uploaded: mismatch.uploaded,
          reference: mismatch.reference,
        };

        return details;
      },
      {},
    ),
  };
}

function buildErrorRow(
  rowNumber: number,
  rawData: Prisma.InputJsonObject,
  errorCode:
    | "MISSING_INVOICE_NUMBER"
    | "INVALID_GSTIN"
    | "INVALID_INVOICE_DATE"
    | "INVALID_TAXABLE_VALUE"
    | "INVALID_IGST"
    | "INVALID_CGST"
    | "INVALID_SGST"
    | "INVALID_CESS"
    | "INVALID_TOTAL_VALUE"
    | "NEGATIVE_AMOUNT"
    | "DUPLICATE_IN_BATCH"
    | "MALFORMED_ROW",
  errorMessage: string,
  partialData: Partial<{
    invoiceNumber: string;
    normalizedInvoiceNumber: string;
    supplierGstin: string | null;
    invoiceDate: Date;
    taxableValue: string;
    igstAmount: string;
    cgstAmount: string;
    sgstAmount: string;
    cessAmount: string;
    totalInvoiceValue: string;
  }> = {},
) {
  return {
    rowNumber,
    rawData,
    invoiceNumber: partialData.invoiceNumber ?? null,
    normalizedInvoiceNumber: partialData.normalizedInvoiceNumber ?? null,
    supplierGstin: partialData.supplierGstin ?? null,
    invoiceDate: partialData.invoiceDate ?? null,
    taxableValue: partialData.taxableValue ?? null,
    igstAmount: partialData.igstAmount ?? null,
    cgstAmount: partialData.cgstAmount ?? null,
    sgstAmount: partialData.sgstAmount ?? null,
    cessAmount: partialData.cessAmount ?? null,
    totalInvoiceValue: partialData.totalInvoiceValue ?? null,
    processingStatus: "FAILED" as const,
    reconciliationResult: "ERROR" as const,
    errorCode,
    errorMessage,
    matchedReferenceId: null,
    mismatchCodes: [],
    mismatchDetails: Prisma.JsonNull,
    processedAt: new Date(),
  };
}

function formatDecimalValue(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toFixed" in value &&
    typeof value.toFixed === "function"
  ) {
    return value.toFixed(2);
  }

  return normalizeMoneyValue(String(value)) ?? String(value);
}

function formatCsvFieldName(fieldName: string) {
  return fieldName.replaceAll("_", " ");
}
