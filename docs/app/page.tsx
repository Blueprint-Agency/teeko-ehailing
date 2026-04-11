import Link from "next/link";
import { getFolderContents } from "@/lib/docs";

export default function Home() {
  const versions = getFolderContents([]).filter((item) => item.type === "folder");

  return (
    <div className="mx-auto max-w-2xl">
      {/* Hero */}
      <div className="mb-12">
        <span className="mb-4 inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
          Product Documentation
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Teeko E-Hailing
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-slate-500">
          Browse project documents, product requirements, and technical
          specifications for Teeko — Malaysia&rsquo;s upcoming e-hailing platform.
        </p>
      </div>

      {/* Version cards */}
      <div className="space-y-3">
        {versions.map((version) => (
          <Link
            key={version.slug}
            href={`/${version.slug}`}
            className="group flex items-center gap-5 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm transition-all duration-150 hover:border-indigo-300 hover:shadow-md"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200 transition-colors group-hover:from-indigo-50 group-hover:to-violet-50 group-hover:ring-indigo-200">
              <svg
                className="h-5 w-5 text-slate-400 transition-colors group-hover:text-indigo-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-slate-900 transition-colors group-hover:text-indigo-600">
                {version.name}
              </h2>
              <p className="text-sm text-slate-400">
                {version.count} {version.count === 1 ? "section" : "sections"}
              </p>
            </div>
            <svg
              className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
