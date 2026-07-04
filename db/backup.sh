#!/usr/bin/env bash
# Ежедневный бэкап: pg_dump + копия папки загрузок, хранение 14 дней.
# Крон на хосте (пример):
#   30 3 * * * cd /opt/CRAFT_map && ./db/backup.sh >> /var/log/craft-backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-/var/backups/craft-map}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%F)"

mkdir -p "$BACKUP_DIR"

# shellcheck disable=SC1091
source .env

docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"

docker compose exec -T app tar cf - -C /data uploads \
  | gzip > "$BACKUP_DIR/uploads-$STAMP.tar.gz"

find "$BACKUP_DIR" -maxdepth 1 -type f -mtime +"$KEEP_DAYS" -delete

echo "backup ok: $STAMP ($(du -sh "$BACKUP_DIR" | cut -f1) total)"
