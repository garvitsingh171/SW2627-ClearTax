import type {
  ReconciliationResult,
  RowErrorCode,
  RowProcessingStatus,
  UploadBatchStatus,
} from "@/generated/prisma/client";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type ReferenceInvoiceDetails = {
  id: string;
  supplierGstin: string;
  invoiceNumber: string;
  normalizedInvoiceNumber: string;
  invoiceDate: string;
  taxableValue: string;
  igstAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  cessAmount: string;
  totalInvoiceValue: string;
};

export type ReconciliationRowDetails = {
  id: string;
  batchId: string;
  rowNumber: number;
  rawData: JsonValue | null;
  invoiceNumber: string | null;
  normalizedInvoiceNumber: string | null;
  supplierGstin: string | null;
  invoiceDate: string | null;
  taxableValue: string | null;
  igstAmount: string | null;
  cgstAmount: string | null;
  sgstAmount: string | null;
  cessAmount: string | null;
  totalInvoiceValue: string | null;
  processingStatus: RowProcessingStatus;
  reconciliationResult: ReconciliationResult;
  errorCode: RowErrorCode | null;
  errorMessage: string | null;
  matchedReferenceId: string | null;
  mismatchCodes: string[];
  mismatchDetails: JsonValue | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  matchedReference: ReferenceInvoiceDetails | null;
};

export type ReconciliationBatchDetails = {
  id: string;
  originalFilename: string;
  status: UploadBatchStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  referenceImport: {
    id: string;
    financialYear: string;
    returnPeriod: string;
    status: string;
  };
};
