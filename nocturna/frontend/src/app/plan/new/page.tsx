import { Suspense } from 'react';
import PlannerWizard from '@/components/planner/PlannerWizard';

export default function PlanNew() {
  return (
    <Suspense fallback={<div className="text-gold-400/70">Loading planner…</div>}>
      <PlannerWizard />
    </Suspense>
  );
}
