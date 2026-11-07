import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountDeletion from '../src/pages/legal/account-deletion';
jest.mock('next/head', () => ({ __esModule: true, default: () => null }));
beforeEach(() => { window.history.replaceState(null, '', '/legal/account-deletion'); global.fetch = jest.fn(); });
test('fragment token is removed without consuming it until explicit confirmation', async () => {
  window.history.replaceState(null, '', '/legal/account-deletion#token=one-time-test');
  global.fetch.mockResolvedValue({ ok: true });
  render(<AccountDeletion />);
  await screen.findByRole('button', { name: 'Confirm deletion request' });
  expect(window.location.hash).toBe('');
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion request' }));
  await screen.findByText(/Your verified request is saved for review/);
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/delete-request/verify'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'one-time-test' }) }));
});
test('failed verification never claims completion', async () => {
  window.history.replaceState(null, '', '/legal/account-deletion#token=expired');
  global.fetch.mockResolvedValue({ ok: false });
  render(<AccountDeletion />);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm deletion request' }));
  await screen.findByRole('alert');
  expect(screen.queryByText(/Your verified request is saved/)).toBeNull();
});
test('public intake requires mailbox verification and does not claim deletion', async () => {
  global.fetch.mockResolvedValue({ ok: true });
  render(<AccountDeletion />);
  fireEvent.change(screen.getByLabelText(/Email address on the account/), { target: { value: 'me@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Request account deletion' }));
  await waitFor(() => expect(screen.getByText(/it is not actionable until verified/)).toBeTruthy());
});
