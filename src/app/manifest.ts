import type { MetadataRoute } from 'next';
import { messages } from '@/i18n/messages';

/**
 * Installing NasDash on a phone's home screen (Safari: Share, Add to Home
 * Screen; Chrome: Install app) opens it full screen, like an app. The phone
 * header leaves room for the status bar and the home indicator (mobile.css).
 * The NasDash logo is its icon everywhere: these manifest icons (Android,
 * Chrome, Brave), `/icons/apple-touch-icon.png` linked by the layout, and the
 * conventional `/apple-touch-icon.png`, `/apple-touch-icon-precomposed.png`
 * and `/favicon.ico` that some browsers fetch without reading the page.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'NasDash',
    short_name: 'NasDash',
    description: messages.en['meta.description'],
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#111318',
    theme_color: '#111318',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
