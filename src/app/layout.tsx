import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import './themes.css';
import './design-calme.css';
import './widgets-content.css';
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
// Quote styles only: not preloaded, a browser fetches one when a quote uses it.
const cormorant = localFont({ src: './fonts/cormorant-garamond-italic.woff2', weight: '400 600', style: 'italic', variable: '--font-quote-literary', display: 'swap', preload: false });
const fell = localFont({ src: './fonts/im-fell-english-italic.woff2', weight: '400', style: 'italic', variable: '--font-quote-quill', display: 'swap', preload: false });
const pinyon = localFont({ src: './fonts/pinyon-script.woff2', weight: '400', variable: '--font-quote-calligraphy', display: 'swap', preload: false });
const caveat = localFont({ src: './fonts/caveat.woff2', weight: '400 700', variable: '--font-quote-pen', display: 'swap', preload: false });
const courierPrime = localFont({ src: './fonts/courier-prime.woff2', weight: '400', variable: '--font-quote-typewriter', display: 'swap', preload: false });

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
      <body className={`${outfit.variable} ${spaceGrotesk.variable} ${syne.variable} ${righteous.variable} ${montserrat.variable} ${geist.variable} ${geistMono.variable} ${cormorant.variable} ${fell.variable} ${pinyon.variable} ${caveat.variable} ${courierPrime.variable} ${outfit.className}`} data-theme="dark" data-design="calme" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('nd-theme-preset');
                  if (theme && theme !== 'nasdash') {
                    document.body.classList.add('theme-' + theme);
                  }
                  // The wallpaper from the last visit, shown while the dashboard loads.
                  var bg = localStorage.getItem('nd-bg-preset');
                  if (bg && /^[A-Za-z0-9_.:/?=&%#-]+$/.test(bg)) {
                    document.documentElement.style.setProperty('--nd-boot-wallpaper', 'linear-gradient(var(--nd-wallpaper-veil), var(--nd-wallpaper-veil)), url("' + bg + '")');
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
        {process.env.VERCEL === '1' && isDemoMode() && <Analytics />}
      </body>
    </html>
  );
}
