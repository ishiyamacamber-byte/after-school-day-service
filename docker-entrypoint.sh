#!/bin/sh
set -e
# SQLite 用データディレクトリ（ボリュームマウント先）。権限を nextjs に合わせる
mkdir -p /app/data
chown -R nextjs:nodejs /app/data

exec gosu nextjs sh -c "npx --yes prisma db push && exec node server.js"
