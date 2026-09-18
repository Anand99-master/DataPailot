# DataPilot — AI Data Analysis Workspace

> A full-stack workspace for working with data from ingestion and quality analysis through SQL, visualization, dashboards, and AI-assisted analytics.

[![Version](https://img.shields.io/badge/version-1.0.0-informational)](https://github.com/Anand99-master/DataPailot)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.5.0-339933)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-see%20notice-lightgrey)](docs/LICENSE_NOTICE.md)

## Overview

**DataPilot** is a full-stack AI data analysis workspace built to bring common data-analysis workflows into one application.

It combines database connectivity, SQL development, data import, profiling, cleaning and transformation, visualization, dashboards, reporting, authentication, and AI-assisted analysis in a single workspace.

### The workflow

**Import / Connect → Profile → Clean → Transform → Query → Analyze → Visualize → Dashboard / Report**

The project is designed to demonstrate practical full-stack engineering, database integration, data-analysis workflows, security controls, and deployment practices.

---

## What DataPilot Can Do

### SQL Workspace

- Multi-tab SQL editor
- Schema-aware table and column discovery
- SQL autocomplete and smart suggestions
- Saved queries and query library
- SQL templates and snippets
- Query history and formatting
- SQL explanation
- Query performance analysis with safe execution-plan inspection
- Read-only query enforcement

### Database Connectivity

DataPilot uses a common database-adapter architecture so different database engines can be handled through a consistent application interface.

**Supported adapters:**

- PostgreSQL
- SQLite
- MySQL
- Microsoft SQL Server
- Oracle

The architecture separates database connectivity, normalized schema metadata, and SQL dialect-specific behavior.

### Data Import & Unified Data Layer

Import common analytical file formats:

- CSV
- Excel (`.xlsx` / `.xls`)
- JSON

Imported data can be profiled and used within analysis, visualization, and dashboard workflows.

### Data Quality & Cleaning

DataPilot includes tools for identifying and working with common data-quality problems:

- Missing values
- Duplicate records
- Type inconsistencies
- Invalid dates
- Numeric quality issues
- Text cleanup
- Case normalization
- Value mapping
- Data-type conversion
- Date transformations
- Outlier detection using IQR and Z-score methods
- Cleaning and transformation pipelines

### Visualization & Dashboards

Turn analytical results into visual outputs including:

- Bar charts
- Line charts
- Pie charts
- Area charts
- Scatter plots
- KPI-style visualizations

Dashboards can combine multiple analytical widgets into a single workspace, with filtering and reporting capabilities where supported by the application.

### AI Data Assistant

The application integrates Google Gemini through the server side for AI-assisted analytical workflows, including:

- Natural-language data questions
- Schema-aware SQL generation
- SQL explanation
- Data-cleaning recommendations

AI-generated SQL is handled within the application's schema and query-safety workflow rather than being executed directly from the client.

### Authentication & Security

The application includes a server-side authentication lifecycle with:

- User registration and login
- Session-based authentication
- Secure password hashing
- Logout and session invalidation
- Forgot-password / reset-password workflow
- Email verification
- Verification and reset token hashing
- Token expiry and single-use handling
- Verification resend rate limiting
- Role-based access control (RBAC)
- Server-side authorization checks
- Read-only database protections
- Environment-based secret configuration
- Audit/activity capabilities

Sensitive credentials and tokens are not intended to be committed to the repository.

### Workspaces & Collaboration

- Workspace management
- Project management
- Members and roles
- Permission controls
- Sharing workflows
- Reports and snapshots
- Notifications
- Activity/audit features

---

## Architecture

```text
┌───────────────────────────────────────────────────────────┐
│                     DataPilot Frontend                    │
│              React + TypeScript + Vite                   │
└────────────────────────────┬──────────────────────────────┘
                             │ HTTP / API
                             ▼
┌───────────────────────────────────────────────────────────┐
│                    Node.js / Express                      │
│ Auth • RBAC • Validation • Analysis • AI • Exports       │
└───────────────┬─────────────────────────┬─────────────────┘
                │                         │
                ▼                         ▼
┌──────────────────────────┐   ┌───────────────────────────┐
│ Database Adapter Layer   │   │ Unified Data / Processing  │
│ PostgreSQL • SQLite      │   │ Import • Quality • Clean   │
│ MySQL • SQL Server       │   │ Transform • Pipelines      │
│ Oracle                   │   └───────────────────────────┘
└──────────────┬───────────┘
               ▼
┌──────────────────────────┐
│ SQL Dialect / Safety     │
│ Schema Metadata • Guard  │
└──────────────┬───────────┘
               ▼
        Database Engines
```

### Key architectural ideas

- **Database adapter abstraction:** common interface for connection, metadata, queries, relationships, and database capabilities.
- **Dialect-aware SQL:** database-specific syntax is handled separately from generic analytical workflows.
- **Schema grounding:** table and column metadata is used to reduce SQL/schema mismatches.
- **Server-side safety:** database access and read-only enforcement are performed on the backend rather than trusting the browser.
- **Migration layer:** version-controlled database migrations support application persistence changes.
- **Session-based authentication:** identity and authorization decisions are enforced server-side.

---

## Technology Stack

| Area | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| UI / Visualization | Recharts, Lucide React, Motion, `@xyflow/react` |
| Backend | Node.js, Express, TypeScript |
| Databases | PostgreSQL, SQLite, MySQL, SQL Server, Oracle |
| Database Drivers | `pg`, `sqlite` / `sqlite3`, `mysql2`, `mssql`, `oracledb` |
| AI | Google Gemini via `@google/genai` |
| Data / Files | XLSX, CSV, JSON |
| Authentication | Server-side sessions, PBKDF2 password hashing, verification/reset tokens |
| Email | Nodemailer-based email delivery abstraction |
| Testing | TypeScript/TSX-based application and regression test suites |
| Deployment | Docker, Docker Compose, GitHub Actions |

---

## Security Approach

DataPilot is designed around server-side enforcement rather than UI-only restrictions.

Examples include:

- SQL safety validation and read-only execution controls
- Server-side authorization and RBAC
- Password hashing with per-user salts
- Hashed verification/reset tokens rather than storing raw tokens
- Token expiration and single-use invalidation
- Rate limiting for sensitive authentication operations
- Environment variables for secrets
- Production configuration requiring appropriate secrets and database settings

> **Security note:** Never commit `.env`, API keys, database passwords, session secrets, or other credentials to GitHub.

---

## Local Development

### Prerequisites

- Node.js `>=22.5.0`
- npm `>=10.0.0`
- A supported database if you want to test live database connectivity

### Setup

```bash
git clone https://github.com/Anand99-master/DataPailot.git
cd DataPailot
npm ci
```

Create your local environment file from the example configuration and add your own local values:

```bash
cp .env.example .env
```

Then start the application:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Useful commands

```bash
# Development
npm run dev

# Type check
npm run lint

# Full test suite
npm test

# All regression tests
npm run test:all

# Production build
npm run build

# Database migrations
npm run migrate:status
npm run migrate:up
npm run migrate:validate
```

> Configure external services and database credentials through `.env`. Do not copy secrets into source files or commit them.

---

## Docker

DataPilot includes a production-oriented Dockerfile and Docker Compose configuration.

```bash
docker compose up --build -d
```

Health endpoints:

```text
/api/health
/api/health/ready
```

See the deployment documentation for environment configuration and operational details.

---

## Testing & QA

The repository contains dedicated coverage for areas including:

- Database adapters and dialect behavior
- SQL safety
- Schema grounding
- Data lineage
- Dashboard and filter workflows
- Authentication and authorization
- Password reset and email verification
- Migration behavior
- Release-candidate checks
- TypeScript validation and production builds

Run the complete suite with:

```bash
npm test
```

For CI-style regression execution:

```bash
npm run test:all
```

GitHub Actions is configured to validate the application and Docker build workflow.

---

## Documentation

- [Project Documentation](PROJECT_DOCUMENTATION.md)
- [Getting Started](docs/GETTING_STARTED.md)
- [User Guide](docs/USER_GUIDE.md)
- [Production Deployment](docs/PRODUCTION_DEPLOYMENT.md)
- [Operations Runbook](docs/OPERATIONS_RUNBOOK.md)
- [Demo Workflow](docs/DEMO_WORKFLOW.md)
- [Release Checklist](docs/RELEASE_CHECKLIST.md)
- [Changelog](CHANGELOG.md)
- [License Notice](docs/LICENSE_NOTICE.md)

---

## Project Highlights

DataPilot brings together several areas of software engineering in one project:

**Full-stack development • Database systems • SQL • Data analysis • Data quality • Data transformation • AI integration • Authentication • RBAC • Security • Visualization • Dashboards • Testing • Docker • CI/CD**

The project is intended as a practical demonstration of building and integrating these components into a single application rather than as a collection of isolated examples.

---

## Future Scope

Potential future extensions include:

- Additional cloud data warehouse integrations
- More advanced AI-assisted analytical workflows
- Additional enterprise integrations
- Expanded collaboration capabilities
- Managed cloud deployment options

These are future directions and are not presented as current functionality.

---

## License

Commercial distribution and licensing terms are pending final review. See [docs/LICENSE_NOTICE.md](docs/LICENSE_NOTICE.md) for the current licensing notice.
