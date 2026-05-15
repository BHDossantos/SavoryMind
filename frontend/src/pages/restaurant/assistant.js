// Flavor for the restaurant shell. The backend's /api/consumer/assistant
// endpoint accepts any logged-in user — assistant_service routes through
// the per-role tool registry, so a restaurant account gets restaurant
// tools (sales, sentiment, inventory) instead of consumer ones (pairings,
// recipes). The UI is identical, so we re-export the consumer page
// rather than duplicating 300 lines that would drift out of sync.
//
// The Layout sidebar nav entry routes here; auth gating in _app.js then
// wraps this Component in the restaurant Layout, not ConsumerLayout,
// because /restaurant/* paths aren't consumer routes.
export { default } from "../consumer/assistant";
