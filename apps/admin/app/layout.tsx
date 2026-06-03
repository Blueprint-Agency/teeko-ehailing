import type { Metadata } from 'next';
import { Providers } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Teeko Admin',
  description: 'Teeko e-hailing platform admin panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
