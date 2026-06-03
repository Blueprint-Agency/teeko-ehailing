function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', paddingTop: 80 }}>
      <h1>{statusCode ?? 'Client'} Error</h1>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: { res?: { statusCode: number }; err?: { statusCode: number } }) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return { statusCode };
};

export default ErrorPage;
