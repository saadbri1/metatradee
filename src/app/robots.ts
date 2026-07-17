import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

/** Allow the public marketing surface; keep authenticated + API routes out of
 *  the index. Sitemap points crawlers at the public routes only. */
export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url.replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/journal', '/analytics', '/settings', '/api/', '/share/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
