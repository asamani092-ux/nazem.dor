#!/usr/bin/env bash
# تشغيل سريع للـ API+UI على المنفذ 4000 (بدون إعادة تثبيت)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo pg_ctlcluster 16 main start 2>/dev/null || true
fi

cd "$ROOT/backend"
test -f .env || cp .env.example .env
npx tsc
test -d "$ROOT/frontend/dist" || (cd "$ROOT/frontend" && npm run build)

# أوقف نسخة قديمة على 4000 إن وُجدت
if command -v fuser >/dev/null 2>&1; then
  fuser -k 4000/tcp 2>/dev/null || true
fi
pkill -f "FRONTEND_DIST=.*node dist/index.js" 2>/dev/null || true
sleep 1

FRONTEND_DIST="$ROOT/frontend/dist" PORT=4000 node dist/index.js > /tmp/nazem-api.log 2>&1 &
PID=$!
sleep 2
if curl -sf "http://127.0.0.1:4000/api/health" >/dev/null; then
  echo "OK http://127.0.0.1:4000  PID $PID"
  echo "LOGIN: 0555143246"
else
  echo "FAILED — see /tmp/nazem-api.log" >&2
  tail -30 /tmp/nazem-api.log >&2 || true
  exit 1
fi
