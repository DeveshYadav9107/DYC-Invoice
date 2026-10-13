# InvoiceFlow — AI-Powered Invoice Verification & CSV Export SaaS

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black.svg)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748.svg)](https://www.prisma.io/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-Vitest%20Passed-success.svg)](https://vitest.dev/)

**InvoiceFlow** is an enterprise-grade invoice extraction, validation, and spreadsheet export web application. Users can upload invoice documents (PDF, PNG, JPEG, TIFF), let Azure AI extract and structure the data, automatically check business rules and mathematical integrity, review flagged discrepancies in a two-column editor, and download formula-safe CSV exports.

---

## 🌟 Key Features

1. **Passwordless Email OTP Authentication**:
   - Secure 6-digit OTP delivery via SMTP (Nodemailer).
   - HMAC SHA-256 challenge hashing with attempt limiting (max 5) and resend cooldowns (60s).
   - Database-backed sessions with hashed session tokens stored in secure, HTTP-only cookies.
   - Development fallback: logs verification codes directly to the server console if SMTP credentials are not yet configured.

2. **Azure AI Document Intelligence Extraction**:
   - Uses Microsoft's `prebuilt-invoice` model to extract key-value pairs, dates, tax numbers, monetary values, and line item tables.
   - Fallback simulation in local development allows immediate testing before adding Azure API keys.

3. **Multi-Tenant Organization Isolation**:
   - Role-based authorization (`ADMIN` and `CLIENT`).
   - Every invoice, audit record, and export batch is strictly scoped to the user's organization.

4. **Multi-Tier Validation & Arithmetic Engine**:
   - **Required Fields**: Vendor name, invoice number, issue date, and total amount.
   - **Decimal Precision**: Header arithmetic cross-check (`subtotal + taxAmount - discountAmount === totalAmount`) within $0.02 rounding tolerance.
   - **Line Items Check**: Sum of line item amounts verified against header subtotal.
   - **Duplicate Detection**: Flags identical vendor and invoice numbers within the same tenant organization.
   - **Date Sanity**: Warns if payment due date precedes issue date.

5. **Two-Column Review Workflow**:
   - Left side: Live document viewer for PDFs (`<iframe>`) and images (`<img>`) with secure file streaming.
   - Right side: Discrepancy alert cards, editable header fields, monetary breakdown, and line item tables.
   - Saving corrections automatically triggers revalidation and clears resolved issues.

6. **Formula-Safe CSV Export**:
   - **Strict Gate**: Only invoices with status `VALIDATED` are eligible for CSV export.
   - **Formula Injection Defense**: Neutralizes CSV formula execution attempts (`=`, `+`, `-`, `@`, `\t`, `\r`) by prepending single quotes (`'`).
   - Includes UTF-8 BOM for seamless Microsoft Excel compatibility.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS, Lucide React, Motion |
| **Backend** | Next.js Route Handlers (JavaScript / JSX only, no TypeScript) |
| **Database** | PostgreSQL (Neon Serverless) + Prisma ORM 6 |
| **Authentication** | Passwordless Email OTP, Nodemailer, HTTP-only Lax Cookies |
| **Document AI** | Azure AI Document Intelligence (`@azure/ai-form-recognizer`) |
| **Storage** | Azure Blob Storage (`@azure/storage-blob`) with local disk dev fallback |
| **Spreadsheet** | `csv-stringify` with RFC 4180 BOM & DDE formula protection |
| **Testing** | Vitest 5 |

---

## 📁 Project Structure

```
DYC-Invoice/
├── .env.example              # Environment variables template
├── prisma/
│   ├── schema.prisma         # Multi-tenant PostgreSQL database schema
│   └── seed.mjs              # Seed script for initial organization & users
├── src/
│   ├── app/
│   │   ├── layout.js         # Root HTML shell & fonts
│   │   ├── globals.css       # Design system styles
│   │   ├── page.js           # Smart redirect to /login or /dashboard
│   │   ├── (auth)/
│   │   │   ├── login/page.js # Split-screen OTP login interface
│   │   │   └── signup/complete/page.js # Onboarding profile completion
│   │   ├── (dashboard)/
│   │   │   ├── layout.js     # Protected dashboard shell & session gate
│   │   │   ├── dashboard/page.js       # Live KPI metrics & recent invoices
│   │   │   ├── invoices/page.js        # Filterable invoices directory
│   │   │   ├── invoices/upload/page.js # Drag-and-drop file upload
│   │   │   ├── invoices/[id]/page.js   # Two-column document review page
│   │   │   ├── exports/page.js         # CSV export generator & history
│   │   │   ├── settings/page.js        # Tenant profile & integration check
│   │   │   └── admin/                  # Superadmin tenant telemetry
│   │   └── api/
│   │       ├── auth/                   # request-otp, verify-otp, logout, me
│   │       ├── invoices/               # Upload, list, update, file preview
│   │       └── exports/                # CSV generation & streaming downloads
│   ├── components/
│   │   ├── ui/               # Badge, Button, Card, EmptyState
│   │   ├── layout/           # Sidebar, TopNav, DashboardShell
│   │   ├── invoices/         # InvoiceReviewForm
│   │   └── exports/          # CreateExportButton
│   ├── lib/
│   │   ├── auth.js           # Session management & token hashing
│   │   ├── prisma.js         # Prisma client singleton
│   │   ├── rate-limit.js     # In-memory sliding window rate limiter
│   │   ├── env.js            # Environment validation module
│   │   └── utils.js          # Currency, dates, file sizes, slugs
│   └── services/
│       ├── otp.js            # Cryptographic OTP generation & verification
│       ├── email.js          # Nodemailer email dispatcher
│       ├── storage.js        # Azure Blob Storage + local storage fallback
│       ├── invoiceValidation.js # Business rules & Decimal arithmetic engine
│       ├── invoiceProcessor.js  # Pipeline coordinator
│       └── csvExport.js      # Formula-protected CSV export generator
├── tests/                    # Automated Vitest unit test suites
└── vitest.config.mjs         # Vitest configuration
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20 or higher
- **PostgreSQL**: Neon account (or local PostgreSQL database)

### 2. Environment Configuration
Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your configuration values:
- `DATABASE_URL` & `DIRECT_URL`: Connection string from Neon Console
- `AUTH_SECRET`: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- `DOCUMENT_INTELLIGENCE_ENDPOINT` & `KEY`: From Azure Portal (optional in dev)
- `AZURE_STORAGE_CONNECTION_STRING`: From Azure Storage Account (optional in dev)
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: Your email provider credentials (optional in dev)

> **Development Note**: If Azure AI or SMTP credentials are not yet supplied, InvoiceFlow operates in local dev mode. Verification codes are printed directly to the terminal, documents are stored in `.storage/invoices/`, and sample extraction structures are provided.

### 3. Database Migration & Seeding
Push the schema to your Neon database:

```bash
npx prisma db push
```

Populate initial seed organization and accounts:

```bash
npx prisma db seed
```

### 4. Running the Dev Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the application.

### 5. Running Automated Tests

```bash
npm run test
```

### 6. Production Build

```bash
npm run build
npm start
```

---

## 🔒 Security Best Practices

- **Zero Plaintext Secrets**: OTP codes are hashed via HMAC-SHA256 with server secrets before storage. Raw session tokens are never stored in the database.
- **Tenant Isolation**: Queries strictly filter by `organizationId`. Invoices cannot be viewed across tenant boundaries.
- **Safe CSV Generation**: All exported cells starting with sensitive macro symbols (`=`, `+`, `-`, `@`) are escaped to prevent spreadsheet execution vulnerabilities.
- **Rate Limiting**: Authentication endpoints are rate-limited per email and IP to guard against brute-force attempts.
