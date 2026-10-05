#!/usr/bin/env bash
#
# Dockia backup — dumps the Postgres database and archives the uploaded media,
# both into ./backups/ with a timestamp, and prunes old backups.
#
# Run from the project root on the SERVER (where docker compose is running):
#     ./scripts/backup.sh
#
# Schedule nightly with cron, e.g.:
#     0 3 * * *  cd /opt/dockia && ./scripts/backup.sh >> /var/log/dockia-backup.log 2>&1
#
set -euo pipefail

# Resolve project root (parent of this script's dir) so cron can call it anywhere.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="$ROOT/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Pick whichever compose CLI is available.
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "ERROR: docker compose not found" >&2
  exit 1
fi

echo "==> [$TS] Dumping Postgres database"
# Use the db container's own env vars so credentials never leave the container.
$DC exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "$BACKUP_DIR/db-$TS.sql.gz"

echo "==> [$TS] Archiving media (uploaded documents & files)"
# The backend container mounts the media volume at /app/media.
$DC exec -T backend tar czf - -C /app/media . \
  > "$BACKUP_DIR/media-$TS.tar.gz"

echo "==> Pruning backups older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -type f -name 'db-*.sql.gz'    -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name 'media-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "==> Done:"
ls -lh "$BACKUP_DIR/db-$TS.sql.gz" "$BACKUP_DIR/media-$TS.tar.gz"
