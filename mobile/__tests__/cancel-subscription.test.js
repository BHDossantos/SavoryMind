import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import CancelSubscription from '../components/CancelSubscription';
import { api } from '../services/api';
jest.mock('../services/api', () => ({ api: { cancelSubscription: jest.fn() } }));
beforeEach(() => { jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());
test('requires confirmation and displays only provider-confirmed cancellation', async () => {
  api.cancelSubscription.mockResolvedValue({ confirmed: true, message: 'Cancellation scheduled.' });
  const screen = render(<CancelSubscription status={{ can_cancel: true }} />);
  fireEvent.press(screen.getByText('Cancel subscription renewal'));
  expect(api.cancelSubscription).not.toHaveBeenCalled();
  await act(async () => Alert.alert.mock.calls[0][2][1].onPress());
  expect(screen.getByText('Cancellation scheduled.')).toBeTruthy();
  expect(screen.queryByText('Cancel subscription renewal')).toBeNull();
});
test('failed cancellation stays retryable and never reports success', async () => {
  api.cancelSubscription.mockRejectedValue(new Error('Provider outage'));
  const screen = render(<CancelSubscription status={{ can_cancel: true }} />);
  fireEvent.press(screen.getByText('Cancel subscription renewal'));
  await act(async () => Alert.alert.mock.calls[0][2][1].onPress());
  expect(screen.getByText(/Cancellation could not be confirmed/)).toBeTruthy();
  expect(screen.getByText('Cancel subscription renewal')).toBeTruthy();
});
test('does not offer cancelling a renewal already cancelled', () => {
  const screen = render(<CancelSubscription status={{ can_cancel: true, cancel_at_period_end: true }} />);
  expect(screen.queryByText('Cancel subscription renewal')).toBeNull();
  expect(screen.getByText(/scheduled to end/)).toBeTruthy();
});
