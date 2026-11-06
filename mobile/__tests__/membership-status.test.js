import React from 'react';
import { render } from '@testing-library/react-native';
import Upgrade from '../app/(consumer)/upgrade';
import Billing from '../app/(restaurant)/billing';
jest.mock('expo-router', () => ({ useFocusEffect: (cb) => require('react').useEffect(cb, [cb]) }));
jest.mock('../components/NativeMembership', () => () => null);
jest.mock('../services/api', () => ({ api: {
  getBillingStatus: jest.fn().mockResolvedValue({ is_premium: true }),
  getRestaurantBillingStatus: jest.fn().mockResolvedValue({ is_pro: true }),
} }));
test.each([Upgrade, Billing])('shows existing status without a digital checkout button', async Screen => {
  const screen = render(<Screen />);
  expect(await screen.findByText('Your membership is active.')).toBeTruthy();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Email cancellation help' })).toBeTruthy();
});
