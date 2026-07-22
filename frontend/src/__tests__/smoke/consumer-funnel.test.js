/**
 * Consumer freeze smoke suite (pivot Section 10).
 *
 * The consumer side is frozen — no new features — but B2B work must not
 * silently break the funnel that feeds the demand/data layer. This suite
 * pins the four load-bearing moments: signup with a consumer account
 * type, the premium gate for free users, the gate opening for premium
 * users, and the upgrade CTA target staying alive.
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

jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}));

const mockRegister = jest.fn();
let mockIsPremium = false;
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister, isPremium: mockIsPremium, user: null }),
}));

const SignupPage = require('../../pages/signup').default;
const PremiumGate = require('../../components/PremiumGate').default;

beforeEach(() => {
  mockPush.mockReset();
  mockRegister.mockReset();
  mockIsPremium = false;
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) })
  );
});

describe('Consumer funnel smoke', () => {
  test('signup registers a consumer account end-to-end', async () => {
    mockRegister.mockResolvedValue({});
    const { container } = render(<SignupPage />);

    // Pick the consumer experience tile by its unique title text — the
    // subtitle of the consumer tile also says "restaurants", so match on
    // "I love food", not a generic keyword.
    const tiles = container.querySelectorAll('button[type="button"]');
    const consumerTile = Array.from(tiles).find((b) => b.textContent.includes('I love food'));
    expect(consumerTile).toBeDefined();
    fireEvent.click(consumerTile);

    const inputs = container.querySelectorAll('input');
    fireEvent.change(inputs[0], { target: { value: 'Smoke Tester' } });
    fireEvent.change(inputs[1], { target: { value: 'smoke@savorymind.net' } });
    fireEvent.change(inputs[2], { target: { value: 'password123' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'smoke@savorymind.net', 'password123', 'Smoke Tester', 'consumer'
      );
    });
  });

  test('free consumer hits the premium gate with a working upgrade CTA', () => {
    mockIsPremium = false;
    render(
      <PremiumGate feature="Wine Cellar">
        <div data-testid="gated-content" />
      </PremiumGate>
    );
    expect(screen.queryByTestId('gated-content')).toBeNull();
    expect(screen.getByText('Wine Cellar')).toBeDefined();
    // The CTA must keep pointing at the consumer upgrade page — the
    // Stripe checkout entry point for the frozen consumer funnel.
    const cta = document.querySelector('a[href="/consumer/upgrade"]');
    expect(cta).not.toBeNull();
  });

  test('premium consumer passes straight through the gate', () => {
    mockIsPremium = true;
    render(
      <PremiumGate feature="Wine Cellar">
        <div data-testid="gated-content" />
      </PremiumGate>
    );
    expect(screen.getByTestId('gated-content')).toBeDefined();
  });

  test('restaurant signup tile still registers a restaurant account', async () => {
    mockRegister.mockResolvedValue({});
    const { container } = render(<SignupPage />);
    const tiles = container.querySelectorAll('button[type="button"]');
    const restaurantTile = Array.from(tiles).find((b) => b.textContent.includes('Analytics'));
    expect(restaurantTile).toBeDefined();
    fireEvent.click(restaurantTile);

    const inputs = container.querySelectorAll('input');
    fireEvent.change(inputs[0], { target: { value: 'Trattoria Smoke' } });
    fireEvent.change(inputs[1], { target: { value: 'owner@savorymind.net' } });
    fireEvent.change(inputs[2], { target: { value: 'password123' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'owner@savorymind.net', 'password123', 'Trattoria Smoke', 'restaurant'
      );
    });
  });
});
