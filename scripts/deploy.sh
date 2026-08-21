#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — edit secrets before production use."
fi

docker compose -f docker-compose.prod.yml --env-file .env up -d --build
echo "Deployed. App should be on port 80."
