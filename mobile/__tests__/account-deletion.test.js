import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AccountDeletion from '../components/AccountDeletion';
import { api } from '../services/api';
jest.mock('../services/api', () => ({ api: { requestAccountDeletion: jest.fn() } }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { email: 'person@example.com' } }) }));
beforeEach(() => { jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());
test('asks for confirmation before submitting a deletion request', async () => {
  api.requestAccountDeletion.mockResolvedValue({ ok: true, request_id: 'request-123' });
  const screen = render(<AccountDeletion />);
  fireEvent.press(screen.getByText('Delete account'));
  expect(api.requestAccountDeletion).not.toHaveBeenCalled();
  const actions = Alert.alert.mock.calls[0][2];
  expect(actions[0].style).toBe('cancel');
  await act(async () => actions[1].onPress());
  expect(api.requestAccountDeletion).toHaveBeenCalledWith({});
  expect(screen.getByText(/Your account has not been deleted yet/)).toBeTruthy();
  expect(screen.queryByText(/30 days/)).toBeNull();
});
test('shows a retryable failure when delivery fails', async () => {
  api.requestAccountDeletion.mockRejectedValue(new Error('Unavailable'));
  const screen = render(<AccountDeletion />);
  fireEvent.press(screen.getByText('Delete account'));
  await act(async () => Alert.alert.mock.calls[0][2][1].onPress());
  await waitFor(() => expect(screen.getByText(/could not be sent/)).toBeTruthy());
  expect(screen.queryByText(/request received/)).toBeNull();
});
