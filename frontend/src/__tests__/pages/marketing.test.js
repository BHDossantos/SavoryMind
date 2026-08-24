/**
 * Smoke tests for the acquisition (money) marketing pages. Frontend CI runs
 * Jest but not `next build`, so these guard the funnel pages against silent
 * render/import breakage — a broken calculator or guide = lost conversions.
 * They render the page and assert the key funnel copy is present.
 */
import React from 'react';
import { render } from '@testing-library/react';

jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(), replace: jest.fn(), back: jest.fn(),
    query: {}, isReady: true, pathname: '/',
  }),
}));

const Calcolatore = require('../../pages/calcolatore-spreco').default;
const Guida = require('../../pages/ridurre-lo-spreco').default;

describe('Marketing money pages render', () => {
  test('/calcolatore-spreco renders the calculator + CTA', () => {
    const { container } = render(<Calcolatore />);
    expect(container.textContent).toMatch(/Quanto sta perdendo il tuo ristorante/);
    expect(container.textContent).toMatch(/Calcola quanto perdo/);
    expect(container.textContent).toMatch(/Domande frequenti/);
  });

  test('/ridurre-lo-spreco renders the guide + funnel CTA to the calculator', () => {
    const { container } = render(<Guida />);
    expect(container.textContent).toMatch(/Come ridurre lo spreco alimentare/);
    expect(container.textContent).toMatch(/Calcola il tuo spreco/);
  });
});
