/**
 * Restaurant Sentiment screen tests — focused on the themes panel
 * (populated / empty-state / hidden-when-no-reviews branches).
 *
 * The web variant has a richer suite (chart rendering, filter, etc.) but
 * mobile parity here covers the panel-state contract that's most likely
 * to regress: the empty state must explain itself to users on a
 * Claude-less deploy or with only pre-PR-18 reviews, instead of silently
 * hiding.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useFocusEffect: (cb) => cb(),
}));

jest.mock('../../../services/api', () => ({
  api: {
    getMenuItems:        jest.fn(),
    getReviews:          jest.fn(),
    getSentimentSummary: jest.fn(),
    getReviewThemes:     jest.fn(),
  },
}));

jest.mock('../../../components/SafeScreen', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});

jest.mock('../../../components/SimpleBarChart', () => {
  const { View } = require('react-native');
  return () => <View testID="barchart-stub" />;
});

const { api } = require('../../../services/api');
const SentimentScreen = require('../sentiment').default;


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
});


describe('Sentiment screen — themes panel', () => {
  test('renders populated panel when at least one review enriched', async () => {
    api.getReviewThemes.mockResolvedValue({
      total_reviews: 10,
      enriched_reviews: 7,
      top_complaints: [{ label: 'wait time', count: 4 }],
      top_praise:     [{ label: 'fresh ingredients', count: 5 }],
      top_themes:     [{ label: 'service speed', count: 6 }],
      tone_breakdown: { frustrated: 3, positive: 4 },
    });

    const { findByText } = render(<SentimentScreen />);
    expect(await findByText('What guests are talking about')).toBeDefined();
    expect(await findByText('wait time')).toBeDefined();
    expect(await findByText('fresh ingredients')).toBeDefined();
    expect(await findByText(/From 7 of 10 reviews/i)).toBeDefined();
  });

  test('renders empty state when reviews exist but none enriched', async () => {
    api.getReviewThemes.mockResolvedValue({
      total_reviews: 10,
      enriched_reviews: 0,
      top_complaints: [], top_praise: [], top_themes: [], tone_breakdown: {},
    });

    const { findByTestId, findByText } = render(<SentimentScreen />);
    expect(await findByTestId('themes-empty')).toBeDefined();
    expect(await findByText(/None of your 10 reviews have been analysed yet/i)).toBeDefined();
  });

  test('hides panel entirely when there are no reviews at all', async () => {
    api.getReviewThemes.mockResolvedValue({
      total_reviews: 0,
      enriched_reviews: 0,
      top_complaints: [], top_praise: [], top_themes: [], tone_breakdown: {},
    });
    api.getSentimentSummary.mockResolvedValue(summary({ total_reviews: 0 }));

    const { queryByText, queryByTestId, findByText } = render(<SentimentScreen />);
    // Wait for an unrelated piece of the page to render before asserting on
    // negatives, otherwise the assertion races the initial fetch.
    await findByText('Sentiment');
    expect(queryByText('What guests are talking about')).toBeNull();
    expect(queryByTestId('themes-empty')).toBeNull();
  });
});
