/**
 * Pantry screen smoke + critical-path tests.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

const mockUseFocusEffect = jest.fn((cb) => { cb(); });
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (cb) => mockUseFocusEffect(cb),
}));

jest.mock('../../../services/api', () => ({
  api: {
    getPantry:        jest.fn(),
    addPantryItem:    jest.fn(),
    deletePantryItem: jest.fn(),
    clearPantry:      jest.fn(),
    getPantryRecipes: jest.fn(),
  },
}));

jest.mock('../../../components/SafeScreen', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});

const { api } = require('../../../services/api');
const PantryScreen = require('../pantry').default;


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getPantry.mockResolvedValue([]);
  mockUseFocusEffect.mockClear();
});


describe('Pantry screen', () => {
  test('renders empty state when nothing in the pantry', async () => {
    const { findByText } = render(<PantryScreen />);
    expect(await findByText('Your pantry is empty')).toBeDefined();
  });

  test('renders grouped items + count when pantry has data', async () => {
    api.getPantry.mockResolvedValue([
      { id: 1, ingredient: 'Tomatoes', quantity: '3', category: 'produce' },
      { id: 2, ingredient: 'Chicken', quantity: '500g', category: 'protein' },
    ]);
    const { findByText } = render(<PantryScreen />);
    expect(await findByText('Tomatoes')).toBeDefined();
    expect(await findByText('Chicken')).toBeDefined();
  });

  test('typing + Add posts to api.addPantryItem with the form values', async () => {
    api.addPantryItem.mockResolvedValue({ id: 99, ingredient: 'Pasta', quantity: '500g', category: 'pantry' });
    const { getByPlaceholderText, findByText } = render(<PantryScreen />);
    // Wait for initial load
    await findByText('Your pantry is empty');

    fireEvent.changeText(getByPlaceholderText("What's in the fridge?"), 'Pasta');
    fireEvent.changeText(getByPlaceholderText('Qty (optional)'), '500g');

    await act(async () => { fireEvent.press(await findByText('+ Add to pantry')); });

    expect(api.addPantryItem).toHaveBeenCalledWith({
      ingredient: 'Pasta',
      quantity:   '500g',
      category:   'produce',  // default chip
    });
  });

  test('"Find recipes" button calls api.getPantryRecipes', async () => {
    api.getPantry.mockResolvedValue([
      { id: 1, ingredient: 'Tomatoes', quantity: '3', category: 'produce' },
    ]);
    api.getPantryRecipes.mockResolvedValue([
      { id: 7, name: 'Pasta arrabbiata', match_pct: 80, have_count: 4, need_count: 5 },
    ]);
    const { findByText } = render(<PantryScreen />);

    // Wait for items to render so the recipes section is visible
    await findByText('Tomatoes');
    // The button text is "Find recipes →" — match the prefix
    await act(async () => { fireEvent.press(await findByText(/Find recipes/)); });

    expect(api.getPantryRecipes).toHaveBeenCalled();
    expect(await findByText('Pasta arrabbiata')).toBeDefined();
  });
});
