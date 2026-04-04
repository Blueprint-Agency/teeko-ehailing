import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-32 text-center">
      <h1 className="text-6xl font-bold text-gray-200">404</h1>
      <p className="mt-4 text-gray-500">Document not found.</p>
      <Link
        href="/"
        className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        &larr; Back to all documents
      </Link>
    </div>
  );
}
