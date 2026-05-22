import type { Metadata } from 'next';
import { Outfit, Space_Grotesk, Syne, Righteous, Montserrat } from 'next/font/google';
import './globals.css';
import './themes.css';
import { ConfigProvider } from '@/providers/ConfigProvider';

const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-outfit' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-space' });
const syne = Syne({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-syne' });
const righteous = Righteous({ subsets: ['latin'], weight: '400', variable: '--font-righteous' });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'], variable: '--font-montserrat' });

export const metadata: Metadata = {
  title: 'NasDash — Dashboard Privé',
  description: 'Dashboard NAS auto-hébergé avec monitoring système temps réel',
  icons: '/logo.svg',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${outfit.variable} ${spaceGrotesk.variable} ${syne.variable} ${righteous.variable} ${montserrat.variable} ${outfit.className}`} data-theme="dark">
        <ConfigProvider>
          {children}
        </ConfigProvider>
      </body>
    </html>
  );
}
