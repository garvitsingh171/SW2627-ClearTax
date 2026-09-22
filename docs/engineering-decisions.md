# Engineering Decisions

## Decision: Use Next.js As One Full-Stack Codebase

### Context

The app needs protected UI pages, upload endpoints, auth callbacks, and database-backed views.

### Options Considered

Separate frontend/backend services, or a single Next.js app.

### Decision

Use Next.js 16 App Router for pages and route handlers.

### Why We Chose It

It keeps a two-person MVP compact. Server components and route handlers can share validation, auth, Prisma access, and TypeScript types.

### Benefits

- Fewer services to run.
- Direct server-side page data fetching.
- Clear App Router file structure.

### Trade-offs

- Heavy reconciliation work can block request handlers until background processing is implemented.

### When We Might Reconsider

If reconciliation needs independent scaling, queue workers, or long-running compute outside the web server.

## Decision: Use PostgreSQL + Prisma

### Context

The domain has clear relationships between users, businesses, imports, invoices, batches, and rows.

### Decision

Use PostgreSQL with Prisma migrations and Prisma Client.

### Benefits

- Relational integrity and foreign keys.
- Decimal money fields.
- Version-controlled schema.
- Type-safe query layer.

### Trade-offs

- Prisma migrations must be managed carefully.
- Generated client and adapter configuration add setup overhead.

## Decision: Scope Data By Business Context

### Context

Users should only access their own business reconciliation data.

### Decision

Store `businessId` in the JWT session and filter private queries by it.

### Benefits

- Consistent tenant boundary.
- Simple route-level authorization.

### Trade-offs

- Current session chooses the first business only; multi-business switching is not implemented.

## Decision: Persist Reconciliation Results

### Context

Dashboard, history, refresh, and detail pages need durable status and row data.

### Decision

Persist `UploadBatch` and `ReconciliationRow` rows.

### Benefits

- Results survive refresh.
- Batch history is simple to query.
- Mismatch/error details can be inspected later.

### Trade-offs

- More storage and indexes.
- Large uploads need future chunking/background processing.

## Decision: Use Decimal For Money

### Context

GST values require exact two-decimal comparisons.

### Decision

Use `Decimal(18, 2)` in Prisma/PostgreSQL and normalize uploaded strings to two decimals.

### Benefits

- Avoids JavaScript floating-point drift in persisted values.
- Enables deterministic comparisons.

### Trade-offs

- Values need formatting before string comparison.

## Decision: Centralize API Responses And Logging

### Context

Frontend upload/login code needs predictable failures, and demos need traceable request IDs.

### Decision

Use `successResponse()`, `apiError()`, `handleApiError()`, and request logging helpers.

### Benefits

- Consistent frontend handling.
- `x-request-id` support.
- Safe generic 500 errors.

### Trade-offs

- Routes must remember to wrap completions through `completeApiRequest()`.

## Decision: Validate Files Before Persistence

### Context

Bad files should not create ambiguous records.

### Decision

Reject invalid files at metadata/content level before creating records. For CSV row-level issues, persist row errors so the rest of the batch can still complete.

### Benefits

- Clear file-level vs row-level failure behavior.
- Demonstrates fault isolation.

### Trade-offs

- File-level errors reject the whole upload.

## Decision: Use Cursor Pagination For Results API

### Context

Reconciliation results can grow beyond a comfortable single response.

### Decision

Implement cursor pagination in the results API.

### Benefits

- Stable API for large row sets.
- Avoids offset cost at scale.

### Trade-offs

- Current batch detail UI still shows a simple first-page table.
