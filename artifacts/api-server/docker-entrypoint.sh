#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

echo "[entrypoint] Waiting for PostgreSQL..."
until node -e "
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    process.exit(0);
  } catch {
    try { await client.end(); } catch {}
    process.exit(1);
  }
})();
"; do
  sleep 2
done

echo "[entrypoint] Applying schema (users, user_role enum, sensor tables)..."
export PATH="/app/node_modules/.bin:$PATH"
cd /app/lib/db
drizzle-kit push --config ./drizzle.config.ts

echo "[entrypoint] Starting API server..."
exec "$@"
