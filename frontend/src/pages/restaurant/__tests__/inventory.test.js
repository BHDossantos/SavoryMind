/**
 * Inventory page tests — empty state, populated table with low-first
 * sort, add-item flow with categorize-on-blur, adjust modal, archive.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

jest.mock('../../../services/api', () => ({
  api: {
    getInventory:             jest.fn(),
    createInventoryItem:      jest.fn(),
    updateInventoryItem:      jest.fn(),
    archiveInventoryItem:     jest.fn(),
    adjustInventoryItem:      jest.fn(),
    categorizeInventoryItem:  jest.fn(),
  },
}));

jest.mock('../../../components/ConfirmDialog', () => {
  return ({ message, onConfirm, onCancel }) => (
    <div role="dialog" aria-label="confirm">
      <p>{message}</p>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
});

const { api } = require('../../../services/api');
const InventoryPage = require('../inventory').default;


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getInventory.mockResolvedValue([]);
});


describe('Inventory page', () => {
  test('renders empty state when no items', async () => {
    render(<InventoryPage />);
    expect(await screen.findByTestId('inventory-empty')).toBeInTheDocument();
    expect(screen.getByText(/Add your first one to start tracking/i)).toBeInTheDocument();
  });

  test('renders table with low-stock items first', async () => {
    api.getInventory.mockResolvedValue([
      { id: 1, name: 'Apples',   category: 'produce', unit: 'kg',     par_level: 5, current_quantity: 10, is_low: false },
      { id: 2, name: 'Bourbon',  category: 'alcohol', unit: 'bottles', par_level: 6, current_quantity: 2,  is_low: true },
      { id: 3, name: 'Cabernet', category: 'alcohol', unit: 'bottles', par_level: 4, current_quantity: 0,  is_low: true },
    ]);

    render(<InventoryPage />);

    // Wait for any item name to appear, then read the rendered order.
    await screen.findByText('Apples');
    const rows = screen.getAllByRole('row');
    // header + 3 data rows
    expect(rows).toHaveLength(4);
    // Low-stock first (alphabetical within group): Bourbon (low), Cabernet (low), Apples (ok)
    expect(rows[1]).toHaveTextContent('Bourbon');
    expect(rows[2]).toHaveTextContent('Cabernet');
    expect(rows[3]).toHaveTextContent('Apples');
    // Low badge present on the first two
    const lowBadges = screen.getAllByText(/Low/);
    expect(lowBadges).toHaveLength(2);
  });

  test('add-item form calls categorize on name blur and prefills category', async () => {
    api.categorizeInventoryItem.mockResolvedValue({ category: 'alcohol', confidence: 0.95 });

    render(<InventoryPage />);
    // Open the modal
    fireEvent.click(await screen.findByText('+ Add item'));

    const nameInput = await screen.findByPlaceholderText(/Tito's Vodka/);
    fireEvent.change(nameInput, { target: { value: "Tito's Vodka 1.75L" } });
    fireEvent.blur(nameInput);

    await waitFor(() => expect(api.categorizeInventoryItem).toHaveBeenCalledWith("Tito's Vodka 1.75L"));

    // Category dropdown should now reflect the suggestion.
    const categorySelect = screen.getAllByRole('combobox')[0];
    await waitFor(() => expect(categorySelect.value).toBe('alcohol'));
  });

  test('adjust modal posts the right delta + type', async () => {
    api.getInventory.mockResolvedValue([
      { id: 7, name: 'Cabernet', category: 'alcohol', unit: 'bottles', par_level: 6, current_quantity: 4, is_low: true },
    ]);
    api.adjustInventoryItem.mockResolvedValue({ id: 1 });

    render(<InventoryPage />);
    fireEvent.click(await screen.findByText('Adjust'));

    // Modal opens — fill it in
    const deltaInput = await screen.findByPlaceholderText(/e\.g\. 24 for delivery/);
    fireEvent.change(deltaInput, { target: { value: '24' } });
    fireEvent.click(screen.getByText('Log adjustment'));

    await waitFor(() => expect(api.adjustInventoryItem).toHaveBeenCalledWith(7, {
      adjustment_type: 'delivery',
      delta: 24,
      note: null,
    }));
  });

  test('archive flow asks for confirmation then calls archive', async () => {
    api.getInventory.mockResolvedValue([
      { id: 9, name: 'Old beer', category: 'alcohol', unit: 'bottles', par_level: 0, current_quantity: 0, is_low: false },
    ]);
    api.archiveInventoryItem.mockResolvedValue(undefined);

    render(<InventoryPage />);
    fireEvent.click(await screen.findByText('Archive'));

    // ConfirmDialog mock renders with a Confirm button
    fireEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(api.archiveInventoryItem).toHaveBeenCalledWith(9));
  });
});
