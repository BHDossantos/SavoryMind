'use client';
import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { pageview } from '@/lib/analytics';

function PageviewTracker() {
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    if (!pathname) return;
    pageview(pathname + (params.toString() ? `?${params.toString()}` : ''));
  }, [pathname, params]);
  return null;
}

export default function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <PageviewTracker />
    </Suspense>
  );
}
