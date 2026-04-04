import type { Metadata } from "next";
import Link from "next/link";
import { getDocsByCategory } from "@/lib/docs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teeko E-Hailing — Documentation",
  description: "Project documentation for Teeko E-Hailing",
};

function Sidebar() {
  const categories = getDocsByCategory();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 overflow-y-auto border-r border-gray-200 bg-white px-4 py-6">
      <Link href="/" className="mb-8 block">
        <h1 className="text-lg font-bold text-gray-900">Teeko E-Hailing</h1>
        <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Documentation
        </span>
      </Link>

      <nav className="space-y-6">
        {Object.entries(categories).map(([category, docs]) => (
          <div key={category}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {category}
            </h2>
            <ul className="space-y-1">
              {docs.map((doc) => (
                <li key={doc.slug}>
                  <Link
                    href={`/${doc.slug}`}
                    className="block rounded-md px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  >
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Sidebar />
        <main className="ml-64 min-h-screen px-8 py-8 lg:px-16">
          {children}
        </main>
      </body>
    </html>
  );
}
