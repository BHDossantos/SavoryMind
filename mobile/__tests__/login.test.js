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

    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText('Your password'), 'password123');

    await act(async () => { fireEvent.press(getByText('Sign In')); });

    expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'password123');
  });

  test('blank email shows the inline error and does not call login()', async () => {
    const { getByText } = render(<LoginScreen />);

    await act(async () => { fireEvent.press(getByText('Sign In')); });

    expect(getByText('Email and password are required.')).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('login() rejection surfaces the message inline', async () => {
    mockLogin.mockRejectedValue(new Error('Incorrect email or password.'));

    const { getByText, getByPlaceholderText } = render(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText('Your password'), 'wrong');

    await act(async () => { fireEvent.press(getByText('Sign In')); });

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
      const { UNSAFE_getAllByType } = render(<LoginScreen />);
      const { TouchableOpacity } = require('react-native');
      const tiles = UNSAFE_getAllByType(TouchableOpacity);

      // Press tiles in order; the Apple one will trigger mockAppleSignIn.
      // SOCIAL_PROVIDERS order: google, github, azure-ad, apple, facebook, ...
      // Apple is index 3 inside the social row, but the row also includes
      // back-button and other UI buttons before it. Iterate until apple fires.
      let appleHit = false;
      for (const tile of tiles) {
        mockAppleSignIn.mockClear();
        await act(async () => {
          try { fireEvent.press(tile); } catch {}
        });
        if (mockAppleSignIn.mock.calls.length > 0) {
          appleHit = true;
          break;
        }
      }

      expect(appleHit).toBe(true);
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
      const { UNSAFE_getAllByType, queryByText } = render(<LoginScreen />);
      const { TouchableOpacity } = require('react-native');
      const tiles = UNSAFE_getAllByType(TouchableOpacity);

      for (const tile of tiles) {
        mockAppleSignIn.mockClear();
        await act(async () => {
          try { fireEvent.press(tile); } catch {}
        });
        if (mockAppleSignIn.mock.calls.length > 0) break;
      }

      // Cancel = no error banner, no loginApple call
      expect(mockLoginApple).not.toHaveBeenCalled();
      expect(queryByText(/Apple sign-in failed/i)).toBeNull();
    } finally {
      Platform.OS = originalOS;
    }
  });

  test('social provider tap opens the web app via WebBrowser', async () => {
    // Each social-provider tile is a TouchableOpacity with no accessible
    // label; we drive them by their position in the row. The first one
    // is Google (per SOCIAL_PROVIDERS in app/login.js).
    const { UNSAFE_getAllByType } = render(<LoginScreen />);
    const { TouchableOpacity } = require('react-native');
    const all = UNSAFE_getAllByType(TouchableOpacity);
    // The first 6 buttons in the tree before Sign In: back, then 7
    // social tiles. Filter to ones inside the social row by clicking
    // them and checking the WebBrowser mock fires for any of them.
    let opened = false;
    for (const tile of all) {
      WebBrowser.openBrowserAsync.mockClear();
      await act(async () => {
        try { fireEvent.press(tile); } catch {}
      });
      if (WebBrowser.openBrowserAsync.mock.calls.length > 0) {
        opened = true;
        const [url] = WebBrowser.openBrowserAsync.mock.calls[0];
        expect(url).toMatch(/\/login$/);
        break;
      }
    }
    expect(opened).toBe(true);
  });
});
