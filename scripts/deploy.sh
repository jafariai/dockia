#!/usr/bin/env bash
#
# Pull the latest code and (re)build/restart the Dockia stack.
# Runs on the SERVER — the CI/CD pipeline calls it over SSH, and you can run it
# by hand too:  bash scripts/deploy.sh
#
# Safe to re-run. `git pull --ff-only` never touches gitignored files
# (.env, nginx/certs/, backups/), so your secrets and certs are preserved.
# The backend container's entrypoint runs migrations + collectstatic on start,
# so no separate migrate step is needed here.
#
set -euo pipefail
cd "$(dirname "$0")/.."          # repo root

echo "==> Pulling latest (ff-only)"
git pull --ff-only

echo "==> Building & restarting the dockia stack"
docker compose up -d --build

# Recreated app containers (backend/frontend/ws) get new IPs on the Docker
# network, but nginx caches upstream IPs at startup — so it must be restarted
# after a deploy or it 502s against the old, now-dead addresses.
echo "==> Restarting nginx so it re-resolves upstream container IPs"
docker compose restart nginx

echo "==> Pruning dangling images"
docker image prune -f

echo "==> Current containers:"
docker compose ps
echo "==> Deploy complete."
