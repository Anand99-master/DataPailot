# DataPilot Environment Configuration

DataPilot supports four isolated environments:
1. `development`
2. `test`
3. `staging`
4. `production`

## Key Variables
- `NODE_ENV`: Runtime environment (`development` | `production`)
- `PORT`: HTTP listener port (default `3000`)
- `DATABASE_URL`: PostgreSQL connection URI
- `SESSION_SECRET`: Secret key for session signing
- `GEMINI_API_KEY`: API key for Gemini AI features (server-side only)
