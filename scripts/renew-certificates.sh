#!/usr/bin/env bash
# Продлевает сертификаты в тех же named volumes, которые читает nginx.
# Не устанавливает cron автоматически; безопасный шаблон приведён в README.md.
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."

if [[ -z "$(docker compose ps -q nginx)" ]]; then
  echo "cert renewal error: nginx container is not running" >&2
  exit 1
fi

docker compose --profile maintenance run --rm --no-deps -T certbot \
  renew --non-interactive --webroot --webroot-path /var/www/certbot "$@"

# Certbot не управляет nginx-контейнером: проверяем конфиг и перечитываем сертификат.
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload

echo "certificate renewal check completed"
