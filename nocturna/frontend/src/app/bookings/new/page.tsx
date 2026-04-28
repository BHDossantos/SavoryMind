import { Suspense } from 'react';
import BookingForm from '@/components/booking/BookingForm';

export default function NewBooking() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <BookingForm />
    </Suspense>
  );
}
