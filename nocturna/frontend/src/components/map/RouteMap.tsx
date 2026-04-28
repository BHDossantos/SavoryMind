'use client';
import { useEffect, useRef } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

export interface MapPoint {
  id: number | string;
  lat: number;
  lng: number;
  label: string;
  sub?: string;
}

interface Props {
  points: MapPoint[];
  height?: number;
  showRoute?: boolean;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export function RouteMap({ points, height = 320, showRoute = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!TOKEN || !ref.current || points.length === 0) return;
    let cancelled = false;
    let map: any;

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      if (cancelled) return;
      mapboxgl.accessToken = TOKEN;

      const lngs = points.map(p => p.lng);
      const lats = points.map(p => p.lat);
      const center: [number, number] = [
        (Math.min(...lngs) + Math.max(...lngs)) / 2,
        (Math.min(...lats) + Math.max(...lats)) / 2,
      ];

      map = new mapboxgl.Map({
        container: ref.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center,
        zoom: points.length === 1 ? 14 : 13,
        attributionControl: false,
      });
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right');
      map.addControl(new mapboxgl.AttributionControl({ compact: true }));
      mapRef.current = map;

      points.forEach((p, i) => {
        const el = document.createElement('div');
        el.className = 'nocturna-pin';
        el.textContent = String(i + 1);
        new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(
            `<strong style="color:#d4af56">${escapeHtml(p.label)}</strong>${p.sub ? `<br/><span style="color:#888;font-size:11px">${escapeHtml(p.sub)}</span>` : ''}`
          ))
          .addTo(map);
      });

      if (points.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        points.forEach(p => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
      }

      if (showRoute && points.length > 1) {
        map.on('load', () => {
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature', properties: {},
              geometry: { type: 'LineString', coordinates: points.map(p => [p.lng, p.lat]) },
            },
          });
          map.addLayer({
            id: 'route-line', type: 'line', source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#d4af56', 'line-width': 3, 'line-dasharray': [2, 1.5] },
          });
        });
      }
    })();

    return () => { cancelled = true; map?.remove?.(); };
  }, [points, showRoute]);

  if (!TOKEN) return <FallbackMap points={points} height={height} />;

  return (
    <>
      <div ref={ref} style={{ height }} className="rounded-2xl overflow-hidden border border-white/10" />
      <style jsx global>{`
        .nocturna-pin {
          width: 26px; height: 26px; border-radius: 50%;
          background: #d4af56; color: #08070d; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; box-shadow: 0 0 0 3px rgba(212, 175, 86, 0.3);
          cursor: pointer;
        }
        .mapboxgl-popup-content {
          background: #1f1a30 !important; color: #f4eede !important;
          border: 1px solid rgba(212,175,86,0.3); border-radius: 12px;
        }
        .mapboxgl-popup-tip { display: none; }
      `}</style>
    </>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** SVG fallback when no Mapbox token is configured.  */
function FallbackMap({ points, height }: { points: MapPoint[]; height: number }) {
  if (points.length === 0) return null;
  const lngs = points.map(p => p.lng);
  const lats = points.map(p => p.lat);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const padX = (maxLng - minLng) * 0.15 || 0.005;
  const padY = (maxLat - minLat) * 0.15 || 0.005;
  const W = 100, H = 100;
  const project = (lng: number, lat: number): [number, number] => [
    ((lng - (minLng - padX)) / ((maxLng - minLng) + padX * 2)) * W,
    H - ((lat - (minLat - padY)) / ((maxLat - minLat) + padY * 2)) * H,
  ];
  const projected = points.map(p => project(p.lng, p.lat));
  const path = projected.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');

  return (
    <div
      className="rounded-2xl border border-white/10 relative overflow-hidden bg-night-900"
      style={{ height }}
      role="img" aria-label="Schematic route — set NEXT_PUBLIC_MAPBOX_TOKEN to enable a real map"
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <path d={path} stroke="#d4af56" strokeWidth="0.8" strokeDasharray="2 1.2" fill="none" opacity="0.7" />
        {projected.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="3" fill="#d4af56" />
            <text x={x} y={y + 1.2} fill="#08070d" fontSize="3.5" fontWeight="700" textAnchor="middle">{i + 1}</text>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-2 right-3 text-[10px] text-gold-400/60">
        Map preview · set NEXT_PUBLIC_MAPBOX_TOKEN for full map
      </div>
    </div>
  );
}
