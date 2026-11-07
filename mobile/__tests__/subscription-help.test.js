import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SubscriptionHelp from '../components/SubscriptionHelp';

afterEach(() => jest.restoreAllMocks());
test('opens only an unsent support email, without a checkout or cancellation claim', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const screen = render(<SubscriptionHelp />);
  fireEvent.press(screen.getByRole('button', { name: 'Email cancellation help' }));
  await waitFor(() => expect(open).toHaveBeenCalledWith('mailto:hello@savorymind.net?subject=Subscription%20cancellation%20help'));
  expect(screen.getByText(/does not confirm cancellation/)).toBeTruthy();
});
test('shows a manual email fallback when no email app can open', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('No handler'));
  const screen = render(<SubscriptionHelp />);
  fireEvent.press(screen.getByRole('button', { name: 'Email cancellation help' }));
  expect(await screen.findByText(/Your email app could not be opened/)).toBeTruthy();
  expect(screen.getByText('hello@savorymind.net')).toBeTruthy();
});
