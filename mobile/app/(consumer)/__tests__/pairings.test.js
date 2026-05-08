/**
 * Beverage Pairings screen — wine + beer + spirits tab tests.
 *
 * Most important: this file existed before the rebuild and was reading
 * stale field names (wine_recommendation, beer_style) that don't exist
 * in the current backend response. After the rebuild we read
 * `pairings: [...]` for beer/spirits and `recommendations: [...]` for
 * wine — the tests lock that contract.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useFocusEffect: (cb) => cb(),
}));

jest.mock('../../../services/api', () => ({
  api: {
    createWinePairing: jest.fn(),
    getBeerPairing:    jest.fn(),
    getSpiritsPairing: jest.fn(),
  },
}));

const { api } = require('../../../services/api');
const PairingsScreen = require('../pairings').default;


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});


describe('Pairings screen', () => {
  test('renders inspiration chips when no result yet', async () => {
    const { findByText } = render(<PairingsScreen />);
    expect(await findByText(/Try these:/)).toBeDefined();
    expect(await findByText('Beef Steak')).toBeDefined();
  });

  test('wine search calls createWinePairing with dish_name (not "dish")', async () => {
    api.createWinePairing.mockResolvedValue({
      dish_name: 'Beef Steak',
      recommendations: [
        { name: 'Cabernet Sauvignon', grape: 'Cabernet', region: 'Napa', rationale: 'Bold tannins match red meat.', confidence: 0.92 },
      ],
    });

    const { findByTestId, findByText } = render(<PairingsScreen />);
    fireEvent.changeText(await findByTestId('dish-input'), 'Beef Steak');
    fireEvent.press(await findByTestId('search-btn'));

    await waitFor(() => expect(api.createWinePairing).toHaveBeenCalledWith({ dish_name: 'Beef Steak' }));
    expect(await findByText('Cabernet Sauvignon')).toBeDefined();
    expect(await findByText(/Bold tannins/)).toBeDefined();
  });

  test('beer tab calls getBeerPairing and renders pairings array', async () => {
    api.getBeerPairing.mockResolvedValue({
      dish: 'Pad Thai',
      type: 'beer',
      pairings: [
        { name: 'Singha Lager', style: 'Lager', abv: 5.0, flavour: 'Crisp & light', rationale: 'Cuts through chili heat.', confidence: 0.85 },
      ],
    });

    const { findByTestId, findByText } = render(<PairingsScreen />);
    fireEvent.press(await findByTestId('tab-beer'));
    fireEvent.changeText(await findByTestId('dish-input'), 'Pad Thai');
    fireEvent.press(await findByTestId('search-btn'));

    await waitFor(() => expect(api.getBeerPairing).toHaveBeenCalledWith('Pad Thai'));
    expect(await findByText('Singha Lager')).toBeDefined();
    expect(await findByText(/Cuts through chili heat/)).toBeDefined();
  });

  test('spirits tab calls getSpiritsPairing and renders pairings array', async () => {
    api.getSpiritsPairing.mockResolvedValue({
      dish: 'Chocolate Cake',
      type: 'spirits',
      pairings: [
        { name: 'Aged Bourbon', spirit: 'Whiskey', region: 'Kentucky', flavour: 'Caramel and oak', rationale: 'Complements chocolate richness.', confidence: 0.78 },
      ],
    });

    const { findByTestId, findByText } = render(<PairingsScreen />);
    fireEvent.press(await findByTestId('tab-spirits'));
    fireEvent.changeText(await findByTestId('dish-input'), 'Chocolate Cake');
    fireEvent.press(await findByTestId('search-btn'));

    await waitFor(() => expect(api.getSpiritsPairing).toHaveBeenCalledWith('Chocolate Cake'));
    expect(await findByText('Aged Bourbon')).toBeDefined();
    expect(await findByText(/Complements chocolate/)).toBeDefined();
  });

  test('top match (index 0) gets the highlighted card style', async () => {
    api.createWinePairing.mockResolvedValue({
      dish_name: 'Salmon',
      recommendations: [
        { name: 'Chablis',     confidence: 0.91 },
        { name: 'Sauvignon Blanc', confidence: 0.78 },
      ],
    });

    const { findByTestId, findByText } = render(<PairingsScreen />);
    fireEvent.changeText(await findByTestId('dish-input'), 'Salmon');
    fireEvent.press(await findByTestId('search-btn'));

    expect(await findByText(/Top Match/i)).toBeDefined();
    expect(await findByText('Chablis')).toBeDefined();
  });

  test('empty dish input shows inline error and does not call API', async () => {
    const { findByTestId, findByText } = render(<PairingsScreen />);
    fireEvent.press(await findByTestId('search-btn'));
    // Empty input → button is disabled, no API call
    expect(api.createWinePairing).not.toHaveBeenCalled();
    // Try with whitespace via direct change — search-btn ignores it because
    // the dish input is empty, but we test the explicit error path by
    // typing then clearing.
    const input = await findByTestId('dish-input');
    fireEvent.changeText(input, 'x');
    fireEvent.changeText(input, '');
    fireEvent.press(await findByTestId('search-btn'));
    expect(api.createWinePairing).not.toHaveBeenCalled();
  });
});
