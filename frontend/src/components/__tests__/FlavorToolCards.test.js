/**
 * FlavorToolCards tests (Phase 12 component, Phase 13 coverage).
 *
 * This component turns Flavor's tool_calls[].result payloads into
 * inline cards. The branching is all keyed on tool name + result
 * shape, so the tests walk each renderable tool plus the
 * fall-through cases (errors, non-renderable tools, empty input).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

// next/link just renders an <a> in tests — stub it so the recipe
// deep-link cards render without a real Next router.
jest.mock('next/link', () => {
  return ({ href, children }) => <a href={typeof href === 'string' ? href : '#'}>{children}</a>;
});

const FlavorToolCards = require('../FlavorToolCards').default;


function tc(name, result) {
  return { name, args: {}, result };
}


describe('FlavorToolCards — fall-through cases', () => {
  it('renders nothing for empty / missing toolCalls', () => {
    const { container: c1 } = render(<FlavorToolCards toolCalls={[]} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<FlavorToolCards toolCalls={undefined} />);
    expect(c2.firstChild).toBeNull();
  });

  it('renders nothing when the batch has only non-renderable tools', () => {
    // Action + memory tools have no card renderer — ghost line covers them.
    const { container } = render(<FlavorToolCards toolCalls={[
      tc('add_to_pantry', { ok: true, ingredient: 'eggs' }),
      tc('remember_fact', { ok: true, fact: 'vegan' }),
    ]} />);
    expect(container.firstChild).toBeNull();
  });

  it('skips a tool call whose result carries an error', () => {
    const { container } = render(<FlavorToolCards toolCalls={[
      tc('search_wines', { error: 'catalog unavailable' }),
    ]} />);
    expect(container.firstChild).toBeNull();
  });

  it('skips a tool call with a null / non-object result', () => {
    const { container } = render(<FlavorToolCards toolCalls={[
      tc('search_wines', null),
      tc('search_recipes', 'oops not an object'),
    ]} />);
    expect(container.firstChild).toBeNull();
  });
});


describe('FlavorToolCards — wine', () => {
  it('renders wine cards from search_wines', () => {
    render(<FlavorToolCards toolCalls={[
      tc('search_wines', { count: 2, wines: [
        { slug: 'malbec', name: 'Malbec', style: 'Full-bodied Red', flavor_profile: 'Plum, blackberry', price_range: '$10-80', serving_temp: '16-18C' },
        { slug: 'rioja', name: 'Rioja', style: 'Medium Red', flavor_profile: 'Cherry, vanilla' },
      ] }),
    ]} />);
    expect(screen.getByText('Malbec')).toBeInTheDocument();
    expect(screen.getByText('Rioja')).toBeInTheDocument();
    expect(screen.getByText('Full-bodied Red')).toBeInTheDocument();
  });

  it('renders a confidence badge on get_wine_pairing results', () => {
    render(<FlavorToolCards toolCalls={[
      tc('get_wine_pairing', { dish: 'steak', pairings: [
        { name: 'Cabernet Sauvignon', style: 'Full-bodied Red', confidence: 0.92, rationale: 'Tannins cut the fat.' },
      ] }),
    ]} />);
    expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Tannins cut the fat.')).toBeInTheDocument();
  });
});


describe('FlavorToolCards — beer + spirits', () => {
  it('renders beer cards from search_beers', () => {
    render(<FlavorToolCards toolCalls={[
      tc('search_beers', { count: 1, beers: [
        { name: 'West Coast IPA', style: 'IPA', abv: 6.5, flavour: 'Citrus, pine', serve: '8C, tall glass' },
      ] }),
    ]} />);
    expect(screen.getByText('West Coast IPA')).toBeInTheDocument();
    expect(screen.getByText(/6.5% ABV/)).toBeInTheDocument();
  });

  it('renders spirit cards from get_spirits_pairing', () => {
    render(<FlavorToolCards toolCalls={[
      tc('get_spirits_pairing', { dish: 'chocolate cake', pairings: [
        { name: 'Single Malt Scotch', spirit: 'Whisky', region: 'Speyside', flavour: 'Honey, oak' },
      ] }),
    ]} />);
    expect(screen.getByText('Single Malt Scotch')).toBeInTheDocument();
    expect(screen.getByText(/Speyside/)).toBeInTheDocument();
  });
});


describe('FlavorToolCards — recipes', () => {
  it('renders recipe cards from search_recipes', () => {
    render(<FlavorToolCards toolCalls={[
      tc('search_recipes', { recipes: [
        { id: 1, title: 'Beef Bourguignon', cuisine: 'French', time_minutes: 180, difficulty: 'Medium', image_emoji: '🥩', description: 'Slow-braised classic.' },
      ] }),
    ]} />);
    expect(screen.getByText('Beef Bourguignon')).toBeInTheDocument();
    expect(screen.getByText('French')).toBeInTheDocument();
  });

  it('recipe cards with an id deep-link into guided cooking', () => {
    render(<FlavorToolCards toolCalls={[
      tc('get_recipe', { id: 7, title: 'Carbonara', cuisine: 'Italian' }),
    ]} />);
    const link = screen.getByText('Carbonara').closest('a');
    expect(link).toHaveAttribute('href', '/consumer/guided-cooking?id=7');
  });

  it('renders suggest_tonight top_pick + runners_up as recipe cards', () => {
    render(<FlavorToolCards toolCalls={[
      tc('suggest_tonight', {
        based_on: {},
        top_pick: { id: 1, title: 'Top Dish', cuisine: 'Thai' },
        runners_up: [
          { id: 2, title: 'Runner One', cuisine: 'Thai' },
          { id: 3, title: 'Runner Two', cuisine: 'Thai' },
        ],
      }),
    ]} />);
    expect(screen.getByText('Top Dish')).toBeInTheDocument();
    expect(screen.getByText('Runner One')).toBeInTheDocument();
    expect(screen.getByText('Runner Two')).toBeInTheDocument();
  });

  it('suggest_tonight with a null top_pick still renders runners_up', () => {
    render(<FlavorToolCards toolCalls={[
      tc('suggest_tonight', { based_on: {}, top_pick: null, runners_up: [{ id: 9, title: 'Only Option' }] }),
    ]} />);
    expect(screen.getByText('Only Option')).toBeInTheDocument();
  });
});


describe('FlavorToolCards — shopping list', () => {
  it('renders the need-to-buy items', () => {
    render(<FlavorToolCards toolCalls={[
      tc('build_shopping_list', {
        recipe: 'Carbonara', recipe_id: 7,
        need_to_buy: ['400g spaghetti', '120g guanciale'],
        already_have: ['eggs', 'parmesan'],
        need_count: 2,
      }),
    ]} />);
    expect(screen.getByText(/Shopping list/)).toBeInTheDocument();
    expect(screen.getByText(/400g spaghetti/)).toBeInTheDocument();
    expect(screen.getByText(/Already in your pantry: 2 items/)).toBeInTheDocument();
  });

  it('shows the all-set state when nothing needs buying', () => {
    render(<FlavorToolCards toolCalls={[
      tc('build_shopping_list', { recipe: 'Toast', recipe_id: 1, need_to_buy: [], already_have: ['bread'], need_count: 0 }),
    ]} />);
    expect(screen.getByText(/got everything already/)).toBeInTheDocument();
  });
});


describe('FlavorToolCards — mixed batch', () => {
  it('renders cards for renderable tools and silently drops the rest', () => {
    render(<FlavorToolCards toolCalls={[
      tc('get_pantry', { count: 3, items: [] }),          // no renderer
      tc('search_wines', { wines: [{ slug: 'x', name: 'Test Wine', style: 'Red' }] }),
      tc('add_to_pantry', { ok: true }),                  // no renderer
    ]} />);
    expect(screen.getByText('Test Wine')).toBeInTheDocument();
  });
});
