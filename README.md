# ClearTax Bulk Invoice Processing

A bulk invoice upload and processing system built as part of the **Kalvium Simulated Work** program.

The application allows users to upload invoice data using a CSV file, process invoices in the background, track processing progress, and view the result of each invoice independently.

> **Current Status:**  Under Development

---

## Problem Statement

ClearTax wants a **bulk invoice upload system** where users can upload invoice data through a CSV file.

The system should:

* Process uploaded invoices in the background.
* Show the progress of invoice processing.
* Display processed invoices in a scrollable table.
* Mark invoices with a **Match** or **Mismatch** status.
* Continue processing remaining invoices even if an individual row fails.
* Display errors for failed rows individually.

---

## Project Goal

The goal is to provide a reliable bulk-processing experience where a large number of invoices can be handled without requiring users to upload or process invoices individually.

A failure in one invoice should not affect the processing of other invoices.

### Expected Flow

```text
Upload CSV
    ↓
Validate File
    ↓
Create Processing Batch
    ↓
Process Invoice Rows in Background
    ↓
Validate Each Row
    ↓
Match / Mismatch / Failed
    ↓
Update Processing Progress
    ↓
Display Results
```

---

## Core Features

### CSV Upload

Users will be able to upload a CSV file containing multiple invoice records.

The system will validate:

* File type
* Required CSV columns
* Individual invoice data
* Invalid or missing values

---

### Background Processing

Invoice processing will happen in the background so that the user does not need to wait for the complete CSV to finish processing before receiving a response.

The system will track:

* Total invoices
* Processed invoices
* Matched invoices
* Mismatched invoices
* Failed invoices

---

### Invoice Status

Each processed invoice can have one of the following results:

#### `MATCH`

The uploaded invoice successfully matches the corresponding reference/system invoice.

#### `MISMATCH`

The invoice is valid but one or more values do not match the reference/system data.

#### `FAILED`

The invoice row could not be processed because of invalid or missing data or another processing error.

---

### Row-Level Error Handling

Every CSV row will be processed independently.

For example:

```text
Row 1 → MATCH
Row 2 → MATCH
Row 3 → FAILED
Row 4 → MISMATCH
Row 5 → MATCH
```

Failure of **Row 3 will not stop Rows 4 and 5 from being processed**.

Each failed row will contain an appropriate error message explaining what went wrong.

---

### Processing Progress

While processing is running, the user will be able to see progress such as:

```text
Processing invoices...

63%

315 / 500 processed

Matched:      240
Mismatched:    61
Failed:        14
```

---

### Invoice Results Table

Processed invoices will be displayed in a scrollable table.

Example:

| Invoice |  Amount | Status   | Details         |
| ------- | ------: | -------- | --------------- |
| INV-001 | ₹15,000 | MATCH    | —               |
| INV-002 |  ₹8,200 | MISMATCH | Amount mismatch |
| INV-003 |       — | FAILED   | Invalid amount  |
| INV-004 | ₹12,500 | MATCH    | —               |

The final implementation may also provide filters for:

* All
* Matched
* Mismatched
* Failed

---

## Match / Mismatch Rules

The exact business rules and reference data used to determine whether an invoice is a **Match** or **Mismatch** are currently being finalized.

Before implementation, the team will define:

* Which field identifies an invoice
* What existing/reference data invoices are compared against
* Which fields participate in reconciliation
* What conditions result in `MATCH`
* What conditions result in `MISMATCH`

---

## Planned Development

The project will be developed incrementally.

```text
Project Setup
    ↓
CSV Format & Sample Data
    ↓
CSV Upload
    ↓
CSV Validation
    ↓
Invoice Processing
    ↓
Match / Mismatch Logic
    ↓
Row-Level Error Handling
    ↓
Background Processing
    ↓
Progress Tracking
    ↓
Results Table
    ↓
Testing & Documentation
```

---

## Tech Stack

> The final technology choices will be updated as development progresses.

### Frontend

* To be finalized

### Backend

* To be finalized

### Database

* To be finalized

### Background Processing

* To be finalized

---

## Repository Structure

The project structure will be documented once the initial application setup is completed.

```text
SW2627-ClearTax/
├── README.md
└── ...
```

---

## Getting Started

The project is currently under active setup.

### Clone the Repository

```bash
git clone <repository-url>
cd SW2627-ClearTax
```

### Install Dependencies

```bash
npm install
```

### Configure Environment

Create a local environment file from the committed example:

```bash
cp .env.example .env
```

