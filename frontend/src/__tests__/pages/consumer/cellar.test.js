/**
 * Cellar catalog page tests — Phase 8 page, Phase 13 coverage.
 *
 * The Cellar fetches all three catalogs on mount and filters them
 * client-side. Tests lock in: catalog load + render, tab switching
 * (which also resets filters), free-text search, and the style
 * chip filter.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

jest.mock('next/link', () => {
  return ({ href, children }) => <a href={typeof href === 'string' ? href : '#'}>{children}</a>;
});

jest.mock('../../../services/api', () => ({
  api: {
    getWineCatalog: jest.fn(),
    getBeerCatalog: jest.fn(),
    getSpiritsCatalog: jest.fn(),
  },
}));

// The Cellar page is wrapped in <PremiumGate>, which calls useAuth(). Mock a
// premium user so the gate renders the page body (not the upgrade prompt).
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ isPremium: true, user: { plan: 'premium' } }),
}));

const { api } = require('../../../services/api');
const CellarPage = require('../../../pages/consumer/cellar').default;


const WINES = {
  count: 2,
  wines: [
    { slug: 'malbec', name: 'Malbec', style: 'Full-bodied Red', flavor_profile: 'Plum, blackberry',
      regions: ['Mendoza, Argentina'], price_range: '$10-80', serving_temp: '16-18C' },
    { slug: 'chablis', name: 'Chablis', style: 'Light-bodied White', flavor_profile: 'Citrus, flint',
      regions: ['Burgundy, France'], price_range: '$20-90', serving_temp: '8-10C' },
  ],
};
const BEERS = {
  count: 1,
  beers: [
    { name: 'West Coast IPA', style: 'IPA', brewery: 'Various Craft', abv: 6.5,
      flavour: 'Citrus, pine', serve: '8C, tall glass' },
  ],
};
const SPIRITS = {
  count: 1,
  spirits: [
    { name: 'Reposado Tequila', spirit: 'Tequila', region: 'Jalisco, Mexico', abv: 40,
      flavour: 'Agave, oak', serve: 'Neat' },
  ],
};


beforeEach(() => {
  api.getWineCatalog.mockReset().mockResolvedValue(WINES);
  api.getBeerCatalog.mockReset().mockResolvedValue(BEERS);
  api.getSpiritsCatalog.mockReset().mockResolvedValue(SPIRITS);
});


async function renderCellar() {
  let utils;
  await act(async () => { utils = render(<CellarPage />); });
  // Wait out the three-catalog fetch + loading spinner.
  await waitFor(() => expect(screen.queryByText(/Loading the cellar/)).not.toBeInTheDocument());
  return utils;
}


describe('Cellar page', () => {
  it('loads all three catalogs and renders wines on the default tab', async () => {
    await renderCellar();
    expect(api.getWineCatalog).toHaveBeenCalled();
    expect(api.getBeerCatalog).toHaveBeenCalled();
    expect(api.getSpiritsCatalog).toHaveBeenCalled();
    // Wine tab is default.
    expect(screen.getByText('Malbec')).toBeInTheDocument();
    expect(screen.getByText('Chablis')).toBeInTheDocument();
  });

  it('switches to the Beer tab and renders beer cards', async () => {
    await renderCellar();
    fireEvent.click(screen.getByText('Beer'));
    expect(screen.getByText('West Coast IPA')).toBeInTheDocument();
    // Wines are no longer shown.
    expect(screen.queryByText('Malbec')).not.toBeInTheDocument();
  });

  it('switches to the Spirits tab and renders spirit cards', async () => {
    await renderCellar();
    fireEvent.click(screen.getByText('Spirits'));
    expect(screen.getByText('Reposado Tequila')).toBeInTheDocument();
  });

  it('free-text search filters the visible cards', async () => {
    await renderCellar();
    const searchInput = screen.getByPlaceholderText(/Search wines/);
    fireEvent.change(searchInput, { target: { value: 'chablis' } });
    expect(screen.getByText('Chablis')).toBeInTheDocument();
    expect(screen.queryByText('Malbec')).not.toBeInTheDocument();
  });

  it('a style chip narrows results to that style', async () => {
    await renderCellar();
    // "Full-bodied Red" appears both as a chip <button> and as a card
    // label — target the button specifically.
    fireEvent.click(screen.getByRole('button', { name: 'Full-bodied Red' }));
    expect(screen.getByText('Malbec')).toBeInTheDocument();
    expect(screen.queryByText('Chablis')).not.toBeInTheDocument();
  });

  it('switching tabs clears an active filter', async () => {
    await renderCellar();
    // Filter wines down, then switch tabs — beer list must not be empty.
    fireEvent.change(screen.getByPlaceholderText(/Search wines/), { target: { value: 'chablis' } });
    fireEvent.click(screen.getByText('Beer'));
    // Search box reset for the beer tab → the IPA shows.
    expect(screen.getByText('West Coast IPA')).toBeInTheDocument();
  });

  it('each card deep-links into Ask Flavor with a seed question', async () => {
    await renderCellar();
    const link = screen.getAllByText(/Ask Flavor about this/)[0].closest('a');
    expect(link.getAttribute('href')).toMatch(/^\/consumer\/assistant\?q=/);
  });
});
