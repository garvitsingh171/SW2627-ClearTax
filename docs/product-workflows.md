# Product Workflows

## First-Time User Flow

```mermaid
flowchart TD
    A[Open app] --> B[Create account]
    B --> C[Enter name, email, password, business legal name, GSTIN]
    C --> D[Signup API creates User and Business]
    D --> E[Credentials sign-in]
    E --> F[Protected dashboard]
```

## Reference Data Import Flow

```mermaid
flowchart TD
    A[Dashboard upload widget] --> B[Choose GSTR-2B mode]
    B --> C[Select JSON file]
    C --> D[POST /api/reference-imports]
    D --> E[Validate JSON and business GSTIN]
    E --> F[Persist ReferenceImport and ReferenceInvoice rows]
    F --> G[Open reference import detail]
```

## Purchase Register Upload Flow

```mermaid
flowchart TD
    A[Dashboard upload widget] --> B[Choose Purchase Register mode]
    B --> C[Select active reference import]
    C --> D[Select CSV file]
    D --> E[POST /api/reconciliation-batches]
    E --> F[Validate headers and rows]
    F --> G[Compare with reference invoices]
    G --> H[Persist batch and row results]
    H --> I[Open batch detail]
```

## Reconciliation Flow

Valid rows are compared against GSTR-2B reference invoices. Exact compared fields become `MATCHED`; valid rows with missing or differing reference data become `MISMATCHED`; malformed rows become `ERROR`.

## Batch Detail Flow

The user opens `/reconciliations/[batchId]`. The page verifies the batch UUID, requires a session, filters by the user's `businessId`, renders summary counters, shows linked reference import metadata, and lists up to 50 row results.

## History Flow

The user opens `/reconciliations` or `/reference-imports`. Each page loads the latest 25 records for the authenticated business and links to detail pages.

## Error Recovery Flow

```mermaid
flowchart TD
    A[Upload or page request fails] --> B{Error type}
    B -->|Validation| C[Show user-facing message]
    B -->|Auth| D[Redirect/login or 401]
    B -->|Database page load| E[Show temporary unavailable card where implemented]
    B -->|Unexpected API error| F[Return INTERNAL_ERROR and request id]
    C --> G[Fix file or fields and retry]
    E --> H[Refresh after DB recovers]
```
