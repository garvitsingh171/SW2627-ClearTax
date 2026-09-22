import { z } from "zod";
import {
  optionalTrimmedString,
  requiredTrimmedString,
  uuidString,
} from "@/lib/validation/common";

const gstinPattern =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const businessIdSchema = uuidString("businessId");
export const batchIdSchema = uuidString("batchId");
export const referenceImportIdSchema = uuidString("referenceImportId");
export const reconciliationResultCursorSchema = uuidString("cursor");

export const DEFAULT_RECONCILIATION_RESULTS_LIMIT = 50;
export const MAX_RECONCILIATION_RESULTS_LIMIT = 100;

export const gstinSchema = requiredTrimmedString("gstin")
  .length(15, "gstin must be exactly 15 characters.")
  .regex(gstinPattern, "Invalid GSTIN format.");

export const financialYearSchema = requiredTrimmedString("financialYear", 16);
export const returnPeriodSchema = requiredTrimmedString("returnPeriod", 16);
export const originalFilenameSchema = requiredTrimmedString("originalFilename");
export const storageObjectKeySchema = optionalTrimmedString("storageObjectKey");

export const batchRouteParamsSchema = z.object({
  batchId: batchIdSchema,
});

export const referenceImportRouteParamsSchema = z.object({
  referenceImportId: referenceImportIdSchema,
});

export const reconciliationResultsQuerySchema = z.object({
  limit: z.preprocess(
    (value) => {
      if (value === undefined) {
        return undefined;
      }

      if (typeof value !== "string") {
        return value;
      }

      const trimmedValue = value.trim();

      if (!/^\d+$/.test(trimmedValue)) {
        return Number.NaN;
      }

      return Number(trimmedValue);
    },
    z
      .number({
        error: "limit must be a positive integer.",
      })
      .int("limit must be a positive integer.")
      .min(1, "limit must be at least 1.")
      .max(
        MAX_RECONCILIATION_RESULTS_LIMIT,
        `limit must be ${MAX_RECONCILIATION_RESULTS_LIMIT} or fewer.`,
      )
      .default(DEFAULT_RECONCILIATION_RESULTS_LIMIT),
  ),
  cursor: reconciliationResultCursorSchema.optional(),
  result: z
    .enum(["PENDING", "MATCHED", "MISMATCHED", "UNMATCHED", "ERROR"])
    .optional(),
});

export const referenceImportUploadFormSchema = z.object({
  financialYear: financialYearSchema.optional(),
  returnPeriod: returnPeriodSchema.optional(),
});

export const reconciliationBatchUploadFormSchema = z.object({
  referenceImportId: referenceImportIdSchema,
});

export const createReferenceImportSchema = z.object({
  businessId: businessIdSchema,
  gstin: gstinSchema,
  financialYear: financialYearSchema,
  returnPeriod: returnPeriodSchema,
  originalFilename: originalFilenameSchema,
  storageObjectKey: storageObjectKeySchema,
});

export const createOwnedReferenceImportSchema =
  createReferenceImportSchema.omit({
    businessId: true,
  });

export const createReconciliationBatchSchema = z.object({
  businessId: businessIdSchema,
  referenceImportId: referenceImportIdSchema,
  originalFilename: originalFilenameSchema,
  storageObjectKey: storageObjectKeySchema,
});

export const createOwnedReconciliationBatchSchema =
  createReconciliationBatchSchema.omit({
    businessId: true,
  });

export type CreateReferenceImportInput = z.infer<
  typeof createReferenceImportSchema
>;
export type CreateOwnedReferenceImportInput = z.infer<
  typeof createOwnedReferenceImportSchema
>;
export type CreateReconciliationBatchInput = z.infer<
  typeof createReconciliationBatchSchema
>;
export type CreateOwnedReconciliationBatchInput = z.infer<
  typeof createOwnedReconciliationBatchSchema
>;
export type ReconciliationResultsQueryInput = z.infer<
  typeof reconciliationResultsQuerySchema
>;
export type ReferenceImportUploadFormInput = z.infer<
  typeof referenceImportUploadFormSchema
>;
export type ReconciliationBatchUploadFormInput = z.infer<
  typeof reconciliationBatchUploadFormSchema
>;
