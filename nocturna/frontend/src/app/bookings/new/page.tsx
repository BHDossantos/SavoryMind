import { Suspense } from 'react';
import BookingRouter from '@/components/booking/BookingRouter';

export default function NewBooking() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <BookingRouter />
    </Suspense>
  );
}
