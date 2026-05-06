/**
 * Sentiment dashboard tests.
 *
 * The "themes panel renders when present" case is exactly the bug I
 * shipped earlier — web was missing the panel and no test caught it.
 * That's the highest-leverage assertion in this file.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../../services/api', () => ({
  api: {
    getMenuItems:        jest.fn(),
    getReviews:          jest.fn(),
    getSentimentSummary: jest.fn(),
    getReviewThemes:     jest.fn(),
    getDinerReviews:     jest.fn(),
  },
}));

// Recharts uses ResponsiveContainer which doesn't measure to 0 in jsdom
// and floods the test output with warnings. Replace with a passthrough.
jest.mock('recharts', () => {
  const Original = jest.requireActual('recharts');
  return {
    ...Original,
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
  };
});

const { api } = require('../../services/api');
const SentimentPage = require('../sentiment').default;


function summary(overrides = {}) {
  return {
    total_reviews: 10,
    avg_sentiment: 0.4,
    positive_count: 7,
    neutral_count: 2,
    negative_count: 1,
    avg_rating: 4.2,
    ...overrides,
  };
}


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getMenuItems.mockResolvedValue([]);
  api.getReviews.mockResolvedValue([]);
  api.getSentimentSummary.mockResolvedValue(summary());
  api.getReviewThemes.mockResolvedValue(null);
  api.getDinerReviews.mockResolvedValue({ reviews: [] });
});


describe('Sentiment page — themes panel', () => {
  test('renders the themes panel when at least one review has been enriched', async () => {
    api.getReviewThemes.mockResolvedValue({
      total_reviews: 10,
      enriched_reviews: 7,
      top_complaints: [
        { label: 'wait time',    count: 4 },
        { label: 'cold food',    count: 2 },
      ],
      top_praise: [
        { label: 'fresh ingredients', count: 5 },
      ],
      top_themes: [
        { label: 'service speed', count: 6 },
      ],
      tone_breakdown: { frustrated: 3, positive: 4 },
    });

    render(<SentimentPage />);

    await waitFor(() => {
      expect(screen.getByText('What guests are talking about')).toBeInTheDocument();
    });
    // The actual user-facing labels make it through — this is what the
    // missing panel would have failed on.
    expect(screen.getByText('wait time')).toBeInTheDocument();
    expect(screen.getByText('fresh ingredients')).toBeInTheDocument();
    expect(screen.getByText('service speed')).toBeInTheDocument();
    // Counts are visible too. Each tag is a sibling pair (label + count
    // span), so the count text node may be split — match by regex
    // which combines text across child nodes.
    const all = screen.getAllByText(/×\d/);
    const counts = all.map((el) => el.textContent).sort();
    expect(counts).toEqual(expect.arrayContaining(['×4', '×5', '×6']));
    // From {enriched_reviews} of {total_reviews} reviews
    expect(screen.getByText(/From 7 of 10 reviews/i)).toBeInTheDocument();
  });

  test('renders empty state when reviews exist but none enriched', async () => {
    // Reviews are present (so the user expects something here) but Claude
    // hasn't enriched any yet — Claude-less deploy or pre-PR-18 backlog.
    // The panel must explain why instead of silently disappearing.
    api.getReviewThemes.mockResolvedValue({
      total_reviews: 10,
      enriched_reviews: 0,
      top_complaints: [],
      top_praise: [],
      top_themes: [],
      tone_breakdown: {},
    });

    render(<SentimentPage />);

    expect(await screen.findByTestId('themes-empty')).toBeInTheDocument();
    expect(screen.getByText(/None of your 10 reviews have been analysed yet/i)).toBeInTheDocument();
    expect(screen.getByText(/backfill_themes/)).toBeInTheDocument();
    // Populated-state heading should not appear (no enriched data).
    expect(screen.queryByText(/From .* of .* reviews/i)).not.toBeInTheDocument();
  });

  test('hides the panel when there are no reviews at all', async () => {
    // Brand-new account, zero reviews. The numeric summary card already
    // shows "Total Reviews: 0" — a second empty card here would be noise.
    api.getReviewThemes.mockResolvedValue({
      total_reviews: 0,
      enriched_reviews: 0,
      top_complaints: [],
      top_praise: [],
      top_themes: [],
      tone_breakdown: {},
    });
    api.getSentimentSummary.mockResolvedValue(summary({ total_reviews: 0 }));

    render(<SentimentPage />);
    await waitFor(() => expect(api.getSentimentSummary).toHaveBeenCalled());

    expect(screen.queryByText('What guests are talking about')).not.toBeInTheDocument();
    expect(screen.queryByTestId('themes-empty')).not.toBeInTheDocument();
  });

  test('hides the panel when /api/reviews/themes 4xxs (key unset / route 404)', async () => {
    // The page wraps getReviewThemes in .catch(() => null) so a rejection
    // resolves to null and the panel cleanly hides instead of crashing
    // the whole sentiment dashboard. This is the contract the page
    // depends on — assert it.
    api.getReviewThemes.mockRejectedValue(new Error('Not Found'));

    render(<SentimentPage />);
    await waitFor(() => expect(api.getSentimentSummary).toHaveBeenCalled());
    expect(screen.queryByText('What guests are talking about')).not.toBeInTheDocument();
  });

  test('renders the numeric sentiment summary even without themes data', async () => {
    api.getReviewThemes.mockResolvedValue(null);

    render(<SentimentPage />);
    // findByText awaits with a longer timeout than waitFor by default —
    // the page's load() does 4 parallel fetches, and the summary section
    // only renders after all of them resolve.
    expect(await screen.findByText('Total Reviews')).toBeInTheDocument();
    expect(screen.getByText('Avg Rating')).toBeInTheDocument();
    expect(screen.getByText('Avg Sentiment')).toBeInTheDocument();
  });
});
