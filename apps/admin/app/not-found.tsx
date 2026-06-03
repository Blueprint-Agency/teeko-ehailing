export default function NotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 48, fontWeight: 700, margin: 0 }}>404</h2>
          <p style={{ color: '#666' }}>Page not found</p>
          <a href="/dashboard" style={{ color: '#1A56DB' }}>Go to Dashboard</a>
        </div>
      </body>
    </html>
  );
}
