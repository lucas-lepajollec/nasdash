import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { ConfigProvider } from '@/providers/ConfigProvider';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '500', '700'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'NasDash — Dashboard Privé',
  description: 'Dashboard NAS auto-hébergé avec monitoring système temps réel',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${outfit.variable} ${outfit.className}`} data-theme="dark">
        <ConfigProvider>
          {children}
        </ConfigProvider>
      </body>
    </html>
  );
}
