import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

/** Public, indexable routes only. Authenticated app routes are intentionally
 *  excluded (they redirect to login and must not be indexed). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, '');
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
