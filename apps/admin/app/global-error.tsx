'use client';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 700 }}>Something went wrong</h2>
          <button onClick={reset} style={{ marginTop: 16, padding: '8px 24px', cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
