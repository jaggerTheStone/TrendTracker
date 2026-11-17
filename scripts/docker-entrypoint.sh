#!/bin/sh
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Applying database migrations..."
  npm run db:migrate
fi

exec "$@"
