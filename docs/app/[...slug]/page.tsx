import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  getAllSlugs,
  getFolderContents,
  getDocContent,
  isDirectory,
} from "@/lib/docs";
import RightToc from "@/app/components/RightToc";

export function generateStaticParams() {
  return getAllSlugs().map((parts) => ({ slug: parts }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const name = slug[slug.length - 1];
  if (isDirectory(slug)) {
    return { title: `${name} — Teeko Docs` };
  }
  const content = getDocContent(slug);
  const titleMatch = content?.match(/^#\s+(.+)/m);
  return {
    title: titleMatch
      ? `${titleMatch[1].replace(/[*_`]/g, "")} — Teeko Docs`
      : "Not Found",
  };
}

// ── Heading ID helpers ────────────────────────────────────────────────────────

function makeId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function childrenToText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children))
    return children.map(childrenToText).join("");
  return "";
}

const headingComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 id={makeId(childrenToText(children))}>{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 id={makeId(childrenToText(children))}>{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 id={makeId(childrenToText(children))}>{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 id={makeId(childrenToText(children))}>{children}</h4>
  ),
};

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Breadcrumbs({ slugParts }: { slugParts: string[] }) {
  return (
    <nav className="mb-8 flex flex-wrap items-center gap-1 text-sm text-slate-400">
      <Link href="/" className="transition-colors hover:text-slate-700">
        Home
      </Link>
      {slugParts.map((part, i) => {
        const href = "/" + slugParts.slice(0, i + 1).join("/");
        const isLast = i === slugParts.length - 1;
        return (
          <span key={href} className="flex items-center gap-1">
            <span className="text-slate-300">/</span>
            {isLast ? (
              <span className="font-medium text-slate-600">{part}</span>
            ) : (
              <Link href={href} className="capitalize transition-colors hover:text-slate-700">
                {part}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function FolderIcon() {
  return (
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
  );
}

function DocIcon() {
  return (
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
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

// ── Pages ─────────────────────────────────────────────────────────────────────

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug: slugParts } = await params;

  // --- Folder listing ---
  if (isDirectory(slugParts)) {
    const items = getFolderContents(slugParts);
    const folderName = slugParts[slugParts.length - 1];

    return (
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs slugParts={slugParts} />

        <h1 className="mb-8 text-2xl font-bold capitalize text-slate-900">
          {folderName}
        </h1>

        <div className="space-y-2.5">
          {items.map((item) => (
            <Link
              key={item.slug}
              href={`/${item.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all duration-150 hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-200 transition-colors group-hover:bg-indigo-50 group-hover:ring-indigo-200">
                {item.type === "folder" ? <FolderIcon /> : <DocIcon />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900 transition-colors group-hover:text-indigo-600">
                  {item.type === "folder" ? item.name : item.title}
                </h3>
                <p className="text-sm text-slate-400">
                  {item.type === "folder"
                    ? `${item.count} ${item.count === 1 ? "document" : "documents"}`
                    : `${item.name}.md`}
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

  // --- Document view ---
  const content = getDocContent(slugParts);
  if (!content) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumbs slugParts={slugParts} />

      <div className="xl:grid xl:grid-cols-[1fr_220px] xl:items-start xl:gap-14">
        <article className="prose prose-slate max-w-none
          prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:tracking-tight
          prose-h1:text-3xl prose-h1:font-bold
          prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
          prose-code:rounded prose-code:bg-indigo-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-indigo-700 prose-code:font-normal prose-code:text-[0.875em] prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-black prose-pre:text-slate-100 prose-pre:shadow-lg prose-pre:rounded-xl
          prose-blockquote:border-indigo-300 prose-blockquote:text-slate-500
          prose-th:bg-slate-50 prose-th:font-semibold
          prose-img:rounded-xl prose-img:shadow-md">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={headingComponents}
          >
            {content}
          </ReactMarkdown>
        </article>

        <RightToc />
      </div>
    </div>
  );
}
