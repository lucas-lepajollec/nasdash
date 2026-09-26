import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './themes.css';
import './design-calme.css';
import { ConfigProvider } from '@/providers/ConfigProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import { messages } from '@/i18n/messages';
import { isDemoMode } from '@/lib/demoMode';

// Fonts ship with the source (src/app/fonts, OFL, see LICENSES.txt): a build
// never downloads them, so it cannot fail on Google Fonts being unreachable.
const outfit = localFont({ src: './fonts/outfit.woff2', weight: '300 700', variable: '--font-outfit', display: 'swap' });
const spaceGrotesk = localFont({ src: './fonts/space-grotesk.woff2', weight: '300 700', variable: '--font-space', display: 'swap' });
const syne = localFont({ src: './fonts/syne.woff2', weight: '400 800', variable: '--font-syne', display: 'swap' });
const righteous = localFont({ src: './fonts/righteous.woff2', weight: '400', variable: '--font-righteous', display: 'swap' });
const geist = localFont({ src: './fonts/geist.woff2', weight: '400 700', variable: '--font-geist', display: 'swap' });
const geistMono = localFont({ src: './fonts/geist-mono.woff2', weight: '400 600', variable: '--font-geist-mono', display: 'swap' });
const montserrat = localFont({ src: './fonts/montserrat.woff2', weight: '300 800', variable: '--font-montserrat', display: 'swap' });

export function generateMetadata(): Metadata {
  const demoMode = isDemoMode();

  return {
    title: messages.en['meta.title'],
    description: messages.en['meta.description'],
    icons: '/logo.svg',
    robots: demoMode
      ? {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : undefined,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} ${spaceGrotesk.variable} ${syne.variable} ${righteous.variable} ${montserrat.variable} ${geist.variable} ${geistMono.variable} ${outfit.className}`} data-theme="dark" data-design="calme" suppressHydrationWarning>
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
