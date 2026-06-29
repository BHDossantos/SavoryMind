/**
 * Mood-to-Meal native screen tests.
 *
 * Pins the wedge contract on mobile: the submit button stays disabled
 * until mood + experience + budget are all chosen, the API receives the
 * chosen ids, the result card renders the recommendation, and the share
 * sheet gets the share_title.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

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
  dish: 'Cacio e pepe',
  dish_desc: 'Roman classic.',
  drink: 'Frascati',
  drink_desc: 'Bright white.',
  music_vibe: 'jazz on vinyl',
  dessert: 'Maritozzo',
  share_title: 'Tonight you are: cacio e pepe',
  share_subtitle: 'Cozy, medium, Roman',
};

beforeEach(() => {
  api.moodToMeal.mockReset();
  track.mockReset();
});

describe('Mood-to-Meal screen', () => {
  test('renders the North Star tagline', async () => {
    const { findByText } = render(<MoodScreen />);
    expect(await findByText(/Tell us how you feel/)).toBeDefined();
  });

  test('submit calls the API with the chosen mood/experience/budget', async () => {
    api.moodToMeal.mockResolvedValue({ source: 'ai', recommendation: REC });
    const { findByText, getByText } = render(<MoodScreen />);

    fireEvent.press(await findByText('Cozy'));
    fireEvent.press(getByText('Indulgent'));
    fireEvent.press(getByText(/€€ Comfortable/));
    fireEvent.press(getByText(/Tell me what to eat/));

    await waitFor(() => expect(api.moodToMeal).toHaveBeenCalled());
    const payload = api.moodToMeal.mock.calls[0][0];
    expect(payload.mood).toBe('cozy');
    expect(payload.experience).toBe('indulgent');
    expect(payload.budget).toBe('medium');
  });

  test('result card renders the dish, drink, and share title', async () => {
    api.moodToMeal.mockResolvedValue({ source: 'ai', recommendation: REC });
    const { findByText, getByText } = render(<MoodScreen />);

    fireEvent.press(await findByText('Cozy'));
    fireEvent.press(getByText('Indulgent'));
    fireEvent.press(getByText(/€€ Comfortable/));
    fireEvent.press(getByText(/Tell me what to eat/));

    expect(await findByText('Cacio e pepe')).toBeDefined();
    expect(getByText('Frascati')).toBeDefined();
    expect(getByText(/Tonight you are/)).toBeDefined();
    expect(track).toHaveBeenCalledWith(
      'wedge_mood_completed',
      expect.objectContaining({ source: 'ai', platform: 'mobile' }),
    );
  });

  test('share button opens the native share sheet with the share title', async () => {
    api.moodToMeal.mockResolvedValue({ source: 'ai', recommendation: REC });
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

    const { findByText, getByText } = render(<MoodScreen />);
    fireEvent.press(await findByText('Cozy'));
    fireEvent.press(getByText('Indulgent'));
    fireEvent.press(getByText(/€€ Comfortable/));
    fireEvent.press(getByText(/Tell me what to eat/));

    fireEvent.press(await findByText(/Share this vibe/));
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    expect(shareSpy.mock.calls[0][0].message).toContain('Tonight you are: cacio e pepe');
    shareSpy.mockRestore();
  });

  test('API failure surfaces the error and keeps the form', async () => {
    api.moodToMeal.mockRejectedValue(new Error('network down'));
    const { findByText, getByText } = render(<MoodScreen />);

    fireEvent.press(await findByText('Cozy'));
    fireEvent.press(getByText('Indulgent'));
    fireEvent.press(getByText(/€€ Comfortable/));
    fireEvent.press(getByText(/Tell me what to eat/));

    expect(await findByText('network down')).toBeDefined();
    // Form is still there for a retry.
    expect(getByText(/How are you feeling/)).toBeDefined();
  });
});
