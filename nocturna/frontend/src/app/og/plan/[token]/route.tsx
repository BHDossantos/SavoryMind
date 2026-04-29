import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { apiServer } from '@/lib/api-server';

export const runtime = 'edge';
export const revalidate = 600;

const SIZE = { width: 1200, height: 630 };

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  let plan: any = null;
  try { plan = await apiServer<any>(`/api/plans/share/${params.token}`); }
  catch { /* fall through to a generic card */ }

  const label = plan?.label || 'Tonight in Nocturna';
  const stops = plan?.stops?.length || 0;
  const cost = plan?.estimated_cost_eur ? `€${plan.estimated_cost_eur}` : '';
  const travel = plan?.total_travel_min ? `${plan.total_travel_min}m` : '';
  const city = (plan?.city || '').toString().replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const stopNames: string[] = (plan?.stops || []).map((s: any) => s.name).filter(Boolean).slice(0, 4);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          backgroundColor: '#08070d',
          backgroundImage: 'radial-gradient(circle at 50% 30%, #1f1a30 0%, #0e0c17 50%, #08070d 100%)',
          color: '#f4eede', fontFamily: 'serif', padding: 70,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 38, color: '#d4af56', letterSpacing: 6 }}>NOCTURNA</div>
          <div style={{ fontSize: 18, color: 'rgba(212,175,86,0.6)', letterSpacing: 4, textTransform: 'uppercase' }}>
            Night Concierge
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {city && <div style={{ fontSize: 26, color: 'rgba(212,175,86,0.7)', letterSpacing: 2, textTransform: 'uppercase' }}>{city}</div>}
          <div style={{ fontSize: 86, color: '#d4af56', lineHeight: 1.05, marginTop: 12, fontWeight: 600 }}>{label}</div>
          {stopNames.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 28, fontSize: 30, color: '#f4eede' }}>
              {stopNames.map((n, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span>{n}</span>
                  {i < stopNames.length - 1 && <span style={{ color: '#d4af56' }}>→</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 36, fontSize: 30, color: 'rgba(244,238,222,0.85)' }}>
          {stops > 0 && <div>{stops} stops</div>}
          {cost && <div>{cost}/pp</div>}
          {travel && <div>{travel} travel</div>}
        </div>
      </div>
    ),
    SIZE,
  );
}
