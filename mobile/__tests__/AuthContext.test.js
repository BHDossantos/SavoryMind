/**
 * AuthContext component tests — exercises the actual Context provider
 * + hook the way the app does, so a regression in the auth-state
 * machine surfaces here even if api.js itself is fine.
 *
 * The api module is mocked at the boundary so this test never makes
 * real fetch calls — all of api.login/register/logout/getMe/refresh
 * are jest.fn() instances that the assertions inspect.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

// Mocks must be hoisted — declare them before importing the SUT.
jest.mock('../services/api', () => ({
  api: {
    login:       jest.fn(),
    register:    jest.fn(),
    logout:      jest.fn(),
    getMe:       jest.fn(),
    refresh:     jest.fn(),
    googleLogin: jest.fn(),
  },
  tokenStore: {
    getAccess:  jest.fn().mockResolvedValue(null),
    setAccess:  jest.fn().mockResolvedValue(undefined),
    getRefresh: jest.fn().mockResolvedValue(null),
    setRefresh: jest.fn().mockResolvedValue(undefined),
    clear:      jest.fn().mockResolvedValue(undefined),
  },
  setUnauthenticatedHandler: jest.fn(),
}));

const { api, tokenStore } = require('../services/api');
const { AuthProvider, useAuth } = require('../contexts/AuthContext');


// Tiny consumer component that exposes the AuthContext machinery to the
// test as buttons + text — keeps assertions focused on the state changes,
// not on the navigation chrome of the real screens.
function AuthHarness() {
  const { user, loading, login, register, loginGoogle, logout } = useAuth();
  return (
    <View>
      <Text testID="loading">{loading ? 'loading' : 'ready'}</Text>
      <Text testID="user">{user ? user.email : 'no-user'}</Text>
      <TouchableOpacity testID="login-btn" onPress={() => login('a@b.com', 'pw')}>
        <Text>login</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="register-btn"
        onPress={() => register({ email: 'r@b.com', password: 'pw', display_name: 'R', account_type: 'consumer' })}
      >
        <Text>register</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="google-btn" onPress={() => loginGoogle('eyJhbGc.fake-id-token')}>
        <Text>googleLogin</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="logout-btn" onPress={() => logout()}>
        <Text>logout</Text>
      </TouchableOpacity>
    </View>
  );
}


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  Object.values(tokenStore).forEach((fn) => fn.mockReset?.());
  // Default: no stored session
  tokenStore.getAccess.mockResolvedValue(null);
  tokenStore.getRefresh.mockResolvedValue(null);
  tokenStore.setAccess.mockResolvedValue(undefined);
  tokenStore.setRefresh.mockResolvedValue(undefined);
  tokenStore.clear.mockResolvedValue(undefined);
});


describe('AuthProvider', () => {
  test('starts in loading=true then settles to ready when no token is stored', async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    // Mount-time effect resolves to no-user with loading=ready.
    await waitFor(() => expect(getByTestId('loading').props.children).toBe('ready'));
    expect(getByTestId('user').props.children).toBe('no-user');
    expect(api.getMe).not.toHaveBeenCalled();
  });

  test('restores user from stored token on mount via api.getMe', async () => {
    tokenStore.getAccess.mockResolvedValue('an-existing-token');
    api.getMe.mockResolvedValue({ id: 7, email: 'restored@example.com' });

    const { getByTestId } = render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await waitFor(() => expect(getByTestId('user').props.children).toBe('restored@example.com'));
    expect(api.getMe).toHaveBeenCalledTimes(1);
  });

  test('login flow updates the user from the response', async () => {
    api.login.mockResolvedValue({
      access_token: 'a',
      refresh_token: 'r',
      user: { id: 1, email: 'a@b.com' },
    });

    const { getByTestId } = render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await waitFor(() => expect(getByTestId('loading').props.children).toBe('ready'));

    await act(async () => { fireEvent.press(getByTestId('login-btn')); });

    expect(api.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' });
    await waitFor(() => expect(getByTestId('user').props.children).toBe('a@b.com'));
  });

  test('register flow stores the user from the response (no extra getMe round-trip)', async () => {
    api.register.mockResolvedValue({
      access_token: 'a',
      refresh_token: 'r',
      user: { id: 9, email: 'r@b.com' },
    });

    const { getByTestId } = render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await waitFor(() => expect(getByTestId('loading').props.children).toBe('ready'));

    await act(async () => { fireEvent.press(getByTestId('register-btn')); });

    expect(api.register).toHaveBeenCalledWith({
      email: 'r@b.com', password: 'pw', display_name: 'R', account_type: 'consumer',
    });
    // The api.login follow-up that the old AuthContext used to do was
    // dropped — register now relies on the response body's user object.
    expect(api.login).not.toHaveBeenCalled();
    expect(api.getMe).not.toHaveBeenCalled();
    await waitFor(() => expect(getByTestId('user').props.children).toBe('r@b.com'));
  });

  test('loginGoogle hands the id_token to api.googleLogin and surfaces the user', async () => {
    api.googleLogin.mockResolvedValue({
      access_token:  'a',
      refresh_token: 'r',
      user: { id: 12, email: 'g@example.com' },
    });

    const { getByTestId } = render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await waitFor(() => expect(getByTestId('loading').props.children).toBe('ready'));

    await act(async () => { fireEvent.press(getByTestId('google-btn')); });

    expect(api.googleLogin).toHaveBeenCalledWith('eyJhbGc.fake-id-token');
    await waitFor(() => expect(getByTestId('user').props.children).toBe('g@example.com'));
  });


  test('logout clears the user and calls api.logout', async () => {
    // Start logged in
    tokenStore.getAccess.mockResolvedValue('existing-token');
    api.getMe.mockResolvedValue({ id: 1, email: 'who@b.com' });
    api.logout.mockResolvedValue(undefined);

    const { getByTestId } = render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await waitFor(() => expect(getByTestId('user').props.children).toBe('who@b.com'));

    await act(async () => { fireEvent.press(getByTestId('logout-btn')); });

    expect(api.logout).toHaveBeenCalled();
    await waitFor(() => expect(getByTestId('user').props.children).toBe('no-user'));
  });

  test('failed /me on mount wipes the bad token and falls back to no-user', async () => {
    tokenStore.getAccess.mockResolvedValue('expired-token');
    api.getMe.mockRejectedValue(new Error('Session expired'));

    const { getByTestId } = render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    await waitFor(() => expect(getByTestId('loading').props.children).toBe('ready'));
    expect(getByTestId('user').props.children).toBe('no-user');
    expect(tokenStore.clear).toHaveBeenCalled();
  });
});
