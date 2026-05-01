/**
 * AuthContext component tests for web.
 *
 * Mirrors the mobile AuthContext suite but for the web flow:
 * httpOnly refresh cookie + in-memory access token + NextAuth session
 * bridge. The api module is mocked at the boundary so this test never
 * makes real fetches.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

jest.mock('../../services/api', () => ({
  api: {
    refresh:  jest.fn(),
    login:    jest.fn(),
    register: jest.fn(),
    logout:   jest.fn(),
    getMe:    jest.fn(),
  },
  setAccessToken: jest.fn(),
  setUnauthenticatedHandler: jest.fn(),
}));

const { api, setAccessToken } = require('../../services/api');
const { AuthProvider, useAuth } = require('../AuthContext');


function AuthHarness() {
  const { user, loading, login, register, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="user">{user ? user.email : 'no-user'}</span>
      <button onClick={() => login('a@b.com', 'pw')}>login</button>
      <button onClick={() => register('r@b.com', 'pw', 'R', 'consumer')}>register</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  setAccessToken.mockReset();
  // Default: refresh on mount fails (no session) — every test that wants
  // a session sets it explicitly via mockResolvedValueOnce.
  api.refresh.mockRejectedValue(new Error('no session'));
  // Wipe localStorage between tests so the "cached user" path isn't
  // contaminated.
  if (typeof window !== 'undefined') window.localStorage.clear();
});


describe('AuthProvider mount-time session restore', () => {
  test('starts loading=true; settles to ready+no-user when refresh fails', async () => {
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));
    expect(screen.getByTestId('user').textContent).toBe('no-user');
  });

  test('refresh success populates user from response body', async () => {
    api.refresh.mockResolvedValue({
      access_token: 'a',
      user: { id: 7, email: 'restored@example.com' },
    });
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('user').textContent).toBe('restored@example.com')
    );
  });

  test('cached user in localStorage hydrates instantly while refresh is in flight', async () => {
    window.localStorage.setItem('user', JSON.stringify({
      id: 1, email: 'cached@example.com', onboarding_completed: true,
    }));
    // Make refresh hang so we can observe the cached-hydration phase.
    api.refresh.mockReturnValue(new Promise(() => {}));

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    // The cached user should appear before refresh resolves.
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('cached@example.com');
    });
  });
});


describe('AuthProvider login / register / logout', () => {
  test('login stores access token, surfaces user', async () => {
    api.login.mockResolvedValue({
      access_token: 'access-1',
      user: { id: 5, email: 'a@b.com', account_type: 'diner' },
    });
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    await act(async () => { fireEvent.click(screen.getByText('login')); });

    expect(api.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' });
    expect(setAccessToken).toHaveBeenCalledWith('access-1');
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('a@b.com'));
  });

  test('register stores access token + user from body', async () => {
    api.register.mockResolvedValue({
      access_token: 'access-r',
      user: { id: 9, email: 'r@b.com', account_type: 'consumer' },
    });
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    await act(async () => { fireEvent.click(screen.getByText('register')); });

    expect(api.register).toHaveBeenCalledWith({
      email: 'r@b.com', password: 'pw', display_name: 'R', account_type: 'consumer',
    });
    expect(setAccessToken).toHaveBeenCalledWith('access-r');
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('r@b.com'));
  });

  test('logout calls /auth/logout, clears the access token + user', async () => {
    api.refresh.mockResolvedValue({
      access_token: 'a', user: { id: 1, email: 'who@b.com' },
    });
    api.logout.mockResolvedValue(undefined);
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('who@b.com'));

    await act(async () => { fireEvent.click(screen.getByText('logout')); });

    expect(api.logout).toHaveBeenCalled();
    expect(setAccessToken).toHaveBeenCalledWith(null);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('no-user'));
  });
});
