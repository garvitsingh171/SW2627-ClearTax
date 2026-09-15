import {
  API_ERROR_CODES,
  type ApiErrorCode,
  type ApiErrorDetails,
} from "@/lib/api-response";

export const UPLOAD_FILE_FIELD_NAME = "file";
export const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_PURCHASE_REGISTER_ROWS = 10_000;

export const JSON_UPLOAD_EXTENSIONS = [".json"] as const;
export const CSV_UPLOAD_EXTENSIONS = [".csv"] as const;

export const JSON_UPLOAD_MIME_TYPES = new Set([
  "application/json",
  "application/x-json",
  "text/json",
]);

export const CSV_UPLOAD_MIME_TYPES = new Set([
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
  "text/csv",
]);

export const REQUIRED_PURCHASE_REGISTER_HEADERS = [
  "invoice_number",
  "supplier_gstin",
  "invoice_date",
  "taxable_value",
  "igst_amount",
  "cgst_amount",
  "sgst_amount",
  "cess_amount",
  "total_invoice_value",
] as const;

export type UploadValidationError = {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: ApiErrorDetails;
};

type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: UploadValidationError;
    };

type FileValidationConfig = {
  acceptedExtensions: readonly string[];
  acceptedMimeTypes: ReadonlySet<string>;
  fileKind: "GSTR-2B JSON" | "Purchase Register CSV";
};

export type ValidatedTextFile = {
  originalFilename: string;
  contentType: string | null;
  text: string;
};

export type Gstr2bValidationSummary = {
  gstin: string;
  returnPeriod: string | null;
  totalDocuments: number;
};

export type ParsedReferenceInvoice = {
  supplierGstin: string;
  invoiceNumber: string;
  normalizedInvoiceNumber: string;
  invoiceDate: Date;
  taxableValue: string;
  igstAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  cessAmount: string;
  totalInvoiceValue: string;
};

export type ParsedGstr2bImport = Gstr2bValidationSummary & {
  invoices: ParsedReferenceInvoice[];
};

export type PurchaseRegisterCsvSummary = {
  headers: string[];
  totalRows: number;
};

export type ParsedPurchaseRegisterCsv = PurchaseRegisterCsvSummary & {
  rows: {
    rowNumber: number;
    values: Record<string, string>;
    cellCount: number;
  }[];
};

export function isMultipartRequest(request: Request) {
  return (
    request.headers.get("content-type")?.toLowerCase().includes(
      "multipart/form-data",
    ) ?? false
  );
}

export async function parseMultipartFormData(
  request: Request,
): Promise<ValidationResult<FormData>> {
  try {
    return {
      success: true,
      data: await request.formData(),
    };
  } catch {
    return uploadError(
      400,
      API_ERROR_CODES.INVALID_FILE,
      "Request body must be valid multipart form data.",
    );
  }
}

export function getRequiredUploadFile(
  formData: FormData,
  fieldName = UPLOAD_FILE_FIELD_NAME,
): ValidationResult<File> {
  const value = formData.get(fieldName);

  if (!isUploadedFile(value)) {
    return uploadError(
      400,
      API_ERROR_CODES.INVALID_FILE,
      `Upload a file using the "${fieldName}" form field.`,
    );
  }

  return {
    success: true,
    data: value,
  };
}

export async function readValidatedTextFile(
  file: File,
  config: FileValidationConfig,
): Promise<ValidationResult<ValidatedTextFile>> {
  const metadataValidation = validateUploadedFileMetadata(file, config);

  if (!metadataValidation.success) {
    return metadataValidation;
  }

  let text: string;

  try {
    text = await file.text();
  } catch {
    return uploadError(
      400,
      API_ERROR_CODES.INVALID_FILE,
      "The uploaded file could not be read.",
    );
  }

  if (text.trim().length === 0) {
    return uploadError(400, API_ERROR_CODES.INVALID_FILE, "Uploaded file is empty.");
  }

  return {
    success: true,
    data: {
      ...metadataValidation.data,
      text,
    },
  };
}

export function validateGstr2bJson(
  text: string,
): ValidationResult<Gstr2bValidationSummary> {
  const parseResult = parseGstr2bJson(text);

  if (!parseResult.success) {
    return parseResult;
  }

  const { gstin, returnPeriod, totalDocuments } = parseResult.data;

  return {
    success: true,
    data: {
      gstin,
      returnPeriod,
      totalDocuments,
    },
  };
}