Replace the placeholder values in `.env` with local development values. At minimum, local development requires `DATABASE_URL` so Prisma can connect to PostgreSQL and `AUTH_SECRET` so Auth.js can encrypt JWT-backed sessions. Use `APP_URL="http://localhost:3000"` and `NEXTAUTH_URL="http://localhost:3000"` for the local Next.js app unless you run it on a different origin.

Apply the committed Prisma migrations before seeding or running application workflows that use the database:

```bash
npx prisma migrate dev
```

See [`docs/database-migrations.md`](docs/database-migrations.md) for the full schema-evolution workflow, including production deployment with committed migrations.

After applying migrations, seed the local demo account and business:

```bash
npx prisma db seed
```

The seed creates a local demo user (`demo@cleartax.local`) for credentials sign-in. Its demo password is defined only in `prisma/seed.ts`, and the database stores only a bcrypt hash.

The `.env.example` file documents the environment-variable contract and contains placeholder values only. Real `.env` files must never be committed because they can contain database credentials, authentication secrets, service-account paths, or other sensitive configuration.

### Environment Variables

| Variable | Purpose | Local | Production | Exposure |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by Prisma | Required | Required | Server only |
| `APP_URL` | Canonical application origin for server-side redirects, callbacks, and links | Required | Required | Server only |
| `NEXTAUTH_URL` | Canonical Auth.js / NextAuth origin | Required | Required | Server only |
| `AUTH_SECRET` | Secret used by Auth.js to encrypt JWT-backed sessions | Required | Required | Server only |
| `GCP_PROJECT_ID` | Google Cloud project identifier for deployed infrastructure | Planned | Required | Server only |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional local path for Google Application Default Credentials | Optional | Platform-managed or optional | Server only |
| `GCP_STORAGE_BUCKET` | Private Cloud Storage bucket for uploaded CSV and GSTR-2B files | Planned | Required when storage is enabled | Server only |
| `GCP_TASKS_LOCATION` | Google Cloud region for Cloud Tasks | Planned | Required when background tasks are enabled | Server only |
| `GCP_TASKS_QUEUE` | Cloud Tasks queue for background reconciliation work | Planned | Required when background tasks are enabled | Server only |

No current environment variable is browser-safe. Do not add the `NEXT_PUBLIC_` prefix to database, authentication, GCP, storage, or task-queue values because `NEXT_PUBLIC_*` values are exposed to client-side JavaScript.

### Production Configuration

Production values must be provided by the deployment platform or cloud runtime environment, not committed to Git. Production configuration is expected to include the PostgreSQL/Cloud SQL database connection, application URL, authentication secret, GCP project, private Cloud Storage bucket, and Cloud Tasks queue settings.

Do not commit service-account JSON files, private keys, API tokens, database passwords, or production `.env` files.

---

## Git Workflow

This project follows a branch-based GitHub workflow.

### Never work directly on `main`

Start every task from an updated `main` branch.

```bash
git checkout main
git pull origin main
```

Create a separate branch for the task:

```bash
git checkout -b feat/<feature-name>
```

Examples:

```text
feat/csv-upload
feat/background-processing
feat/progress-tracking
feat/invoice-results-table
fix/row-processing-error
docs/update-readme
```

### Commit Convention

We follow Conventional Commits.

Examples:

```bash
git commit -m "feat: add CSV invoice upload"
```

```bash
git commit -m "feat: add invoice processing progress"
```

```bash
git commit -m "fix: continue processing after row failure"
```

```bash
git commit -m "docs: update project setup instructions"
```

---

## Pull Request Workflow

Every change should follow:

```text
GitHub Issue
    ↓
Individual Branch
    ↓
Development
    ↓
Commit
    ↓
Push
    ↓
Pull Request
    ↓
Teammate Review
    ↓
Approval
    ↓
Merge into main
```

Each Pull Request should contain:

### What

What was implemented or changed.

### Why

Why the change was required.

### Linked Issue

```text
Closes #<issue-number>
```

### How to Test

Clear steps for reviewing and testing the implementation.

---

## Team

**Team:** Team 07
**Organization:** KalviumCommunity

| Member                           | Responsibility        |
| -------------------------------- | --------------------- |
| Garvit Singh (`@garvitsingh171`) | Backend Developer     |
| Edha Singh (`@edhasingh125`)     | Frontend Developer    |

> Responsibilities will evolve as issues are assigned during development.

---

## Current Milestone

The initial milestone is to build a small end-to-end workflow capable of processing a sample CSV containing a mixture of:

```text
MATCH
MISMATCH
FAILED
```

The system should successfully process every row independently and correctly report the final batch progress.

---

## Project Status

🚧 **Development in Progress**

The README will continue to evolve along with the implementation, decisions, setup instructions, API documentation, and testing strategy.
