import type { Metadata } from 'next';
import { Outfit, Space_Grotesk, Syne, Righteous, Montserrat } from 'next/font/google';
import './globals.css';
import './themes.css';
import { ConfigProvider } from '@/providers/ConfigProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import { messages } from '@/i18n/messages';

const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-outfit' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-space' });
const syne = Syne({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-syne' });
const righteous = Righteous({ subsets: ['latin'], weight: '400', variable: '--font-righteous' });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'], variable: '--font-montserrat' });

export const metadata: Metadata = {
  title: messages.en['meta.title'],
  description: messages.en['meta.description'],
  icons: '/logo.svg',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} ${spaceGrotesk.variable} ${syne.variable} ${righteous.variable} ${montserrat.variable} ${outfit.className}`} data-theme="dark" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('nd-theme-preset');
                  if (theme && theme !== 'nasdash') {
                    document.body.classList.add('theme-' + theme);
                  }
                  var bg = localStorage.getItem('nd-bg-preset');
                  if (bg) {
                    document.body.style.backgroundImage = 'url(' + bg + ')';
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundAttachment = 'fixed';
                  }
                } catch (e) {}
              })();
            `
          }}
        />
        <I18nProvider>
          <ConfigProvider>
            {children}
          </ConfigProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
