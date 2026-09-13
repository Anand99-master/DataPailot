# DataPilot Security Policy

## 1. Authentication & Session Security
- Cookie-based authentication with `HttpOnly`, `Secure`, and `SameSite=Strict`.
- Session timeouts and secure token handling.

## 2. Read-Only SQL Security
- Analytical queries are strictly enforced read-only.
- Dangerous DDL/DML statements (`DROP`, `DELETE`, `ALTER`, `TRUNCATE`) are blocked by parser rules.

## 3. CSV & File Import Safety
- Formula injection protection: Excel/CSV formulas starting with `=`, `+`, `-`, or `@` are safely sanitized.
- Strict workspace isolation and permission checks.

## 4. Rate Limiting & Headers
- API rate limiting protects authentication, AI, and heavy endpoints.
- Secure HTTP headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) applied globally.
