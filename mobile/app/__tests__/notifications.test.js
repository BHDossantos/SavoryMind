/**
 * Notifications screen tests — list rendering + mark-read on visit.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('../../services/api', () => ({
  api: {
    getNotifications:      jest.fn(),
    markNotificationsRead: jest.fn(),
  },
}));

jest.mock('../../components/SafeScreen', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});

const { api } = require('../../services/api');
const NotificationsScreen = require('../notifications').default;


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getNotifications.mockResolvedValue([]);
  api.markNotificationsRead.mockResolvedValue(undefined);
});


describe('Notifications screen', () => {
  test('empty state when no notifications', async () => {
    const { findByText } = render(<NotificationsScreen />);
    expect(await findByText("You're all caught up")).toBeDefined();
  });

  test('renders the notification list', async () => {
    api.getNotifications.mockResolvedValue([
      { id: 1, title: 'Booking confirmed', body: '7pm Friday', read: false, created_at: new Date().toISOString() },
      { id: 2, title: 'New review',        body: 'Anna left 5★',  read: true,  created_at: new Date().toISOString() },
    ]);
    const { findByText } = render(<NotificationsScreen />);
    expect(await findByText('Booking confirmed')).toBeDefined();
    expect(await findByText('New review')).toBeDefined();
  });

  test('calls markNotificationsRead on mount (best-effort)', async () => {
    render(<NotificationsScreen />);
    // The mark-read fire-and-forget runs on mount; nothing async to await
    // beyond the next microtask.
    await Promise.resolve();
    expect(api.markNotificationsRead).toHaveBeenCalled();
  });

  test('handles the legacy {notifications: [...]} response shape', async () => {
    // Older backend versions returned a wrapper object instead of a bare
    // array. The screen's handler tolerates both — keep that behaviour
    // verified.
    api.getNotifications.mockResolvedValue({
      notifications: [{ id: 5, title: 'Wrapper format', body: '…', read: false }],
    });
    const { findByText } = render(<NotificationsScreen />);
    expect(await findByText('Wrapper format')).toBeDefined();
  });
});
