#!/usr/bin/env bash
set -e

echo "[entrypoint] Waiting for Postgres at ${PGHOST:-postgres}:${PGPORT:-5432}..."
until node -e "
  const net = require('net');
  const s = net.createConnection({host:'${PGHOST:-postgres}', port:${PGPORT:-5432}});
  s.on('connect', () => { s.end(); process.exit(0); });
  s.on('error', () => process.exit(1));
" >/dev/null 2>&1; do
  sleep 1
done
echo "[entrypoint] Postgres reachable."

echo "[entrypoint] Pushing Drizzle schema..."
pnpm --filter @workspace/db run push

echo "[entrypoint] Seeding users (idempotent)..."
pnpm --filter @workspace/scripts run seed-users || true

echo "[entrypoint] Starting api-server..."
exec pnpm --filter @workspace/api-server run dev
