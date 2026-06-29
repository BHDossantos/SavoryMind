/**
 * Order screen — 4-step delivery wizard tests.
 *
 * Coverage focuses on the wizard state machine since that's the bug-prone
 * surface: each step depends on the previous step's selection feeding the
 * next API call.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useFocusEffect: (cb) => cb(),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { display_name: 'Alice', first_name: 'Alice' } }),
}));

jest.mock('../../../services/api', () => ({
  api: {
    getDeliveryDishes:      jest.fn(),
    getDeliveryRestaurants: jest.fn(),
  },
}));

const { api } = require('../../../services/api');
const OrderScreen = require('../order').default;


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getDeliveryDishes.mockResolvedValue({
    dishes: [
      { id: 1, name: 'Pad Thai', emoji: '🍜', cuisine: 'Thai', time: '15-20 min', price: '$13', rating: 4.6, difficulty: 'Easy' },
    ],
  });
  api.getDeliveryRestaurants.mockResolvedValue({
    restaurants: [
      { id: 11, name: 'Bangkok Bistro', emoji: '🍴', rating: 4.5, dist_km: 1.2, eta: '20 min', fee: 'Free delivery', best_match: true },
    ],
  });
});


describe('Order screen', () => {
  test('renders craving grid on first paint', async () => {
    const { findByText } = render(<OrderScreen />);
    expect(await findByText('What are you hungry for?')).toBeDefined();
    expect(await findByText('Spicy & Bold')).toBeDefined();
    expect(api.getDeliveryDishes).not.toHaveBeenCalled();
  });

  test('selecting a craving fetches dishes for that craving id', async () => {
    const { findByTestId } = render(<OrderScreen />);
    fireEvent.press(await findByTestId('craving-spicy_bold'));
    await waitFor(() => expect(api.getDeliveryDishes).toHaveBeenCalledWith('spicy_bold', ''));
  });

  test('budget chip selection threads through to dish fetch', async () => {
    const { findByTestId } = render(<OrderScreen />);
    fireEvent.press(await findByTestId('budget-budget'));
    fireEvent.press(await findByTestId('craving-comfort'));
    await waitFor(() => expect(api.getDeliveryDishes).toHaveBeenCalledWith('comfort', 'budget'));
  });

  test('selecting a dish fetches restaurants for that dish cuisine', async () => {
    const { findByTestId } = render(<OrderScreen />);
    fireEvent.press(await findByTestId('craving-spicy_bold'));
    fireEvent.press(await findByTestId('dish-1'));
    await waitFor(() => expect(api.getDeliveryRestaurants).toHaveBeenCalledWith('Thai'));
  });

  test('full happy-path: craving → dish → restaurant → place order shows success', async () => {
    const { findByTestId, findByText } = render(<OrderScreen />);
    fireEvent.press(await findByTestId('craving-spicy_bold'));
    fireEvent.press(await findByTestId('dish-1'));
    fireEvent.press(await findByTestId('restaurant-11'));
    const addressInput = await findByTestId('address-input');
    fireEvent.changeText(addressInput, '123 Main St');
    await act(async () => {
      fireEvent.press(await findByTestId('place-order-btn'));
      // Mock fulfillment delay is 1.4s; let it run.
      await new Promise((r) => setTimeout(r, 1500));
    });
    expect(await findByTestId('order-success')).toBeDefined();
    expect(await findByText(/Order placed!/)).toBeDefined();
  });
});
