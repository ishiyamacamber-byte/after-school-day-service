#!/bin/sh
set -e
# SQLite 用データディレクトリ（ボリュームマウント先）。権限を nextjs に合わせる
mkdir -p /app/data
chown -R nextjs:nodejs /app/data

# seed が途中で失敗しても追加管理者を入れられるよう、db push の直後に ensure を実行する
# tsx は本番で npx のネット取得や権限で失敗することがあるため node のみで実行する
exec gosu nextjs sh -c "npx prisma db push && node prisma/ensure-extra-admins.cjs && npx prisma db seed && exec node server.js"