export function parseGstr2bJson(
  text: string,
): ValidationResult<ParsedGstr2bImport> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return uploadError(
      400,
      API_ERROR_CODES.FILE_PARSE_ERROR,
      "Uploaded JSON is malformed.",
    );
  }

  if (!isRecord(parsed)) {
    return invalidGstr2bStructure("GSTR-2B JSON must contain an object root.");
  }

  const payload = isRecord(parsed.data) ? parsed.data : parsed;
  const docData = payload.docdata;

  if (!isRecord(docData) || !Array.isArray(docData.b2b)) {
    return invalidGstr2bStructure(
      "GSTR-2B JSON must contain data.docdata.b2b invoice records.",
    );
  }

  const gstin = getStringValue(payload, ["gstin"]);

  if (!gstin) {
    return invalidGstr2bStructure("GSTR-2B JSON is missing gstin.");
  }

  const returnPeriod = getStringValue(payload, [
    "rtnprd",
    "returnPeriod",
    "return_period",
  ]);

  const invoices: ParsedReferenceInvoice[] = [];
  const seenInvoiceKeys = new Set<string>();

  for (const [supplierIndex, supplier] of docData.b2b.entries()) {
    if (!isRecord(supplier)) {
      return invalidGstr2bStructure(
        `GSTR-2B supplier record ${supplierIndex + 1} must be an object.`,
      );
    }

    const supplierGstin = getStringValue(supplier, ["ctin", "supplierGstin"]);

    if (!supplierGstin) {
      return invalidGstr2bStructure(
        `GSTR-2B supplier record ${supplierIndex + 1} is missing supplier GSTIN.`,
      );
    }

    const normalizedSupplierGstin = supplierGstin.toUpperCase();

    if (!isValidGstin(normalizedSupplierGstin)) {
      return invalidGstr2bStructure(
        `GSTR-2B supplier record ${supplierIndex + 1} has invalid supplier GSTIN.`,
      );
    }

    if (!Array.isArray(supplier.inv) || supplier.inv.length === 0) {
      return invalidGstr2bStructure(
        `GSTR-2B supplier record ${supplierIndex + 1} is missing invoices.`,
      );
    }

    for (const [invoiceIndex, invoice] of supplier.inv.entries()) {
      if (!isRecord(invoice)) {
        return invalidGstr2bStructure(
          `GSTR-2B invoice ${invoiceIndex + 1} for supplier ${
            supplierIndex + 1
          } must be an object.`,
        );
      }

      const invoiceLabel = `GSTR-2B invoice ${invoiceIndex + 1} for supplier ${
        supplierIndex + 1
      }`;

      const invoiceNumber = getStringValue(invoice, ["inum", "invoiceNumber"]);

      if (!invoiceNumber) {
        return invalidGstr2bStructure(`${invoiceLabel} is missing invoice number.`);
      }

      const invoiceDateText = getStringValue(invoice, ["dt", "invoiceDate"]);
      const invoiceDate = invoiceDateText
        ? parseInvoiceDate(invoiceDateText)
        : null;

      if (!invoiceDate) {
        return invalidGstr2bStructure(`${invoiceLabel} is missing invoice date.`);
      }

      const totalInvoiceValue = getNonNegativeMoneyValue(invoice, [
        "val",
        "totalInvoiceValue",
      ]);

      if (!totalInvoiceValue) {
        return invalidGstr2bStructure(
          `${invoiceLabel} is missing total invoice value.`,
        );
      }

      if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
        return invalidGstr2bStructure(`${invoiceLabel} is missing item values.`);
      }

      let taxableValue = "0.00";
      let igstAmount = "0.00";
      let cgstAmount = "0.00";
      let sgstAmount = "0.00";
      let cessAmount = "0.00";

      for (const [itemIndex, item] of invoice.items.entries()) {
        if (!isRecord(item)) {
          return invalidGstr2bStructure(
            `${invoiceLabel} item ${itemIndex + 1} must be an object.`,
          );
        }

        const itemLabel = `${invoiceLabel} item ${itemIndex + 1}`;
        const itemValues = isRecord(item.itm_det) ? item.itm_det : item;
        const itemTaxableValue = getNonNegativeMoneyValue(itemValues, [
          "txval",
          "taxableValue",
        ]);

        if (!itemTaxableValue) {
          return invalidGstr2bStructure(
            `${itemLabel} is missing taxable value.`,
          );
        }

        const itemIgstAmount = getNonNegativeMoneyValue(itemValues, [
          "iamt",
          "igst",
          "igstAmount",
        ]);

        if (!itemIgstAmount) {
          return invalidGstr2bStructure(`${itemLabel} is missing IGST amount.`);
        }

        const itemCgstAmount = getNonNegativeMoneyValue(itemValues, [
          "camt",
          "cgst",
          "cgstAmount",
        ]);

        if (!itemCgstAmount) {
          return invalidGstr2bStructure(`${itemLabel} is missing CGST amount.`);
        }

        const itemSgstAmount = getNonNegativeMoneyValue(itemValues, [
          "samt",
          "sgst",
          "sgstAmount",
        ]);

        if (!itemSgstAmount) {
          return invalidGstr2bStructure(`${itemLabel} is missing SGST amount.`);
        }

        const itemCessAmount = getNonNegativeMoneyValue(itemValues, [
          "cess",
          "csamt",
          "cessAmount",
        ]);

        if (!itemCessAmount) {
          return invalidGstr2bStructure(`${itemLabel} is missing cess amount.`);
        }

        taxableValue = addMoneyStrings(taxableValue, itemTaxableValue);
        igstAmount = addMoneyStrings(igstAmount, itemIgstAmount);
        cgstAmount = addMoneyStrings(cgstAmount, itemCgstAmount);
        sgstAmount = addMoneyStrings(sgstAmount, itemSgstAmount);
        cessAmount = addMoneyStrings(cessAmount, itemCessAmount);
      }

      const normalizedInvoiceNumber = normalizeInvoiceNumber(invoiceNumber);
      const invoiceKey = [
        normalizedSupplierGstin,
        normalizedInvoiceNumber,
        formatDateKey(invoiceDate),
      ].join("|");

      if (seenInvoiceKeys.has(invoiceKey)) {
        return invalidGstr2bStructure(
          `${invoiceLabel} duplicates another GSTR-2B invoice in this file.`,
        );
      }

      seenInvoiceKeys.add(invoiceKey);
      invoices.push({
        supplierGstin: normalizedSupplierGstin,
        invoiceNumber,
        normalizedInvoiceNumber,
        invoiceDate,
        taxableValue,
        igstAmount,
        cgstAmount,
        sgstAmount,
        cessAmount,
        totalInvoiceValue,
      });
    }
  }

  if (invoices.length === 0) {
    return invalidGstr2bStructure(
      "GSTR-2B JSON does not contain supported B2B invoices.",
    );
  }

  return {
    success: true,
    data: {
      gstin,
      returnPeriod,
      totalDocuments: invoices.length,
      invoices,
    },
  };
}

