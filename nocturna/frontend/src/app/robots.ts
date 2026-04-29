import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/api-server';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin', '/admin/',
          '/partner', '/partner/',
          '/bookings/new',  // private form
          '/feedback/',     // user-specific
          '/me/',           // authenticated only
          '/api/',          // proxied API
          '/payments/mock', // dev-only
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
