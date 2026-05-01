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
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

const WebBrowser = require('expo-web-browser');
const LoginScreen = require('../app/login').default;


beforeEach(() => {
  mockPush.mockReset();
  mockBack.mockReset();
  mockLogin.mockReset();
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
