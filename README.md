# DataPilot — AI Data Analysis Workspace

**Version:** v1.0.0  
**Status:** Release Candidate (v1.0 Release Ready)

---

## 1. Product Description

**DataPilot** is a production-grade, full-stack AI Data Analysis Workspace designed for data engineers, analysts, and operators. It unifies the entire analytical lifecycle into a single high-performance interface:
> **One workspace for Data Import → Cleaning → Transformation → SQL → Analysis → Visualization → Dashboard → AI assistance.**

DataPilot bridges the gap between raw, messy data files and executive-ready dashboards without forcing users to switch between disconnected ETL tools, SQL clients, and BI suites.

---

## 2. Core Value Proposition

- **Zero-Friction Ingestion:** Instantly import CSV, XLSX, and JSON files with automatic type inference, date parsing, and Unified Data Layer registration.
- **Deterministic & AI-Powered Cleaning:** Inspect data quality scores, surface anomalies, and apply non-destructive transformation pipelines with step ordering, undo/redo, and lineage tracing.
- **Secure SQL Workspace:** Query SQLite, PostgreSQL, MySQL, SQL Server, and Oracle via a secure server-side SQL validator that blocks dangerous DDL/DML statements (`DROP`, `ALTER`, `DELETE`, injection attacks) while enabling robust CTEs, window functions, and joins.
- **Executive Visualization & Dashboards:** Transform query results into interactive charts (Bar, Line, Pie, Area, Scatter, KPI) and multi-widget dashboards equipped with global cross-filtering.
- **Enterprise Reports & Collaboration:** Share workspaces with granular RBAC (Owner, Admin, Editor, Analyst, Viewer), capture immutable snapshots, audit logs, and activity streams.

---

## 3. Main Capabilities

1. **Unified Data Layer:** Ingest and normalize files and database tables into an interactive, queryable data store.
2. **Data Quality & Profiling:** Automated missing value detection, outlier identification (IQR & Z-Score), duplicate inspection, and data health scoring.
3. **Data Cleaning Engine:** 25+ non-destructive transformations (Rename, Drop, Split, Merge, Impute, Text Clean, Case Normalization, Outlier Removal).
4. **Interactive SQL Editor:** Multi-tab editor with schema discovery, table/column autocomplete, query performance analyzer (explain plan), saved queries, and parameterized snippets.
5. **Visualization Studio:** Drag-and-drop charting with aggregation, grouping, and count modes.
6. **Dashboard Builder:** Multi-widget layout grid with global filters and real-time refresh.
7. **AI Assistant:** Server-side Google Gemini integration for smart SQL generation, query explanation, and cleaning recommendations.
8. **Export Security:** Multi-format exports (CSV, Excel, JSON, Markdown, HTML, PDF) with built-in formula injection neutralization.

---

## 4. Architecture Overview

DataPilot follows a robust full-stack architecture:
- **Frontend:** React 18+, TypeScript, Tailwind CSS, Lucide icons, Recharts, and React Flow (@xyflow/react).
- **Backend:** Node.js 22+, Express, TypeScript, database adapters (`node:sqlite`, `pg`), and server-side Gemini API proxy.
- **Persistence & Migrations:** SQLite / PostgreSQL backed by an atomic version-controlled migration runner.

---

## 5. Supported Databases & Imports

- **Databases:** PostgreSQL (Live), SQLite (Live & Local), MySQL (Code-level / Configurable), Microsoft SQL Server (Code-level / Configurable), Oracle (Code-level / Configurable).
- **Import Formats:** CSV, Excel (.xlsx/.xls), JSON (flat or nested arrays).

---

## 6. Quick Start & Local Development

### Prerequisites
- Node.js `>=22.5.0`
- npm `>=10.0.0`

### Installation & Run

```bash
# 1. Clone the repository
git clone https://github.com/datapilot/datapilot.git
cd datapilot

# 2. Install dependencies
npm ci

# 3. Configure environment variables
cp .env.example .env

# 4. Start development server (boots Express backend & Vite on port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 7. Docker Deployment

DataPilot provides a multi-stage production Dockerfile and `docker-compose.yml`:

```bash
# Build and start services via Docker Compose
docker compose up --build -d

# Check health endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/ready
```

---

## 8. Testing & Quality Assurance

DataPilot features an exhaustive test suite covering all functional modules, security validators, adapters, and migration runners:

```bash
# Run full test suite (500+ tests)
npm test

# Run type check
npm run lint

# Run production build
npm run build
```

---

## 9. Documentation Index

- [Getting Started Guide](docs/GETTING_STARTED.md)
- [Production Deployment Guide](docs/PRODUCTION_DEPLOYMENT.md)
- [Admin Operations Runbook](docs/OPERATIONS_RUNBOOK.md)
- [User Guide & Workflows](docs/USER_GUIDE.md)
- [Demo Workflow Guide](docs/DEMO_WORKFLOW.md)
- [Release Checklist](docs/RELEASE_CHECKLIST.md)
- [Changelog](CHANGELOG.md)
- [Licensing Notice](docs/LICENSE_NOTICE.md)

---

## 10. License Notice

Commercial distribution and licensing terms are pending final review. See [docs/LICENSE_NOTICE.md](docs/LICENSE_NOTICE.md) for details.
