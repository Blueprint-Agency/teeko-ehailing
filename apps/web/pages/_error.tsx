import type { NextPageContext } from 'next'

function Error({ statusCode }: { statusCode: number }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '3.75rem', fontWeight: 700, color: '#0A1F44' }}>{statusCode}</p>
        <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>
          {statusCode === 404 ? 'Page not found' : 'An error occurred'}
        </p>
      </div>
    </div>
  )
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode ?? 500 : 404
  return { statusCode }
}

export default Error
