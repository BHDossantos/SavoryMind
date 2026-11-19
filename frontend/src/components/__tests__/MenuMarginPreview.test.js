import { fireEvent, render, screen } from '@testing-library/react';
import MenuMarginPreview, { marginPreview } from '../MenuMarginPreview';

it('calculates contribution and a cent-rounded target without requiring sales history', () => {
  expect(marginPreview('12', '4', '30')).toMatchObject({ contribution: 8, targetPrice: 13.34 });
  expect(marginPreview('12', '4', '30').foodCost).toBeCloseTo(33.3333);
  expect(marginPreview('10', '3', '30').targetPrice).toBe(10);
});

it.each(['', ' ', 'bad', 'Infinity', '-1'])('does not treat invalid cost %p as free food', (cost) => {
  expect(marginPreview('12', cost, '30')).toEqual({ contribution: null, foodCost: null, targetPrice: null });
});

it.each(['', '0', '-1', 'Infinity'])('does not divide by an invalid price %p', (price) => {
  expect(marginPreview(price, '4', '').foodCost).toBeNull();
});

it.each(['', '0', '100', '101', 'Infinity', 'text'])('does not invent a target price for %p', (target) => {
  expect(marginPreview('12', '4', target).targetPrice).toBeNull();
});

it('distinguishes known zero cost from unknown cost and displays losses honestly', () => {
  expect(marginPreview('12', '0', '30')).toEqual({ contribution: 12, foodCost: 0, targetPrice: null });
  render(<MenuMarginPreview price="4" cost="5" onUsePrice={jest.fn()} />);
  expect(screen.getByText(/does not cover/)).toBeInTheDocument();
  expect(screen.getByText(/Contribution per serving: -1.00/)).toBeInTheDocument();
});

it('previews immediately but changes the price only on explicit use', () => {
  const usePrice = jest.fn();
  const { rerender } = render(<MenuMarginPreview price="" cost="" onUsePrice={usePrice} />);
  expect(screen.getByText(/Enter a selling price/)).toBeInTheDocument();
  rerender(<MenuMarginPreview price="12" cost="4" onUsePrice={usePrice} />);
  expect(screen.getByText(/Contribution per serving: 8.00/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Your target food cost/), { target: { value: '30' } });
  expect(screen.getByText(/Price for your target: 13.34/)).toBeInTheDocument();
  expect(usePrice).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Use this price' }));
  expect(usePrice).toHaveBeenCalledWith('13.34');
});
