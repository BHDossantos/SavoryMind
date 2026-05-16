/**
 * Login page tests for web. Form submit calls AuthContext.login,
 * blank fields show inline error, login() rejection surfaces as the
 * error banner. Social provider buttons call NextAuth's signIn().
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: mockPush, replace: jest.fn(), back: jest.fn(),
    query: {}, isReady: true,
  }),
}));

const mockSignIn = jest.fn();
jest.mock('next-auth/react', () => ({
  signIn: (...args) => mockSignIn(...args),
}));

const mockLogin = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

const LoginPage = require('../../pages/login').default;


beforeEach(() => {
  mockPush.mockReset();
  mockSignIn.mockReset();
  mockLogin.mockReset();
  // The page's useEffect calls fetch('/api/auth/providers-list') and
  // expects a JSON array. Stub it so the effect doesn't dangle.
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) })
  );
});


// The login submit handler queues a `setTimeout(() => setWarmingUp(true), 4000)`
// that fires only if the network is slow. Wrapping the click in
// `await act(...)` causes act to wait for that timer to flush, which
// trips the 5s test default. Use waitFor for assertions instead — it
// retries until the relevant state update arrives without waiting on
// the warmup timer.

describe('Login page', () => {
  function findSignInButton() {
    return screen.getAllByRole('button').find((b) => /sign in/i.test(b.textContent));
  }

  test('Sign In submit calls login() with the form values', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('you@email.com'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });
    fireEvent.click(findSignInButton());

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'password123');
    });
  });

  test('login() rejection surfaces the message inline', async () => {
    mockLogin.mockRejectedValue(new Error('Incorrect email or password.'));
    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('you@email.com'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(findSignInButton());

    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
  });

  test('clicking Continue with Google calls NextAuth signIn("google", ...)', async () => {
    // The page guards social clicks against /api/auth/providers-list —
    // unconfigured providers surface an inline message instead of
    // hitting NextAuth. Stub the list so 'google' is configured.
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(['google', 'github']) })
    );
    render(<LoginPage />);
    // Wait for the providers-list fetch to land before clicking.
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/Continue with Google/i));
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/' });
    });
  });

  test('clicking an unconfigured provider surfaces the inline "not connected" hint', async () => {
    // Default fetch stub returns [] — google is unconfigured.
    render(<LoginPage />);
    fireEvent.click(screen.getByText(/Continue with Google/i));
    expect(await screen.findByText(/Continue with Google sign-in isn't connected yet/i)).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  test('renders the email and password inputs and a Sign In button', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText('you@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(findSignInButton()).toBeDefined();
  });
});
