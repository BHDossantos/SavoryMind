// Flavor for the restaurant shell. The backend's /api/consumer/assistant
// endpoint accepts any logged-in user — the assistant_service branches
// on account_type so a restaurant account gets the restaurant tool set
// (sales lookups, sentiment summaries, etc.) rather than the consumer
// pairing/recipe tools. The UI shell is identical, so we re-export the
// consumer screen rather than duplicating it.
export { default } from '../(consumer)/assistant';
