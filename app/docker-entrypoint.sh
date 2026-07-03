#!/bin/sh
set -e
echo "==> migrations"
node /srv/db/migrate.mjs
echo "==> seed"
node /srv/db/seed.mjs
echo "==> next start"
exec node /srv/server.js
