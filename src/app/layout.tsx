import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "醒醒喵 WAKECAT · AI 会员唤醒官",
  description: "老板负责经营店铺,醒醒喵负责把老顾客找回来。AI Agent 团队 × 猫咪世界 × 商业增长引擎。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
