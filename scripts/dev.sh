#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# PostgreSQL
if command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo pg_ctlcluster 16 main start 2>/dev/null || true
fi

cd "$ROOT/backend"
test -f .env || cp .env.example .env
npm install
npx prisma migrate deploy
npm run seed
npm run build

# stop old processes
pkill -f "node dist/index.js" 2>/dev/null || true
pkill -f "vite --host" 2>/dev/null || true
sleep 1

node dist/index.js > /tmp/nazem-api.log 2>&1 &
echo "API PID $!"

cd "$ROOT/frontend"
npm install
npm run dev -- --host 0.0.0.0 --port 5173 > /tmp/nazem-web.log 2>&1 &
echo "WEB PID $!"

sleep 2
echo "API:  http://127.0.0.1:4000/api/health"
echo "WEB:  http://127.0.0.1:5173"
echo "LOGIN: 0555143246 / Nazem@123"
curl -s http://127.0.0.1:4000/api/health || true
echo
