# ClearTax Engineering Documentation

ClearTax Bulk Invoice Reconciliation is a Next.js application for importing GSTR-2B reference data, uploading Purchase Register CSV files, reconciling invoices, and reviewing persisted batch results.

This documentation suite is derived from the current repository implementation. It is intended for final showcase preparation, technical presentation, viva answers, and developer hand-off.

## Documents

| # | Document | Purpose |
| --- | --- | --- |
| 01 | [Product Overview](./01-product-overview.md) | Product problem, goals, users, features |
| 02 | [System Architecture](./02-system-architecture.md) | Overall architecture and runtime layers |
| 03 | [HLD](./03-hld.md) | Major components and boundaries |
| 04 | [LLD](./04-lld.md) | Route-level implementation paths |
| 05 | [Database Design](./05-database-design.md) | Prisma models, relations, indexes |
| 06 | [Data Flow](./06-data-flow.md) | Reference import, upload, batch, dashboard flows |
| 07 | [Reconciliation Engine](./07-reconciliation-engine.md) | Matching rules and row classification |
| 08 | [File Upload Processing](./08-file-upload-processing.md) | File contracts, parsing, validation |
| 09 | [API Design](./09-api-design.md) | API endpoints, auth, input, output |
| 10 | [Authentication & Authorization](./10-authentication-authorization.md) | NextAuth, JWT session, business ownership |
| 11 | [Error Handling & Validation](./11-error-handling-validation.md) | Error format, validation, status mapping |
| 12 | [Performance & Scalability](./12-performance-scalability.md) | Current optimizations and future scaling |
| 13 | [Security Design](./13-security-design.md) | Implemented safeguards and threats |
| 14 | [Deployment & Infrastructure](./14-deployment-infrastructure.md) | Environment, migrations, missing CI/GCP config |
| 15 | [Engineering Decisions](./15-engineering-decisions.md) | ADR-style decision summaries |
| 16 | [Product Workflows](./16-product-workflows.md) | User journeys and evaluator-friendly flows |
| 17 | [Testing & Quality](./17-testing-quality.md) | Tooling, seed data, gaps |
| 18 | [Observability & Logging](./18-observability-logging.md) | Pino logging and request IDs |
| 19 | [Limitations & Future Scope](./19-limitations-future-scope.md) | Current gaps and next steps |
| 20 | [Showcase Guide](./20-showcase-guide.md) | Demo sequence and hand-offs |
| 21 | [Viva Question Bank](./21-viva-question-bank.md) | Project-specific Q&A |

## Recommended Reading Order

Read 01, 02, 05, 07, 09, 10, 15, then 20 and 21. Use 04, 06, 08, 11, 12, 13, 17, and 18 for deeper technical follow-up.

## For Product Showcase

Start with [Product Overview](./01-product-overview.md), [Product Workflows](./16-product-workflows.md), [Reconciliation Engine](./07-reconciliation-engine.md), [Database Design](./05-database-design.md), [Engineering Decisions](./15-engineering-decisions.md), [Limitations & Future Scope](./19-limitations-future-scope.md), and [Showcase Guide](./20-showcase-guide.md).

## For Technical Viva

Prioritize [System Architecture](./02-system-architecture.md), [HLD](./03-hld.md), [LLD](./04-lld.md), [Database Design](./05-database-design.md), [API Design](./09-api-design.md), [Authentication & Authorization](./10-authentication-authorization.md), [Reconciliation Engine](./07-reconciliation-engine.md), [Engineering Decisions](./15-engineering-decisions.md), and [Viva Question Bank](./21-viva-question-bank.md).
