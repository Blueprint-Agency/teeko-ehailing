'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
            <p style={{ fontSize: '3.75rem', fontWeight: 700, color: '#0A1F44' }}>500</p>
            <h1 style={{ marginTop: '1rem', fontSize: '1.5rem', fontWeight: 600, color: '#0A1F44' }}>
              Something went wrong
            </h1>
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              style={{ marginTop: '1.5rem', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', backgroundColor: '#0A1F44', color: 'white', fontWeight: 500, border: 'none', cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
