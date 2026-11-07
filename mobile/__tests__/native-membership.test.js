import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NativeMembership from '../components/NativeMembership';
import { api } from '../services/api';
import * as purchases from '../services/nativePurchases';
let mockUserId = 1;
const mockUpdate = jest.fn();
jest.mock('expo-router', () => ({ useFocusEffect: callback => require('react').useEffect(callback, [callback]) }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUserId }, updateUser: mockUpdate }) }));
jest.mock('../services/api', () => ({ api: { getStoreContext: jest.fn() } }));
jest.mock('../services/nativePurchases', () => ({ available: jest.fn(() => true), configure: jest.fn(), products: jest.fn(), purchase: jest.fn(), restore: jest.fn() }));
beforeEach(() => {
  mockUserId = 1;
  jest.clearAllMocks();
  api.getStoreContext.mockResolvedValue({ enabled: true, can_purchase: true, app_user_id: 'server-identity', products: ['sku'] });
  purchases.configure.mockResolvedValue(true);
  purchases.products.mockResolvedValue([{ identifier: 'sku', title: 'Premium', priceString: '$4.99', subscriptionPeriod: 'P1M' }]);
});
test('shows localized store price and period and purchases with server identity', async () => {
  purchases.purchase.mockResolvedValue({ granted: true, plan: 'premium', enabled: true, can_purchase: false });
  const screen = render(<NativeMembership />);
  fireEvent.press(await screen.findByText('Subscribe: Premium — $4.99 every 1 month'));
  await waitFor(() => expect(purchases.purchase).toHaveBeenCalledWith('sku', 'server-identity'));
  expect(await screen.findByText('Your store membership is verified.')).toBeTruthy();
  expect(mockUpdate).toHaveBeenCalledWith({ plan: 'premium' });
});
test('existing subscriber can restore without another purchase offer', async () => {
  api.getStoreContext.mockResolvedValue({ enabled: true, can_purchase: false, app_user_id: 'existing', products: ['sku'] });
  purchases.restore.mockResolvedValue({ granted: false, plan: 'free', enabled: true });
  const screen = render(<NativeMembership />);
  fireEvent.press(await screen.findByText('Restore purchases'));
  expect(screen.queryByText(/Subscribe:/)).toBeNull();
  await waitFor(() => expect(purchases.restore).toHaveBeenCalledWith('existing'));
  expect(await screen.findByText(/No active store membership/)).toBeTruthy();
});
test('does not display a purchase without a known billing period', async () => {
  purchases.products.mockResolvedValue([{ identifier: 'sku', priceString: '$4.99' }]);
  const screen = render(<NativeMembership />);
  await screen.findByText('Restore purchases');
  await waitFor(() => expect(purchases.products).toHaveBeenCalled());
  expect(screen.queryByText(/Subscribe:/)).toBeNull();
});


test('completion from a previous account never updates the new account UI', async () => {
  let finish;
  purchases.purchase.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const screen = render(<NativeMembership />);
  fireEvent.press(await screen.findByText('Subscribe: Premium — $4.99 every 1 month'));
  await waitFor(() => expect(purchases.purchase).toHaveBeenCalled());
  mockUserId = 2;
  screen.rerender(<NativeMembership />);
  finish({ granted: true, plan: 'premium', enabled: true });
  await waitFor(() => expect(purchases.configure).toHaveBeenCalledTimes(2));
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(screen.queryByText('Your store membership is verified.')).toBeNull();
});
