import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { apiServer } from '@/lib/api-server';

export const runtime = 'edge';
export const revalidate = 3600;

const SIZE = { width: 1200, height: 630 };

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  let v: any = null;
  try { v = await apiServer<any>(`/api/venues/${params.slug}`); }
  catch { /* fall through */ }

  const name = v?.name || 'Nocturna venue';
  const neighborhood = v?.neighborhood || '';
  const city = (v?.city || '').replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const type = (v?.type || '').replace('_', ' ');
  const price = v?.avg_price_eur ? `€${v.avg_price_eur}/pp` : '';
  const dress = v?.dress_code || '';
  const tags: string[] = (v?.vibe_tags || []).slice(0, 4);
  const photo = (v?.photos || [])[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex',
          backgroundColor: '#08070d', color: '#f4eede', fontFamily: 'serif',
        }}
      >
        {photo ? (
          <img src={photo} alt="" width={500} height={630} style={{ objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 500, height: 630, background: 'radial-gradient(circle at 30% 40%, #1f1a30 0%, #0e0c17 80%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 220, color: 'rgba(212,175,86,0.5)' }}>{name.charAt(0)}</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 60, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 32, color: '#d4af56', letterSpacing: 6 }}>NOCTURNA</div>
            <div style={{ fontSize: 16, color: 'rgba(212,175,86,0.6)', letterSpacing: 4, textTransform: 'uppercase' }}>
              Night Concierge
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(neighborhood || city) && (
              <div style={{ fontSize: 22, color: 'rgba(212,175,86,0.7)', letterSpacing: 2, textTransform: 'uppercase' }}>
                {[neighborhood, city].filter(Boolean).join(' · ')}
              </div>
            )}
            <div style={{ fontSize: 70, color: '#d4af56', lineHeight: 1.05, marginTop: 12, fontWeight: 600 }}>{name}</div>
            {type && <div style={{ fontSize: 26, color: '#f4eede', marginTop: 14, textTransform: 'capitalize' }}>{type}</div>}
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
                {tags.map((t) => (
                  <div key={t} style={{ padding: '6px 14px', borderRadius: 99, border: '1px solid rgba(212,175,86,0.4)', color: '#d4af56', fontSize: 18 }}>
                    {t.replace('_', ' ')}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 28, fontSize: 22, color: 'rgba(244,238,222,0.85)' }}>
            {price && <div>{price}</div>}
            {dress && <div style={{ textTransform: 'capitalize' }}>Dress: {dress}</div>}
          </div>
        </div>
      </div>
    ),
    SIZE,
  );
}
