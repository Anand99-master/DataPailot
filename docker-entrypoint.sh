#!/bin/sh
set -e

echo "Starting DataPilot Container Entrypoint..."

# If DATABASE_URL is provided, run migration validation and apply pending migrations safely
if [ -n "$DATABASE_URL" ]; then
  echo "Database URL configured. Validating migrations..."
  npm run migrate:validate || {
    echo "ERROR: Migration validation failed!"
    exit 1
  }

  echo "Applying pending migrations..."
  npm run migrate:up || {
    echo "ERROR: Migration application failed!"
    exit 1
  }
  echo "Migrations successfully applied."
else
  echo "No DATABASE_URL configured. Skipping database migrations (using local SQLite fallback)."
  # Ensure local sqlite migrations run for collaboration store if running standalone
  npm run migrate:up || true
fi

echo "Starting DataPilot production server..."
exec node dist/server.cjs
