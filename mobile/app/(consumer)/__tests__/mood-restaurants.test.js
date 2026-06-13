/**
 * Mood-to-Meal: restaurant deep-link section.
 *
 * Pins the wedge → B2B bridge on mobile: when the API returns
 * matched restaurants, the result screen shows a "Book a table that
 * serves it" card and tapping a row opens the savorymind.net/r/{slug}
 * guest booking page in the native browser.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

jest.mock('../../../services/api', () => ({
  api: { moodToMeal: jest.fn() },
}));
jest.mock('../../../services/analytics', () => ({
  track: jest.fn(),
}));

const { api } = require('../../../services/api');
const { track } = require('../../../services/analytics');
const MoodScreen = require('../mood').default;

const REC = {
  dish: 'Cacio e pepe', dish_desc: 'x',
  drink: 'Frascati', drink_desc: 'x',
  music_vibe: 'jazz', dessert: 'Maritozzo',
  share_title: 'Tonight you are: cacio e pepe',
  share_subtitle: 'Cozy, medium, Roman', cuisine: 'Italian',
};
const REST = [
  { slug: 'trattoria-roma', display_name: 'Owner', restaurant_name: 'Trattoria Roma', city: 'Roma', country: 'Italy', dining_style: 'casual', cuisines: ['Italian'], book_url: '/r/trattoria-roma' },
];

beforeEach(() => {
  api.moodToMeal.mockReset();
  track.mockReset();
});

async function arriveAtResult({ restaurants = [] } = {}) {
  api.moodToMeal.mockResolvedValue({ source: 'ai', recommendation: REC, restaurants });
  const view = render(<MoodScreen />);
  fireEvent.press(await view.findByText('Cozy'));
  fireEvent.press(view.getByText('Indulgent'));
  fireEvent.press(view.getByText(/€€ Comfortable/));
  fireEvent.press(view.getByText(/Tell me what to eat/));
  await waitFor(() => expect(api.moodToMeal).toHaveBeenCalled());
  return view;
}

describe('Restaurant matches under Mood-to-Meal', () => {
  test('shows the matches card when the API returns restaurants', async () => {
    const view = await arriveAtResult({ restaurants: REST });
    expect(await view.findByText('Trattoria Roma')).toBeDefined();
    expect(view.getByText(/Book a table that serves it/i)).toBeDefined();
  });

  test('hides the section when the API returns no restaurants', async () => {
    const view = await arriveAtResult({ restaurants: [] });
    expect(view.queryByText(/Book a table that serves it/i)).toBeNull();
  });

  test('tapping a restaurant opens the savorymind.net/r/{slug} booking page', async () => {
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue();
    const view = await arriveAtResult({ restaurants: REST });
    fireEvent.press(await view.findByText('Trattoria Roma'));
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('https://savorymind.net/r/trattoria-roma'));
    expect(track).toHaveBeenCalledWith(
      'wedge_mood_restaurant_click',
      expect.objectContaining({ slug: 'trattoria-roma', platform: 'mobile' }),
    );
    openSpy.mockRestore();
  });
});
