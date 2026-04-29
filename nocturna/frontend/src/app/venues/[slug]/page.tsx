import type { Metadata } from 'next';
import VenueDetailClient from '@/components/venue/VenueDetailClient';
import { apiServer, SITE_URL, SITE_NAME } from '@/lib/api-server';
import type { Venue } from '../../../../../shared/types';

type VenueFull = Venue & { promos?: any[]; events?: any[] };

const PRICE_RANGE = ['€', '€€', '€€€', '€€€€'];

const SCHEMA_TYPE: Record<string, string> = {
  restaurant: 'Restaurant', late_food: 'Restaurant',
  bar: 'BarOrPub', lounge: 'BarOrPub', speakeasy: 'BarOrPub',
  rooftop: 'BarOrPub', live_music: 'BarOrPub',
  club: 'NightClub',
};

const DAY_MAP: Record<string, string> = {
  mon: 'Mo', tue: 'Tu', wed: 'We', thu: 'Th', fri: 'Fr', sat: 'Sa', sun: 'Su',
};

function openingHoursSpec(hours: VenueFull['opening_hours']) {
  const out: any[] = [];
  for (const [day, slots] of Object.entries(hours || {})) {
    for (const slot of slots || []) {
      out.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: DAY_MAP[day] || day,
        opens: slot.open,
        closes: slot.close,
      });
    }
  }
  return out;
}

async function loadVenue(slug: string): Promise<VenueFull | null> {
  try { return await apiServer<VenueFull>(`/api/venues/${slug}`); }
  catch { return null; }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const v = await loadVenue(params.slug);
  if (!v) return { title: `Venue not found · ${SITE_NAME}` };
  const cityTitle = v.city.charAt(0).toUpperCase() + v.city.slice(1).replace('_', ' ');
  const title = `${v.name} · ${v.neighborhood}, ${cityTitle} | ${SITE_NAME}`;
  const description = v.description
    || `${v.name} in ${v.neighborhood}, ${cityTitle}. ${v.type.replace('_', ' ')}, average €${v.avg_price_eur}/pp${v.vip_available ? ', VIP table available' : ''}. Reserve through Nocturna.`;
  const url = `${SITE_URL}/venues/${v.slug}`;
  const image = v.photos?.[0];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, siteName: SITE_NAME, type: 'website',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title, description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function VenuePage({ params }: { params: { slug: string } }) {
  const v = await loadVenue(params.slug);

  const jsonLd = v ? {
    '@context': 'https://schema.org',
    '@type': SCHEMA_TYPE[v.type] || 'LocalBusiness',
    '@id': `${SITE_URL}/venues/${v.slug}`,
    name: v.name,
    description: v.description || undefined,
    address: { '@type': 'PostalAddress', streetAddress: v.address, addressLocality: v.neighborhood, addressCountry: v.country },
    geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng },
    priceRange: PRICE_RANGE[Math.max(0, Math.min(3, (v.price_level || 1) - 1))],
    servesCuisine: v.cuisine_tags?.length ? v.cuisine_tags : undefined,
    telephone: v.contact?.phone,
    url: v.contact?.website || `${SITE_URL}/venues/${v.slug}`,
    sameAs: [v.contact?.instagram, v.contact?.website].filter(Boolean),
    image: v.photos?.length ? v.photos : undefined,
    openingHoursSpecification: openingHoursSpec(v.opening_hours),
    acceptsReservations: v.reservation_required || v.walk_in_ok,
    keywords: v.vibe_tags?.join(', '),
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <VenueDetailClient slug={params.slug} initial={v} />
    </>
  );
}
