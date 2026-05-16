// Loaded after the Jest framework is set up — this is where jest-dom
// registers its custom matchers (toBeInTheDocument, toHaveTextContent,
// etc.) onto `expect`.
require('@testing-library/jest-dom');

// Initialise i18n exactly the same way the app does. Without this,
// any page that uses useTranslation() falls back to the literal key
// (e.g. "sentimentPage.totalReviews" instead of "Total Reviews"),
// which breaks getByText assertions against the English strings.
// _app.js imports this for its side effects; tests bypass _app.
require('./src/services/i18n');
