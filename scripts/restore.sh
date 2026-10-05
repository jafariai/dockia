#!/usr/bin/env bash
#
# Dockia restore — restores a Postgres dump and/or a media archive produced by
# scripts/backup.sh. DESTRUCTIVE: overwrites the current database / media.
#
# Usage (from the project root on the SERVER):
#     ./scripts/restore.sh backups/db-YYYYMMDD-HHMMSS.sql.gz [backups/media-YYYYMMDD-HHMMSS.tar.gz]
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_DUMP="${1:-}"
MEDIA_ARCHIVE="${2:-}"

if [[ -z "$DB_DUMP" ]]; then
  echo "Usage: $0 <db-dump.sql.gz> [media-archive.tar.gz]" >&2
  exit 1
fi
[[ -f "$DB_DUMP" ]] || { echo "ERROR: $DB_DUMP not found" >&2; exit 1; }
if [[ -n "$MEDIA_ARCHIVE" && ! -f "$MEDIA_ARCHIVE" ]]; then
  echo "ERROR: $MEDIA_ARCHIVE not found" >&2; exit 1
fi

if docker compose version >/dev/null 2>&1; then DC="docker compose";
elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose";
else echo "ERROR: docker compose not found" >&2; exit 1; fi

echo "!! This will OVERWRITE the live database${MEDIA_ARCHIVE:+ and media}."
read -r -p "Type 'restore' to continue: " confirm
[[ "$confirm" == "restore" ]] || { echo "Aborted."; exit 1; }

echo "==> Restoring database from $DB_DUMP"
# Drop & recreate the public schema, then load the dump, inside the db container.
gunzip -c "$DB_DUMP" | $DC exec -T db sh -c '
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
'

if [[ -n "$MEDIA_ARCHIVE" ]]; then
  echo "==> Restoring media from $MEDIA_ARCHIVE"
  # Wipe existing media, then unpack the archive into /app/media.
  $DC exec -T backend sh -c 'rm -rf /app/media/* /app/media/.[!.]* 2>/dev/null; mkdir -p /app/media'
  $DC exec -T backend tar xzf - -C /app/media < "$MEDIA_ARCHIVE"
fi

echo "==> Restarting backend"
$DC restart backend
echo "==> Restore complete."
