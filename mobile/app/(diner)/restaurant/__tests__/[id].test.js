/**
 * Diner restaurant detail screen tests — load + book flow.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '42' }),
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('../../../../services/api', () => ({
  api: {
    getRestaurant:   jest.fn(),
    getAvailability: jest.fn(),
    requestBooking:  jest.fn(),
  },
}));

jest.mock('../../../../components/SafeScreen', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});

const { api } = require('../../../../services/api');
const RestaurantDetail = require('../[id]').default;


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});


describe('Diner restaurant detail screen', () => {
  test('renders restaurant name + cuisine', async () => {
    api.getRestaurant.mockResolvedValue({
      id: 42,
      restaurant_name: 'Osteria',
      city: 'London',
      country: 'UK',
      restaurant_cuisine: 'Italian',
      bio: 'Family-run since 1998.',
    });
    api.getAvailability.mockResolvedValue({ available_slots: [] });
    const { findByText } = render(<RestaurantDetail />);
    expect(await findByText('Osteria')).toBeDefined();
    expect(await findByText(/London/)).toBeDefined();
    expect(await findByText('Italian')).toBeDefined();
  });

  test('renders available time slots', async () => {
    api.getRestaurant.mockResolvedValue({ id: 42, restaurant_name: 'Osteria' });
    api.getAvailability.mockResolvedValue({
      available_slots: ['18:30', '19:00', '20:00'],
    });
    const { findByText } = render(<RestaurantDetail />);
    expect(await findByText('18:30')).toBeDefined();
    expect(await findByText('19:00')).toBeDefined();
    expect(await findByText('20:00')).toBeDefined();
  });

  test('tapping a slot calls api.requestBooking with the right payload', async () => {
    api.getRestaurant.mockResolvedValue({ id: 42, restaurant_name: 'Osteria' });
    api.getAvailability.mockResolvedValue({ available_slots: ['19:30'] });
    api.requestBooking.mockResolvedValue({ id: 5, status: 'pending' });

    const { findByText } = render(<RestaurantDetail />);

    const slot = await findByText('19:30');
    fireEvent.press(slot);

    const { waitFor } = require('@testing-library/react-native');
    await waitFor(() => {
      expect(api.requestBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurant_id: 42,
          time:          '19:30',
          party_size:    2,
        })
      );
    });
  });

  test('"No slots available" empty state when availability is empty', async () => {
    api.getRestaurant.mockResolvedValue({ id: 42, restaurant_name: 'Osteria' });
    api.getAvailability.mockResolvedValue({ available_slots: [] });
    const { findByText } = render(<RestaurantDetail />);
    expect(await findByText(/No slots available/i)).toBeDefined();
  });
});
