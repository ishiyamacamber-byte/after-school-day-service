import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker / VPS 上での本番起動向け（イメージ縮小・単一プロセス実行）
  output: "standalone",
  // standalone 本番では既定で約 1MB までしか受け付けないため、アップロード用に引き上げる
  experimental: {
    proxyClientMaxBodySize: "3mb",
    middlewareClientMaxBodySize: "3mb",
  },
  serverActions: {
    bodySizeLimit: "3mb",
  },
};

export default nextConfig;
