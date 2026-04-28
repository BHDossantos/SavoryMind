'use client';
import { useSearchParams } from 'next/navigation';
import BookingForm from './BookingForm';
import PlanBookingForm from './PlanBookingForm';

export default function BookingRouter() {
  const params = useSearchParams();
  return params.get('plan_id') ? <PlanBookingForm /> : <BookingForm />;
}
