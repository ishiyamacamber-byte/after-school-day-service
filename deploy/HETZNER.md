# Hetzner VPS での運用メモ

## 前提

- **サーバー例**: CPX11 相当（2 vCPU / 2GB RAM）からで可。Ubuntu 22.04 LTS など。
- このリポジトリは **Docker** で起動する想定です。

## 1. サーバー初期設定

1. SSH 鍵でログインできるようにする。
2. ファイアウォールで **22 (SSH)** と **80 / 443 (HTTP/HTTPS)** を開ける（アプリは後段で 127.0.0.1:3000 にだけバインドして nginx からプロキシする想定）。
3. Docker を入れる（[公式手順](https://docs.docker.com/engine/install/ubuntu/) の通り `docker compose` まで）。

## 2. コードの配置

```bash
git clone <あなたのリポジトリURL> after-school-day-service
cd after-school-day-service
```

## 3. 本番用環境変数

```bash
cp .env.production.example .env.production
nano .env.production   # または vim
```

必ず設定する項目:

- `NEXTAUTH_URL` … **https://ドメイン名**（末尾スラッシュなし推奨）
- `NEXTAUTH_SECRET` … `openssl rand -base64 32` などで生成した長いランダム文字列

`docker-compose.yml` が `DATABASE_URL=file:/app/data/prod.db` を渡すため、通常は `.env.production` に `DATABASE_URL` を書かなくてよいです。

## 4. ビルドと起動

```bash
docker compose build
docker compose up -d
```

初回だけデモデータを入れる場合（本番では不要なことも多い）:

```bash
docker compose exec app sh -c "npx prisma db seed"
```

ログ確認:

```bash
docker compose logs -f
```

## 5. HTTPS（推奨）

コンテナは **3000** で待ち受けます。手前に **nginx** を置き、**Let’s Encrypt（certbot）** で TLS 証明書を取得する構成が一般的です。

- nginx で `proxy_pass http://127.0.0.1:3000;`
- `NEXTAUTH_URL` は **https** の URL に合わせる

## 6. バックアップ

SQLite は `docker volume`（`sqlite-data`）内にあります。

- 定期的に **ボリュームのスナップショット** または `docker run` で `prod.db` をコピーするなど、**ファイルごとバックアップ**してください。

## 7. よくある注意

- **ビルドは Linux amd64 向け**です。Mac（Apple Silicon）でビルドしたイメージをそのまま Hetzner に載せる場合は、`docker build --platform linux/amd64 ...` を検討してください。
- 会社の回線にサーバーを置かず、**Hetzner 上で常時稼働**させれば、オフィス回線の瞬断で利用者向けサービスが止まることはありません（管理者の操作だけオフィス回線に依存）。
