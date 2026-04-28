import { Suspense } from 'react';
import ResultsView from '@/components/results/ResultsView';

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="text-gold-400/70">Loading plans…</div>}>
      <ResultsView />
    </Suspense>
  );
}
