// Flavor for the diner shell. The screen and the backend endpoint
// (/api/consumer/assistant) accept any logged-in user — the naming is
// legacy from before the consumer/diner unification. We re-export the
// same component so a diner sees the same Flavor experience without
// duplicating a 350-line file that would inevitably drift out of sync
// with the consumer version. Tab placement + nav theming come from the
// diner _layout.js wrapping this screen.
export { default } from '../(consumer)/assistant';
