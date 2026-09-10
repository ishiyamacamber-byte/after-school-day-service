import type { NextConfig } from "next";

// Next 15.5 の型定義に未反映のキーがあるため、実行時設定は別途付与する
const nextConfig: NextConfig = {
  // Docker / VPS 上での本番起動向け（イメージ縮小・単一プロセス実行）
  output: "standalone",
  experimental: {
    // アップロード用（FormData）の本文上限。型に無いキーは下で追加
    middlewareClientMaxBodySize: "3mb",
  },
};

const experimental = nextConfig.experimental as Record<string, unknown>;
// standalone 本番で約 1MB に切り詰められる対策（型定義よりランタイムが先行）
experimental.proxyClientMaxBodySize = "3mb";
experimental.serverActions = { bodySizeLimit: "3mb" };

export default nextConfig;