export function validatePurchaseRegisterCsv(
  text: string,
): ValidationResult<PurchaseRegisterCsvSummary> {
  const csvParseResult = parsePurchaseRegisterCsv(text);

  if (!csvParseResult.success) {
    return csvParseResult;
  }

  const { headers, totalRows } = csvParseResult.data;

  return {
    success: true,
    data: {
      headers,
      totalRows,
    },
  };
}

export function parsePurchaseRegisterCsv(
  text: string,
): ValidationResult<ParsedPurchaseRegisterCsv> {
  const csvParseResult = parseCsv(text);

  if (!csvParseResult.success) {
    return csvParseResult;
  }

  const rowsWithNumbers = csvParseResult.data
    .map((row, index) => ({
      rowNumber: index + 1,
      cells: row,
    }))
    .filter(({ cells }) => cells.some((cell) => cell.trim().length > 0));

  if (rowsWithNumbers.length === 0) {
    return uploadError(
      400,
      API_ERROR_CODES.INVALID_FILE_HEADERS,
      "Purchase Register CSV is missing a header row.",
    );
  }

  const headerRow = rowsWithNumbers[0];
  const headers = headerRow.cells.map((header, index) =>
    normalizeCsvHeader(header, index),
  );
  const duplicateHeaders = findDuplicateHeaders(headers);

  if (duplicateHeaders.length > 0) {
    return uploadError(
      400,
      API_ERROR_CODES.INVALID_FILE_HEADERS,
      "Purchase Register CSV contains duplicate columns.",
      {
        duplicateHeaders,
      },
    );
  }

  const missingHeaders = REQUIRED_PURCHASE_REGISTER_HEADERS.filter(
    (header) => !headers.includes(header),
  );

  if (missingHeaders.length > 0) {
    return uploadError(
      400,
      API_ERROR_CODES.INVALID_FILE_HEADERS,
      "Purchase Register CSV is missing required columns.",
      {
        missingHeaders,
      },
    );
  }

  const dataRows = rowsWithNumbers.slice(1);
  const totalRows = dataRows.length;

  if (totalRows === 0) {
    return uploadError(
      400,
      API_ERROR_CODES.INVALID_FILE,
      "Purchase Register CSV does not contain invoice rows.",
    );
  }

  if (totalRows > MAX_PURCHASE_REGISTER_ROWS) {
    return uploadError(
      400,
      API_ERROR_CODES.INVALID_FILE,
      `Purchase Register CSV cannot exceed ${MAX_PURCHASE_REGISTER_ROWS} invoice rows.`,
      {
        maxRows: MAX_PURCHASE_REGISTER_ROWS,
      },
    );
  }

  return {
    success: true,
    data: {
      headers,
      totalRows,
      rows: dataRows.map(({ rowNumber, cells }) => ({
        rowNumber,
        cellCount: cells.length,
        values: headers.reduce<Record<string, string>>((values, header, index) => {
          if (header) {
            values[header] = cells[index]?.trim() ?? "";
          }

          return values;
        }, {}),
      })),
    },
  };
}

