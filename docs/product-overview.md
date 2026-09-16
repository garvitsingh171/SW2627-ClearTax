# Product Overview

## Problem

GST teams often maintain purchase invoices in an internal Purchase Register while supplier-reported invoices appear in GSTR-2B. Manual comparison is slow and error-prone because invoice numbers, supplier GSTINs, dates, taxable values, GST components, and totals can differ across the two datasets.

## Product Goal

This implementation demonstrates a ClearTax-inspired GST reconciliation workspace. A signed-in business user can import GSTR-2B-like JSON reference data, upload a Purchase Register CSV, create persisted reconciliation batches, and review matched, mismatched, and error rows.

## Target Users

Implemented or implied user types:

- Business owner/accountant using one authenticated business context.
- Evaluator/demo user using the seeded demo workspace from `prisma/seed.ts`.

Role names `OWNER`, `ADMIN`, and `ACCOUNTANT` exist in `src/lib/auth-context.ts`, but the current auth implementation assigns `OWNER` only.

## Core Workflow

```text
User
  -> Sign in or create account
  -> Resolve business context from session
  -> Import GSTR-2B JSON reference data
  -> Upload Purchase Register CSV against a reference import
  -> Validate file, headers, rows, GSTINs, dates, money
  -> Create UploadBatch and ReconciliationRow records
  -> Classify rows as MATCHED, MISMATCHED, or ERROR
  -> View dashboard, history, batch detail, and reference import detail
```

## Main Features

### Implemented

- Credentials sign-in, signup, JWT session context, and optional Google OAuth provider when env vars are configured.
- Protected App Router workspace with dashboard, reconciliation history, batch detail, reference import list, and reference import detail pages.
- GSTR-2B JSON multipart upload and JSON metadata creation through `src/app/api/reference-imports/route.ts`.
- Purchase Register CSV multipart upload and JSON metadata batch creation through `src/app/api/reconciliation-batches/route.ts`.
- CSV row validation and inline reconciliation against persisted `ReferenceInvoice` rows.
- Cursor-paginated result API in `src/app/api/reconciliation-batches/[batchId]/results/route.ts`.
- Centralized API response helpers, request IDs, and Pino structured logging.
- Prisma migrations and deterministic demo seed data.

### Partially Implemented

- Lifecycle statuses include queued/processing states, but multipart uploads currently complete synchronously inside the route handler.
- `storageObjectKey` fields and GCP environment variables exist, but uploaded files are not stored in Cloud Storage.
- `UNMATCHED` exists in the enum, but the implemented upload path records missing reference invoices as `MISMATCHED` with `REFERENCE_NOT_FOUND`.

### Planned

- Durable Cloud Tasks background processing.
- Cloud Storage-backed raw file persistence.
- GitHub Actions CI/CD and deployed GCP infrastructure.
- Search/filter/export workflows and advanced analytics.
