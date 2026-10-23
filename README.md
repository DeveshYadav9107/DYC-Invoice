# InvoiceFlow — AI-Powered Invoice Verification & CSV Export

[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://vitejs.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](https://expressjs.com/)
[![Database](https://img.shields.io/badge/Database-Neon%20PostgreSQL-00E599.svg)](https://neon.tech/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748.svg)](https://www.prisma.io/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-Vitest%2012%2F12%20Passing-success.svg)](https://vitest.dev/)

**InvoiceFlow** is an enterprise-grade invoice extraction, validation, and spreadsheet export web application. Users can upload invoice documents (PDF, PNG, JPEG, TIFF), let Azure AI extract and structure the data, automatically check business rules and mathematical integrity, review flagged discrepancies in a two-column editor, and download formula-safe CSV exports.

The application is structured as a decoupled architecture:
- **Frontend**: Single-page application built with **React**, **Vite**, **React Router**, **Tailwind CSS**, **Motion for React**, and **Recharts**.
- **Backend**: REST API built with **Node.js**, **Express**, **Prisma ORM**, **Neon PostgreSQL**, **Azure AI Document Intelligence**, and **Azure Blob Storage**.

---

## 🌟 Key Features

1. **Passwordless Email OTP Authentication**:
   - Secure 6-digit OTP delivery via SMTP (Nodemailer).
   - HMAC SHA-256 challenge hashing with attempt limiting (max 5) and resend cooldowns (60s).
   - Database-backed sessions with hashed session tokens stored in secure, HTTP-only cookies (`DYC_SESSION`).
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
| **Frontend** | React 19, Vite, React Router 7, Tailwind CSS, Lucide React, Motion for React, Recharts |
| **Backend** | Node.js (ES Modules), Express 4, Prisma ORM 6, REST Architecture |
| **Database** | PostgreSQL (Neon Serverless) + Prisma ORM 6 |
| **Authentication** | Passwordless Email OTP, Nodemailer, HTTP-only Secure Cookies |
| **Document AI** | Azure AI Document Intelligence (`@azure/ai-form-recognizer`) |
| **Storage** | Azure Blob Storage (`@azure/storage-blob`) with local disk dev fallback |
| **Spreadsheet** | `csv-stringify` with RFC 4180 BOM & DDE formula protection |
| **Testing** | Vitest (12 passing tests across Auth, Validation, CSV, and API routes) |

---

## 📁 Repository Structure

```
DYC-Invoice/
├── backend/                  # Node.js + Express REST API
│   ├── prisma/               # Prisma schema & database migrations
│   │   ├── schema.prisma     # Neon PostgreSQL schema
│   │   └── seed.mjs          # Database seed script
│   ├── src/
│   │   ├── controllers/      # Route controllers (auth, invoices, exports, etc.)
│   │   ├── middleware/       # Auth, error, upload, rate limit middleware
│   │   ├── routes/           # Express routers (/api/auth, /api/invoices, etc.)
│   │   ├── services/         # Business logic (Azure AI, storage, CSV, validation)
│   │   ├── utils/            # Prisma client, API responses, env helpers
│   │   ├── app.js            # Express app configuration & middleware
│   │   └── server.js         # HTTP server entry point (port 5000)
│   ├── tests/                # Vitest unit & integration test suites
│   ├── render.yaml           # Render backend deployment configuration
│   └── package.json
│
├── frontend/                 # React + Vite Single-Page Application
│   ├── src/
│   │   ├── api/              # Centralized fetch API client with credentials
│   │   ├── components/
│   │   │   ├── dashboard/    # ActivityChart, ValidationChart, DashboardActions
│   │   │   ├── exports/      # CreateExportButton, ExportDownloadButton
│   │   │   ├── invoices/     # InvoiceReviewForm, ExportButtons, Action bars
│   │   │   ├── layout/       # Sidebar, TopNav, DashboardShell
│   │   │   ├── settings/     # EditSettingsModal
│   │   │   └── ui/           # Button, Card, Badge, Modal, EmptyState, Icon
│   │   ├── context/          # AuthContext (user session, login, logout)
│   │   ├── pages/            # Page views (Auth, Dashboard, Invoices, Upload, Review, etc.)
│   │   │   └── admin/        # AdminOverview, AdminUsers, AdminOrganizations
│   │   ├── routes/           # AppRoutes with ProtectedRoute & AdminRoute guards
│   │   ├── utils/            # Formatting helpers (currency, dates, file sizes)
│   │   ├── App.jsx           # Root router wrapper
│   │   ├── main.jsx          # DOM entry point
│   │   └── index.css         # Tailwind & theme styles
│   ├── vercel.json           # Vercel deployment & rewrite configuration
│   └── package.json
│
├── package.json              # Monorepo root scripts (runs backend & frontend concurrently)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Neon PostgreSQL Database** (already configured in `.env`)

### 1. Installation

Install dependencies across the workspace:

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && npm run prisma:generate && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure Environment Variables

The backend requires a `.env` file inside `backend/.env` (copied from `.env.local` or based on `backend/.env.example`):

```ini
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=your-32-character-session-secret

# Database
DATABASE_URL="postgresql://user:pass@ep-example.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Azure AI Document Intelligence
DOCUMENT_INTELLIGENCE_ENDPOINT="https://example.cognitiveservices.azure.com/"
DOCUMENT_INTELLIGENCE_KEY="your-key"

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=example;AccountKey=...;EndpointSuffix=core.windows.net"
AZURE_STORAGE_CONTAINER_NAME="invoices"

# SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-password"
SMTP_FROM="InvoiceFlow <noreply@invoiceflow.com>"
```

### 3. Run Locally

To run both the backend API and frontend concurrently:

```bash
npm run dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

You can also run them independently in separate terminals:

```bash
# Terminal 1: Run Express Backend
npm run dev:backend

# Terminal 2: Run React Frontend
npm run dev:frontend
```

---

## 🧪 Testing

Run backend unit and integration test suites:

```bash
npm run test:backend
```

Tests cover:
- OTP generation, validation, attempt tracking, and session token creation
- Arithmetic cross-validation with rounding tolerance
- Formula injection defense and CSV formatting
- Express API authentication guards and health check endpoints

---

## 🚢 Production Deployment

### Backend on Render

1. Create a **Web Service** on [Render](https://render.com).
2. Connect your repository.
3. Configure settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run prisma:generate`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
4. Set the environment variables in the Render Dashboard (matching `backend/.env.example`).
   - Set `FRONTEND_URL` to your Vercel deployment URL (e.g. `https://dyc-invoice.vercel.app`).
   - Set `NODE_ENV=production`.

Alternatively, deploy using the included `backend/render.yaml` blueprint.

### Frontend on Vercel

1. Import your repository into [Vercel](https://vercel.com).
2. Set the **Root Directory** to `frontend`.
3. Framework Preset: **Vite**.
4. In Environment Variables, set:
   - `VITE_API_BASE_URL`: URL of your Render backend (e.g. `https://dyc-invoice-api.onrender.com`).
5. The included `frontend/vercel.json` automatically manages client-side SPA routing rewrites.
