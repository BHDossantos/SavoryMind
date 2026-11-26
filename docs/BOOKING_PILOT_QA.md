# Booking pilot: fixture rehearsal and release gate

Scope: one consenting Rome host, one fictional restaurant in a local or isolated staging database, one web guest booking path, and one signed-in diner path. Do not create reservations against public inventory. Disable or stub SMS, email, webhooks and payment providers. The existing API tests use ephemeral secrets and a local SQLite database; production concurrency still needs a separate disposable Postgres rehearsal.

## Fixture

Create a restaurant with four covers at 19:00 and four at 20:00 tomorrow, one restaurant host and two unrelated diners. Use synthetic details. Record the booking ID, diner and host status, remaining covers per slot, notification count and whether any fee entry exists. Host evidence must be observable directly on the restaurant side, not inferred from a diner screenshot. Run `cd backend && python -m pytest tests/test_public_booking.py tests/test_booking_polish.py tests/test_booking_emails.py` in the local fixture environment for existing coverage; the full cases below are proposed end-to-end gates, not assertions that the current tests pass them.

| Case | Steps | Accept only if |
| --- | --- | --- |
| Confirm | Book all four covers at 19:00. Check both sides. Repeat the same submission and race a second independent request in a disposable Postgres fixture. | One logical booking for the repeated submission and no overbooking; both sides agree on booking ID, time and party size. A full/unoffered slot is never marked confirmed. Capture the host acknowledgement separately; instant capacity confirmation alone is not host acknowledgement or a billable seat. |
| Cancel | Cancel the linked signed-in reservation from the diner side, recheck host and inventory, and retry the same cancellation. On guest path, rehearse the explicitly supported guest/host cancellation channel. | Both sides show cancelled; 19:00 covers return once; no fee; duplicate is harmless. Unrelated diner and host cannot cancel it. If guest cancellation is not supported/self-service, do not advertise it. |
| No-show | Host records no-show after the scheduled time, refresh the screen and retry the same action. Compare with a separate host-confirmed seated control. | Status persists, a no-show does not create any seated count or fee, and the control creates at most one seated record. Do not equate confirmed booking with seated arrival. |
| Reschedule | Move a confirmed booking from 19:00 to 20:00, retry it, then repeat against a full target with a separate fixture. | On success the old slot releases once, the new slot reserves once, and both sides show only the new active booking, with one notification per intended recipient and no duplicate fee. On failure, original booking remains intact. |

## Observed in source at 387612b

- `backend/app/api/routes/public_booking.py`, `book_as_guest`: a capacity check can instantly confirm and alert the host; writes a host Booking only, with no DinerBooking. A separate host acknowledgement is necessary for this pilot.
- `backend/app/services/diner_service.py`, `cancel_booking`: updates the DinerBooking only. It does not release a linked host Booking's occupied covers. Do not mark linked cancellation passed on the basis of a diner-side status.
- `frontend/src/pages/restaurant/bookings.js`: restaurant edit UI offers `no_show`. This proves neither end-to-end state agreement nor fee behavior.
- No dedicated end-to-end reschedule path was found in this review. Do not simulate an atomic move by dropping the original slot before securing the destination without documenting that limitation.

## Go/no-go

Engineering owns isolated fixture results and evidence. A consenting host must verify arrivals before booking partners or repeat-user acquisition begins. Report confirmed/booked, actually seated, and cancellations/no-shows separately. Keep pilot fees disabled until seated attribution is demonstrated. Results at initial review: all four real host cases **not tested**; linked cancellation code inspection **fails the host/inventory expectation**. Do not run release workflows, deploy or activate providers from this checklist.
