import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] px-6">
      <div className="max-w-md text-center">
        <p className="font-display text-6xl text-[var(--color-navy)]">404</p>
        <h1 className="mt-4 font-display text-2xl text-[var(--color-navy)]">Page not found</h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-navy)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
