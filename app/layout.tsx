import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://skillforge.honey-chick-7267.chatgpt.site"),
  title: "SkillForge — Build better skills for AI agents",
  description:
    "Open-source Skill Builder, Skill Inspector and Skill Tester for AI Agent Skills. 创建、检查、测试与管理 Codex Skills、Claude Code Skills 和 Generic Agent Skills。",
  icons: { icon: "/favicon.svg" },
  twitter: { card: "summary_large_image", title: "SkillForge", description: "Build better skills for AI agents.", images: ["/og.png"] },
  openGraph: {
    title: "SkillForge",
    description: "Build better skills for AI agents.",
    images: ["/og.png"],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
