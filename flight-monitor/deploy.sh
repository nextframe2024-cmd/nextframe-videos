#!/usr/bin/env bash
# One-shot deploy for YOUR server. Runs everything inside Docker — it does NOT
# install Node, Chromium or any system packages on the host. The only thing it
# writes outside the container is ./data (SQLite DB, summaries, heartbeat).
#
# Usage (from the flight-monitor/ folder, on a host with Docker + network):
#   ./deploy.sh
#
# First run: copy .env.example to .env and set PROVIDER=playwright + your SMTP.

set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo ">> Created .env from template. Edit it (PROVIDER=playwright, SMTP_*) then re-run." >&2
  exit 1
fi

echo ">> Building image (includes Chromium for live scraping)..."
docker compose build

echo ">> Starting the 24/7 monitor..."
docker compose up -d

echo ">> Done. It is running in the background. Useful commands:"
echo "   docker compose logs -f          # follow logs"
echo "   docker compose exec flight-monitor node --experimental-sqlite src/health.ts   # health"
echo "   docker compose down             # stop (data/ is kept)"
