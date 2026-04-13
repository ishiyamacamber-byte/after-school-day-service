#!/bin/sh
set -e
# SQLite 用データディレクトリ（ボリュームマウント先）。権限を nextjs に合わせる
mkdir -p /app/data
chown -R nextjs:nodejs /app/data

exec gosu nextjs sh -c "npx prisma db push && npx prisma db seed && exec node server.js"
