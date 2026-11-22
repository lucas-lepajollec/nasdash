import type { MetadataRoute } from 'next';
import { messages } from '@/i18n/messages';

/**
 * Installing NasDash on a phone's home screen (Safari: Share, Add to Home
 * Screen; Chrome: Install app) opens it full screen, like an app. The phone
 * header leaves room for the status bar and the home indicator (mobile.css).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NasDash',
    short_name: 'NasDash',
    description: messages.en['meta.description'],
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#111318',
    theme_color: '#111318',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
