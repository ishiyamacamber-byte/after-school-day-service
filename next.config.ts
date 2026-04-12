import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker / VPS 上での本番起動向け（イメージ縮小・単一プロセス実行）
  output: "standalone",
};

export default nextConfig;
