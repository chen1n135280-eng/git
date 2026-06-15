import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/nav";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: "CPA 理论研习室",
  description: "以教材为依据的CPA理论知识学习与审核工具",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#173f35",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <ServiceWorker />
        <div className="app-shell">
          <Nav />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
