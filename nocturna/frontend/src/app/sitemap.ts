import type { MetadataRoute } from 'next';
import { apiServer, SITE_URL } from '@/lib/api-server';

export const revalidate = 3600;

interface VenueSlug { slug: string; updated_at?: string }
interface City { slug: string }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = new Date();
  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,            lastModified: today, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${SITE_URL}/plan/new`,    lastModified: today, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE_URL}/chat`,        lastModified: today, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${SITE_URL}/groups/new`,  lastModified: today, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${SITE_URL}/premium`,     lastModified: today, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/welcome`,     lastModified: today, changeFrequency: 'monthly', priority: 0.4 },
  ];

  let cities: MetadataRoute.Sitemap = [];
  try {
    const list = await apiServer<City[]>('/api/cities');
    cities = list.map((c) => ({
      url: `${SITE_URL}/plan/new?city=${c.slug}`,
      lastModified: today,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));
  } catch { /* skip */ }

  let venues: MetadataRoute.Sitemap = [];
  try {
    // Pull a generous page from each city. With 60 Rome venues and a starter
    // set per other city, this stays well under common sitemap size limits.
    const cityList = await apiServer<City[]>('/api/cities').catch(() => [] as City[]);
    const slugs = cityList.length ? cityList.map(c => c.slug) : ['rome'];
    const all = (await Promise.all(
      slugs.map(slug => apiServer<VenueSlug[]>(`/api/venues?city=${slug}&limit=500`).catch(() => []))
    )).flat();
    venues = all.map(v => ({
      url: `${SITE_URL}/venues/${v.slug}`,
      lastModified: v.updated_at ? new Date(v.updated_at) : today,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch { /* skip */ }

  return [...fixed, ...cities, ...venues];
}
