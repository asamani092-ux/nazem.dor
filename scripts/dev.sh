#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo pg_ctlcluster 16 main start 2>/dev/null || true
fi

cd "$ROOT/backend"
test -f .env || cp .env.example .env
npm install
npx prisma migrate deploy
npm run seed
npm run build
cd "$ROOT/frontend"
npm install
npm run build

pkill -f "node dist/index.js" 2>/dev/null || true
pkill -f "vite --host" 2>/dev/null || true
sleep 1

cd "$ROOT/backend"
FRONTEND_DIST="$ROOT/frontend/dist" node dist/index.js > /tmp/nazem-api.log 2>&1 &
echo "API+UI on http://127.0.0.1:4000  PID $!"

sleep 2
curl -s http://127.0.0.1:4000/api/health || true
echo
echo "LOGIN (phone only): 0555143246"
echo "Forward port 4000 in Cursor Ports"
