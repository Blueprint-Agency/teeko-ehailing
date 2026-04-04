import Link from "next/link";
import { getDocsByCategory } from "@/lib/docs";

export default function Home() {
  const categories = getDocsByCategory();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Documentation</h1>
        <p className="mt-2 text-gray-500">
          Browse all project documents for Teeko E-Hailing.
        </p>
      </div>

      <div className="space-y-8">
        {Object.entries(categories).map(([category, docs]) => (
          <section key={category}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
              {category}
            </h2>
            <div className="grid gap-3">
              {docs.map((doc) => (
                <Link
                  key={doc.slug}
                  href={`/${doc.slug}`}
                  className="group rounded-lg border border-gray-200 bg-white px-5 py-4 transition-shadow hover:shadow-md"
                >
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                    {doc.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-400">{doc.slug}.md</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
