# Changelog

All notable changes to DataPilot will be documented in this file.

## [1.0.0] - 2026-09-13

### Added
- **SQL Workspace**: Secure multi-tab SQL editor with schema discovery, table/column autocomplete, performance explain analyzer, saved queries, and snippets.
- **Database Adapters**: Full support for SQLite (Live & Local) and PostgreSQL, with code-level adapters for MySQL, SQL Server, and Oracle.
- **Unified Data Layer**: Multi-format ingestion supporting CSV, XLSX, and JSON with automatic type inference and profiling.
- **Data Quality & Profiling**: Automated anomaly detection, missing value alerts, duplicate scanning, and data health scoring.
- **Cleaning & Transformations**: 25+ non-destructive transformation operations with step ordering, versioning, and undo/redo.
- **AI Assistant**: Server-side Google Gemini integration for smart query generation and cleaning recommendations.
- **Visualization Studio**: Interactive charting (Bar, Line, Pie, Scatter, KPI) with aggregation and grouping.
- **Dashboards**: Multi-widget layouts with global cross-filtering and real-time refresh.
- **Reports & Collaboration**: Immutable snapshots, narrative insights, sharing, and Role-Based Access Control (RBAC).
- **Production Infrastructure**: Node 22 runtime, Express server bundling via esbuild, Docker multi-stage build, docker-compose, and CI/CD workflows.
- **Security & Observability**: Query safety validator, export formula injection protection, structured JSON logging, and correlation IDs.
