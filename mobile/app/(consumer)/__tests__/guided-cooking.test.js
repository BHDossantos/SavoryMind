/**
 * Guided Cooking screen tests.
 *
 * Coverage:
 * - Loads recipe by id from useLocalSearchParams
 * - Renders ingredients on step 0, advances through steps
 * - Last step's "Finish" goes to the done state with the memory CTA
 * - Memory modal save calls api.createMemory with the right payload
 * - Inline assistant calls api.askAssistant
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ id: '42' }),
}));

jest.mock('../../../services/api', () => ({
  api: {
    getRecipe:     jest.fn(),
    createMemory:  jest.fn(),
    askAssistant:  jest.fn(),
  },
}));

const { api } = require('../../../services/api');
const GuidedCookingScreen = require('../guided-cooking').default;


const FAKE_RECIPE = {
  id: 42,
  title: 'Pad Thai',
  image_emoji: '🍜',
  cuisine: 'Thai',
  ingredients: ['200g rice noodles', '2 tbsp fish sauce', '1 lime'],
  steps: [
    { instruction: 'Soak the noodles' },
    { instruction: 'Make the sauce' },
    { instruction: 'Toss it all together' },
  ],
};


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  mockReplace.mockReset();
});


describe('Guided Cooking screen', () => {
  test('loads recipe by id and renders ingredients on first step', async () => {
    api.getRecipe.mockResolvedValue(FAKE_RECIPE);
    const { findByTestId, findByText } = render(<GuidedCookingScreen />);
    await waitFor(() => expect(api.getRecipe).toHaveBeenCalledWith(42));
    expect(await findByTestId('ingredients-list')).toBeDefined();
    expect(await findByText('Step 1 of 3')).toBeDefined();
    expect(await findByText('Soak the noodles')).toBeDefined();
  });

  test('advancing through all steps reveals the finish state with memory CTA', async () => {
    api.getRecipe.mockResolvedValue(FAKE_RECIPE);
    const { findByTestId, findByText } = render(<GuidedCookingScreen />);
    await waitFor(() => expect(api.getRecipe).toHaveBeenCalled());

    // Step 1 → 2 → 3
    fireEvent.press(await findByTestId('step-next'));
    fireEvent.press(await findByTestId('step-next'));
    // Step 3 button label is "🎉 Finish"
    fireEvent.press(await findByTestId('step-next'));

    expect(await findByText(/You did it!/)).toBeDefined();
    expect(await findByTestId('open-memory-modal')).toBeDefined();
  });

  test('memory modal save calls createMemory with the recipe context', async () => {
    api.getRecipe.mockResolvedValue(FAKE_RECIPE);
    api.createMemory.mockResolvedValue({ ok: true });

    const { findByTestId } = render(<GuidedCookingScreen />);
    await waitFor(() => expect(api.getRecipe).toHaveBeenCalled());
    fireEvent.press(await findByTestId('step-next'));
    fireEvent.press(await findByTestId('step-next'));
    fireEvent.press(await findByTestId('step-next'));
    fireEvent.press(await findByTestId('open-memory-modal'));

    fireEvent.press(await findByTestId('save-memory'));
    await waitFor(() => expect(api.createMemory).toHaveBeenCalledWith(expect.objectContaining({
      dish_name: 'Pad Thai',
      emoji: '🍜',
      rating: 5,
      cuisine: 'Thai',
      recipe_id: 42,
    })));
    // Successful save routes to journal
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(consumer)/journal'));
  });

  test('inline assistant calls askAssistant with the typed query', async () => {
    api.getRecipe.mockResolvedValue(FAKE_RECIPE);
    api.askAssistant.mockResolvedValue({ title: 'Try this', answer: 'Lower the heat.' });

    const { findByTestId, findByPlaceholderText, findByText } = render(<GuidedCookingScreen />);
    await waitFor(() => expect(api.getRecipe).toHaveBeenCalled());
    fireEvent.press(await findByTestId('open-assistant'));
    fireEvent.changeText(await findByPlaceholderText(/sauce is breaking/i), 'sauce broke');
    fireEvent.press(await findByText('Ask'));

    await waitFor(() => expect(api.askAssistant).toHaveBeenCalledWith('sauce broke'));
    expect(await findByText('Lower the heat.')).toBeDefined();
  });

  test('recipe-not-found shows the friendly empty state', async () => {
    api.getRecipe.mockRejectedValue(new Error('not found'));
    const { findByText } = render(<GuidedCookingScreen />);
    await waitFor(() => expect(api.getRecipe).toHaveBeenCalled());
    expect(await findByText(/Recipe not found/i)).toBeDefined();
  });
});
