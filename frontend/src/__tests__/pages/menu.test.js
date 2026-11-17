import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MenuPage from '../../pages/menu';
import { api } from '../../services/api';

jest.mock('../../services/api', () => ({ api: { getMenuItems: jest.fn(), createMenuItem: jest.fn() } }));

it('uses the preview price in a new menu item only after the user applies and saves it', async () => {
  api.getMenuItems.mockResolvedValue([]);
  api.createMenuItem.mockResolvedValue({});
  render(<MenuPage />);
  fireEvent.click(await screen.findByRole('button', { name: '+ Add Item' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Soup' } });
  fireEvent.change(screen.getByLabelText('Price ($)'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('Cost ($)'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText(/Your target food cost/), { target: { value: '30' } });
  expect(api.createMenuItem).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Price ($)')).toHaveValue(12);
  fireEvent.click(screen.getByRole('button', { name: 'Use this price' }));
  expect(screen.getByLabelText('Price ($)')).toHaveValue(13.34);
  expect(api.createMenuItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Add Item', exact: true }));
  await waitFor(() => expect(api.createMenuItem).toHaveBeenCalledWith(expect.objectContaining({ name: 'Soup', price: 13.34, cost: 4, orders_last_30_days: 0 })));
});
