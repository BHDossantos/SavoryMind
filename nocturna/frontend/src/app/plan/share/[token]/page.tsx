import type { Metadata } from 'next';
import { apiServer, SITE_URL, SITE_NAME } from '@/lib/api-server';
import SharedPlanClient from '@/components/results/SharedPlanClient';
import type { Plan } from '../../../../../../shared/types';

async function loadPlan(token: string): Promise<Plan | null> {
  try { return await apiServer<Plan>(`/api/plans/share/${token}`); }
  catch { return null; }
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const p = await loadPlan(params.token);
  if (!p) return { title: `Shared plan · ${SITE_NAME}`, robots: { index: false, follow: false } };

  const stops = p.stops?.length || 0;
  const cityTitle = p.city.charAt(0).toUpperCase() + p.city.slice(1).replace('_', ' ');
  const title = `${p.label} · ${cityTitle} | ${SITE_NAME}`;
  const stopNames = (p.stops || []).map(s => s.name).filter(Boolean).join(' → ');
  const description = stops
    ? `${stopNames}. ${stops} stops, ~€${p.estimated_cost_eur}/pp, ${p.total_travel_min} min total travel. Plan curated by Nocturna.`
    : `A curated night plan in ${cityTitle}. Open it in Nocturna.`;
  const url = `${SITE_URL}/plan/share/${params.token}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: SITE_NAME, type: 'website' },
    twitter: { card: 'summary', title, description },
    robots: { index: false, follow: true }, // shared plans are private-ish
  };
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const initial = await loadPlan(params.token);
  return <SharedPlanClient token={params.token} initial={initial} />;
}
