# Data Flow

## Reference Import Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant Validator
    participant Prisma
    participant DB
    User->>UI: Select GSTR-2B JSON
    UI->>API: POST /api/reference-imports multipart
    API->>Validator: Validate file metadata and parse JSON
    Validator-->>API: Normalized reference invoices
    API->>Prisma: Transaction
    Prisma->>DB: Deactivate prior active import for period
    Prisma->>DB: Insert ReferenceImport and ReferenceInvoice rows
    API-->>UI: Created import
```

Implementation: `src/app/api/reference-imports/route.ts`.

## Purchase Register Upload Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant Validator
    participant Reconciler
    participant DB
    User->>UI: Select CSV and reference import
    UI->>API: POST /api/reconciliation-batches multipart
    API->>Validator: Validate CSV headers and rows
    API->>DB: Load reference invoices
    API->>Reconciler: Compare purchase rows
    Reconciler-->>API: MATCHED/MISMATCHED/ERROR rows
    API->>DB: Insert UploadBatch and ReconciliationRow rows
    API-->>UI: Created batch
```

## Reconciliation Flow

The current reconciliation flow is synchronous during upload:

1. Reference invoices are loaded for the selected `referenceImportId`.
2. They are indexed by supplier GSTIN and normalized invoice number.
3. Each CSV row is validated independently.
4. Valid rows are compared to the best reference candidate.
5. Invalid rows become `ERROR`; missing or differing reference data becomes `MISMATCHED`; exact compared values become `MATCHED`.

## Batch Detail Retrieval

- Page: `src/app/(app)/reconciliations/[batchId]/page.tsx`.
- API summary: `src/app/api/reconciliation-batches/[batchId]/route.ts`.
- Status API: `src/app/api/reconciliation-batches/[batchId]/status/route.ts`.
- Results API: `src/app/api/reconciliation-batches/[batchId]/results/route.ts`.

## Dashboard / History Retrieval

- Dashboard reads counts and recent imports/batches for the authenticated business.
- History pages fetch the latest 25 records.
- Reference import detail uses `Promise.all` for independent related-data queries.