export function normalizeInvoiceNumber(invoiceNumber: string) {
  return invoiceNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function parseInvoiceDate(value: string) {
  const trimmedValue = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);
  const indianMatch = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(trimmedValue);

  const parts = isoMatch
    ? {
        year: Number(isoMatch[1]),
        month: Number(isoMatch[2]),
        day: Number(isoMatch[3]),
      }
    : indianMatch
      ? {
          year: Number(indianMatch[3]),
          month: Number(indianMatch[2]),
          day: Number(indianMatch[1]),
        }
      : null;

  if (!parts || parts.month < 1 || parts.month > 12 || parts.day < 1) {
    return null;
  }

  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0),
  );

  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    return null;
  }

  return date;
}

export function normalizeMoneyValue(value: string) {
  const trimmedValue = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(trimmedValue);

  if (!match) {
    return null;
  }

  const [, sign, integerPart, decimalPart = ""] = match;
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";
  const normalizedDecimal = decimalPart.padEnd(2, "0");
  const normalized = `${sign}${normalizedInteger}.${normalizedDecimal}`;

  return normalized === "-0.00" ? "0.00" : normalized;
}

export function isNegativeMoneyValue(value: string) {
  return value.startsWith("-") && value !== "-0.00";
}

export function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isValidGstin(value: string) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value);
}

export function deriveFinancialYearFromReturnPeriod(returnPeriod: string) {
  if (!/^(0[1-9]|1[0-2])\d{4}$/.test(returnPeriod)) {
    return null;
  }

  const month = Number(returnPeriod.slice(0, 2));
  const year = Number(returnPeriod.slice(2));
  const startYear = month >= 4 ? year : year - 1;
  const endYearSuffix = String((startYear + 1) % 100).padStart(2, "0");

  return `${startYear}-${endYearSuffix}`;
}

