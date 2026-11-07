import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 实时仪表盘应用:所有页面依赖会话与数据库实时读,禁用静态预渲染缓存
  cacheComponents: false,
  serverExternalPackages: ["libsql"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
