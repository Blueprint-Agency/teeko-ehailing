import type { Metadata } from "next";
import Link from "next/link";
import { buildFolderMap, getAllSlugs, isDirectory } from "@/lib/docs";
import SmartSidebar from "@/app/components/SmartSidebar";
import SidebarShell from "@/app/components/SidebarShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teeko E-Hailing — Documentation",
  description: "Project documentation for Teeko E-Hailing",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const folderMap = buildFolderMap();
  const dirSlugs = getAllSlugs()
    .filter((parts) => isDirectory(parts))
    .map((parts) => parts.join("/"));

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SidebarShell>
          {/* Logo */}
          <Link href="/" className="mb-6 flex items-center gap-3 px-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200">
              <span className="text-sm font-black text-white">T</span>
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-900">Teeko E-Hailing</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                Documentation
              </p>
            </div>
          </Link>

          <div className="mb-4 border-t border-slate-100" />

          <SmartSidebar folderMap={folderMap} dirSlugs={dirSlugs} />
        </SidebarShell>

        {/* pt-14 on mobile to clear the fixed top bar */}
        <main className="min-h-screen bg-white px-6 pb-20 pt-20 lg:ml-64 lg:px-10 lg:pt-10 xl:px-14">
          {children}
        </main>
      </body>
    </html>
  );
}
