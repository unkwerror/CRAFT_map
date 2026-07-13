#!/usr/bin/env bash
# Ежедневный локальный бэкап PostgreSQL и uploads. Внешняя копия необязательна.
# Пример cron приведён в README.md.
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "backup error: .env not found" >&2
  exit 1
fi

# shellcheck disable=SC1091
source .env
umask 077

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/craft-map}"
KEEP_DAYS="${KEEP_DAYS:-14}"
BACKUP_MAX_AGE_SECONDS="${BACKUP_MAX_AGE_SECONDS:-600}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

if [[ ! "$KEEP_DAYS" =~ ^[0-9]+$ ]] || (( KEEP_DAYS < 1 )); then
  echo "backup error: KEEP_DAYS must be a positive integer" >&2
  exit 1
fi
if [[ ! "$BACKUP_MAX_AGE_SECONDS" =~ ^[0-9]+$ ]] || (( BACKUP_MAX_AGE_SECONDS < 1 )); then
  echo "backup error: BACKUP_MAX_AGE_SECONDS must be a positive integer" >&2
  exit 1
fi

mkdir -p -- "$BACKUP_DIR"
chmod 700 -- "$BACKUP_DIR"

# Не допускаем два одновременных запуска даже вне рекомендованного cron template.
exec 9> "$BACKUP_DIR/.backup.lock"
chmod 600 -- "$BACKUP_DIR/.backup.lock"
if ! flock -n 9; then
  echo "backup error: another backup is already running" >&2
  exit 1
fi

db_final="$BACKUP_DIR/db-$STAMP.sql.gz"
uploads_final="$BACKUP_DIR/uploads-$STAMP.tar.gz"
checksum_final="$BACKUP_DIR/backup-$STAMP.sha256"

for target in "$db_final" "$uploads_final" "$checksum_final"; do
  if [[ -e "$target" ]]; then
    echo "backup error: target already exists: $target" >&2
    exit 1
  fi
done

temporary_files=()
backup_complete=false
cleanup() {
  local file
  for file in "${temporary_files[@]}"; do
    [[ -n "$file" ]] && rm -f -- "$file"
  done
  if [[ "$backup_complete" != true ]]; then
    rm -f -- "$db_final" "$uploads_final" "$checksum_final"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

db_tmp="$(mktemp "$BACKUP_DIR/.db-$STAMP.XXXXXX")"
temporary_files+=("$db_tmp")
uploads_tmp="$(mktemp "$BACKUP_DIR/.uploads-$STAMP.XXXXXX")"
temporary_files+=("$uploads_tmp")
chmod 600 -- "$db_tmp" "$uploads_tmp"

# Сначала пишем во временные файлы в том же каталоге: rename через mv будет атомарным.
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip -c > "$db_tmp"
docker compose exec -T app tar cf - -C /data uploads \
  | gzip -c > "$uploads_tmp"

# Проверяем потоки до публикации файлов под окончательными именами.
[[ -s "$db_tmp" && -s "$uploads_tmp" ]]
gzip -t -- "$db_tmp"
gzip -t -- "$uploads_tmp"
tar -tzf "$uploads_tmp" >/dev/null

mv -- "$db_tmp" "$db_final"
mv -- "$uploads_tmp" "$uploads_final"
chmod 600 -- "$db_final" "$uploads_final"

checksum_tmp="$(mktemp "$BACKUP_DIR/.backup-$STAMP.XXXXXX")"
temporary_files+=("$checksum_tmp")
chmod 600 -- "$checksum_tmp"
(
  cd "$BACKUP_DIR"
  sha256sum -- "$(basename "$db_final")" "$(basename "$uploads_final")"
) > "$checksum_tmp"
mv -- "$checksum_tmp" "$checksum_final"
chmod 600 -- "$checksum_final"

assert_fresh_private_file() {
  local file="$1"
  local now mtime age mode
  [[ -s "$file" ]] || {
    echo "backup error: empty backup file: $file" >&2
    return 1
  }
  mode="$(stat -c '%a' -- "$file")"
  [[ "$mode" == "600" ]] || {
    echo "backup error: unsafe permissions $mode on $file" >&2
    return 1
  }
  now="$(date +%s)"
  mtime="$(stat -c '%Y' -- "$file")"
  age=$((now - mtime))
  (( age >= -60 && age <= BACKUP_MAX_AGE_SECONDS )) || {
    echo "backup error: backup is not fresh: $file" >&2
    return 1
  }
}

assert_fresh_private_file "$db_final"
assert_fresh_private_file "$uploads_final"
assert_fresh_private_file "$checksum_final"
(
  cd "$BACKUP_DIR"
  sha256sum -c -- "$(basename "$checksum_final")"
)
backup_complete=true

# Очистка запускается только после успешного создания и проверки обоих архивов.
docker compose exec -T app node /srv/db/cleanup-uploads.mjs

# Внешняя копия остаётся opt-in: локальный backup работает без BACKUP_REMOTE.
if [[ -n "${BACKUP_REMOTE:-}" ]]; then
  rsync -a --chmod=F600 -- "$db_final" "$uploads_final" "$checksum_final" "$BACKUP_REMOTE/"
fi

# Удаляем только файлы, созданные этим скриптом; прочие файлы каталога не затрагиваем.
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'db-*.sql.gz' -o -name 'uploads-*.tar.gz' -o -name 'backup-*.sha256' \) \
  -mtime +"$KEEP_DAYS" -delete

echo "backup ok: $STAMP ($(du -sh "$BACKUP_DIR" | cut -f1) total)"
