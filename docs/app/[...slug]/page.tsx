import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { getAllDocs, getDocContent } from "@/lib/docs";

export function generateStaticParams() {
  return getAllDocs().map((doc) => ({
    slug: doc.slug.split("/"),
  }));
}

export function generateMetadata({ params }: { params: { slug: string[] } }) {
  const slug = params.slug.join("/");
  const docs = getAllDocs();
  const doc = docs.find((d) => d.slug === slug);
  return {
    title: doc ? `${doc.title} — Teeko Docs` : "Not Found",
  };
}

export default function DocPage({ params }: { params: { slug: string[] } }) {
  const slug = params.slug.join("/");
  const content = getDocContent(slug);

  if (!content) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-gray-400 transition-colors hover:text-gray-600"
        >
          &larr; All Documents
        </Link>
      </div>

      <article className="prose prose-gray max-w-none prose-headings:scroll-mt-20 prose-a:text-blue-600 prose-pre:bg-gray-900 prose-pre:text-gray-100">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeHighlight]}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
