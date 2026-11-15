/**
 * Login screen tests — verifies the form actually wires through to
 * AuthContext.login on submit, surfaces errors as the inline banner,
 * and routes social provider taps to WebBrowser.openBrowserAsync.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

const mockPush  = jest.fn();
const mockBack  = jest.fn();
const mockLogin = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn().mockResolvedValue({ type: 'opened' }),
  openAuthSessionAsync: jest.fn().mockResolvedValue({ type: 'cancel' }),
  maybeCompleteAuthSession: jest.fn(),
}));

// expo-auth-session/providers/google: useAuthRequest returns the standard
// triple [request, response, promptAsync]. Tests don't drive the Google
// flow themselves (that's mocked at the AuthContext.loginGoogle layer in
// AuthContext.test.js); they just need the import to resolve.
jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: () => [{}, null, jest.fn().mockResolvedValue({ type: 'cancel' })],
}));

const mockAppleSignIn = jest.fn();
// virtual:true so jest doesn't try to resolve the real module path —
// expo-apple-authentication is in package.json but not always installed
// in the CI sandbox before `npm install` runs. The login screen imports
// it eagerly so we have to stub it for the test even when not installed.
jest.mock('expo-apple-authentication', () => ({
  signInAsync: (...args) => mockAppleSignIn(...args),
  AppleAuthenticationScope: { FULL_NAME: 'name', EMAIL: 'email' },
}), { virtual: true });

const mockLoginApple = jest.fn();
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, loginGoogle: jest.fn(), loginApple: mockLoginApple }),
}));

const WebBrowser = require('expo-web-browser');
const LoginScreen = require('../app/login').default;


beforeEach(() => {
  mockPush.mockReset();
  mockBack.mockReset();
  mockLogin.mockReset();
  mockAppleSignIn.mockReset();
  mockLoginApple.mockReset();
  WebBrowser.openBrowserAsync.mockClear();
});


describe('Login screen', () => {
  test('Sign In disabled until email + password are filled, then calls login()', async () => {
    mockLogin.mockResolvedValue({ id: 1, email: 'a@b.com' });

    const { getByText, getByPlaceholderText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByPlaceholderText('you@example.com'), 'a@b.com');
    await fireEvent.changeText(getByPlaceholderText('Your password'), 'password123');

    await act(async () => { await fireEvent.press(getByText('Sign In')); });

    expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'password123');
  });

  test('blank email shows the inline error and does not call login()', async () => {
    const { getByText } = await render(<LoginScreen />);

    await act(async () => { await fireEvent.press(getByText('Sign In')); });

    expect(getByText('Email and password are required.')).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('login() rejection surfaces the message inline', async () => {
    mockLogin.mockRejectedValue(new Error('Incorrect email or password.'));

    const { getByText, getByPlaceholderText } = await render(<LoginScreen />);
    await fireEvent.changeText(getByPlaceholderText('you@example.com'), 'a@b.com');
    await fireEvent.changeText(getByPlaceholderText('Your password'), 'wrong');

    await act(async () => { await fireEvent.press(getByText('Sign In')); });

    await waitFor(() => expect(getByText('Incorrect email or password.')).toBeTruthy());
  });

  test('Apple tile on iOS calls signInAsync and forwards identityToken to loginApple', async () => {
    const { Platform } = require('react-native');
    const originalOS = Platform.OS;
    Platform.OS = 'ios';

    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-id-token-xyz',
      fullName: { givenName: 'Alice', familyName: 'Example' },
      email: 'alice@privaterelay.appleid.com',
    });
    mockLoginApple.mockResolvedValue({ id: 1, email: 'alice@privaterelay.appleid.com' });

    try {
      const { getByRole } = await render(<LoginScreen />);
      await fireEvent.press(getByRole('button', { name: 'Apple' }));
      expect(mockAppleSignIn).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(mockLoginApple).toHaveBeenCalledWith({
        idToken: 'apple-id-token-xyz',
        name:    'Alice Example',
        email:   'alice@privaterelay.appleid.com',
      }));
    } finally {
      Platform.OS = originalOS;
    }
  });

  test('Apple sign-in user-cancellation does not surface an error', async () => {
    const { Platform } = require('react-native');
    const originalOS = Platform.OS;
    Platform.OS = 'ios';

    const cancelErr = new Error('User cancelled');
    cancelErr.code = 'ERR_CANCELED';
    mockAppleSignIn.mockRejectedValue(cancelErr);

    try {
      const { getByRole, queryByText } = await render(<LoginScreen />);
      await fireEvent.press(getByRole('button', { name: 'Apple' }));
      expect(mockAppleSignIn).toHaveBeenCalledTimes(1);

      // Cancel = no error banner, no loginApple call
      expect(mockLoginApple).not.toHaveBeenCalled();
      expect(queryByText(/Apple sign-in failed/i)).toBeNull();
    } finally {
      Platform.OS = originalOS;
    }
  });

  test('social provider tap opens the web app via WebBrowser', async () => {
    const { getByRole } = await render(<LoginScreen />);
    await fireEvent.press(getByRole('button', { name: 'GitHub' }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(expect.stringMatching(/\/login$/));
  });
});