export function getOptionalFormString(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function getRequiredFormString(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value.trim() : "";
}

export function uploadError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: ApiErrorDetails,
): ValidationResult<never> {
  return {
    success: false,
    error: {
      status,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}

function validateUploadedFileMetadata(
  file: File,
  config: FileValidationConfig,
): ValidationResult<Omit<ValidatedTextFile, "text">> {
  if (file.size === 0) {
    return uploadError(400, API_ERROR_CODES.INVALID_FILE, "Uploaded file is empty.");
  }

  if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    return uploadError(
      413,
      API_ERROR_CODES.FILE_TOO_LARGE,
      `Uploaded file exceeds the ${formatMegabytes(
        MAX_UPLOAD_FILE_SIZE_BYTES,
      )} limit.`,
      {
        maxFileSizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES,
      },
    );
  }

  const originalFilename = sanitizeOriginalFilename(file.name);
  const extension = getFileExtension(originalFilename);

  if (!config.acceptedExtensions.includes(extension)) {
    return uploadError(
      415,
      API_ERROR_CODES.INVALID_FILE_TYPE,
      `${config.fileKind} uploads must use ${formatList(
        config.acceptedExtensions,
      )} files.`,
      {
        acceptedExtensions: config.acceptedExtensions,
      },
    );
  }

  const contentType = file.type.trim().toLowerCase();

  if (contentType && !config.acceptedMimeTypes.has(contentType)) {
    return uploadError(
      415,
      API_ERROR_CODES.INVALID_FILE_TYPE,
      `${config.fileKind} upload has an unsupported content type.`,
      {
        acceptedMimeTypes: Array.from(config.acceptedMimeTypes),
      },
    );
  }

  return {
    success: true,
    data: {
      originalFilename,
      contentType: contentType || null,
    },
  };
}

function parseCsv(text: string): ValidationResult<string[][]> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === "\"") {
        if (text[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }

      continue;
    }

    if (character === "\"") {
      if (field.length > 0) {
        return malformedCsv("CSV contains an unexpected quote.");
      }

      inQuotes = true;
      continue;
    }

    if (character === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (character === "\r" || character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";

      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }

      continue;
    }

    field += character;
  }

  if (inQuotes) {
    return malformedCsv("CSV contains an unterminated quoted field.");
  }

  row.push(field);
  rows.push(row);

  return {
    success: true,
    data: rows,
  };
}

function malformedCsv(message: string): ValidationResult<never> {
  return uploadError(400, API_ERROR_CODES.FILE_PARSE_ERROR, message);
}

function invalidGstr2bStructure(message: string): ValidationResult<never> {
  return uploadError(422, API_ERROR_CODES.INVALID_FILE, message);
}

function sanitizeOriginalFilename(filename: string) {
  const basename = filename.split(/[/\\]/).pop()?.trim() ?? "";
  const withoutControlCharacters = basename.replace(/[\u0000-\u001f\u007f]/g, "");

  return withoutControlCharacters || "upload";
}

function getFileExtension(filename: string) {
  const lastDotIndex = filename.lastIndexOf(".");

  return lastDotIndex >= 0 ? filename.slice(lastDotIndex).toLowerCase() : "";
}

function findDuplicateHeaders(headers: string[]) {
  const seenHeaders = new Set<string>();
  const duplicateHeaders = new Set<string>();

  for (const header of headers) {
    if (!header) {
      continue;
    }

    if (seenHeaders.has(header)) {
      duplicateHeaders.add(header);
    }

    seenHeaders.add(header);
  }

  return Array.from(duplicateHeaders);
}

function normalizeCsvHeader(header: string, index: number) {
  const trimmedHeader = header.trim();
  const withoutBom =
    index === 0 ? trimmedHeader.replace(/^\uFEFF/, "") : trimmedHeader;

  return withoutBom.toLowerCase();
}

function getStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function getNonNegativeMoneyValue(
  record: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = record[key];
    const normalizedValue =
      typeof value === "number"
        ? normalizeMoneyValue(String(value))
        : typeof value === "string"
          ? normalizeMoneyValue(value)
          : null;

    if (normalizedValue && !isNegativeMoneyValue(normalizedValue)) {
      return normalizedValue;
    }
  }

  return null;
}

function addMoneyStrings(first: string, second: string) {
  const firstCents = moneyToCents(first);
  const secondCents = moneyToCents(second);
  const totalCents = firstCents + secondCents;
  const sign = totalCents < 0 ? "-" : "";
  const absoluteCents = Math.abs(totalCents);
  const whole = Math.floor(absoluteCents / 100);
  const fraction = String(absoluteCents % 100).padStart(2, "0");

  return `${sign}${whole}.${fraction}`;
}

function moneyToCents(value: string) {
  const [wholePart, fractionPart = "00"] = value.replace("-", "").split(".");
  const sign = value.startsWith("-") ? -1 : 1;

  return sign * (Number(wholePart) * 100 + Number(fractionPart.padEnd(2, "0")));
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    "type" in value &&
    "text" in value &&
    typeof value.name === "string" &&
    typeof value.size === "number" &&
    typeof value.type === "string" &&
    typeof value.text === "function"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatMegabytes(bytes: number) {
  return `${bytes / (1024 * 1024)} MB`;
}

function formatList(values: readonly string[]) {
  return values.map((value) => `\`${value}\``).join(", ");
}
