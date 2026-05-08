/**
 * Restaurant Inventory screen tests.
 *
 * Coverage:
 * - empty state
 * - populated list with low-stock badge
 * - quick-adjust bottom sheet +/- buttons compute correct delta
 * - case buttons use casePackFor(unit)
 * - add-item categorize-on-blur populates category
 */
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

const mockUseFocusEffect = jest.fn((cb) => { cb(); });
jest.mock('expo-router', () => ({
  useFocusEffect: (cb) => mockUseFocusEffect(cb),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('../../../services/api', () => ({
  api: {
    getInventory:            jest.fn(),
    createInventoryItem:     jest.fn(),
    archiveInventoryItem:    jest.fn(),
    adjustInventoryItem:     jest.fn(),
    categorizeInventoryItem: jest.fn(),
  },
}));

jest.mock('../../../components/SafeScreen', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});

jest.mock('../../../components/LoadingSpinner', () => {
  const { View } = require('react-native');
  return () => <View testID="loading" />;
});

jest.mock('../../../components/ErrorMessage', () => {
  const { View, Text } = require('react-native');
  return ({ message }) => <View><Text>{message}</Text></View>;
});

const { api } = require('../../../services/api');
const InventoryScreen = require('../inventory').default;


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getInventory.mockResolvedValue([]);
});


describe('Inventory screen', () => {
  test('shows empty state when no items', async () => {
    const { findByTestId, findByText } = render(<InventoryScreen />);
    expect(await findByTestId('inventory-empty')).toBeDefined();
    expect(await findByText(/Tap \+ Add to start tracking/i)).toBeDefined();
  });

  test('renders populated list with low-stock badge', async () => {
    api.getInventory.mockResolvedValue([
      { id: 1, name: 'Apples',   category: 'produce', unit: 'kg',     par_level: 5, current_quantity: 10, is_low: false },
      { id: 2, name: 'Bourbon',  category: 'alcohol', unit: 'bottles', par_level: 6, current_quantity: 2,  is_low: true },
    ]);

    const { findByText, findAllByText } = render(<InventoryScreen />);
    expect(await findByText('Bourbon')).toBeDefined();
    expect(await findByText('Apples')).toBeDefined();
    const lowBadges = await findAllByText(/Low/);
    expect(lowBadges.length).toBe(1);
  });

  test('quick-adjust bottom sheet +1/-1 buttons compute correct delta', async () => {
    api.getInventory.mockResolvedValue([
      { id: 7, name: 'Cabernet', category: 'alcohol', unit: 'bottles', par_level: 6, current_quantity: 4, is_low: true },
    ]);
    api.adjustInventoryItem.mockResolvedValue({ id: 1 });

    const { findByText, getByTestId } = render(<InventoryScreen />);
    fireEvent.press(await findByText('Cabernet'));

    // Sheet visible — bump +1 twice, then -1 once → delta = +1
    fireEvent.press(await getByTestId('bump-plus-1'));
    fireEvent.press(getByTestId('bump-plus-1'));
    fireEvent.press(getByTestId('bump-minus-1'));
    fireEvent.press(getByTestId('type-delivery'));
    fireEvent.press(getByTestId('bump-plus-1'));

    // Save
    fireEvent.press(getByTestId('bump-plus-1')); // delta = 3 now
    // Press save — delta should be sum of all bumps
    // Bumps so far: +1,+1,-1,+1,+1 = +3
    const saveButton = await findByText('Save');
    fireEvent.press(saveButton);

    await waitFor(() => expect(api.adjustInventoryItem).toHaveBeenCalledWith(7, {
      adjustment_type: 'delivery',
      delta: 3,
      note: null,
    }));
  });

  test('quick-adjust case buttons use casePackFor(unit)', async () => {
    api.getInventory.mockResolvedValue([
      { id: 5, name: 'Tito\'s Vodka', category: 'alcohol', unit: 'bottles', par_level: 6, current_quantity: 0, is_low: true },
    ]);
    api.adjustInventoryItem.mockResolvedValue({ id: 1 });

    const { findByText, getByTestId } = render(<InventoryScreen />);
    fireEvent.press(await findByText("Tito's Vodka"));

    // bottles → case pack of 12. Press +Case once → delta = 12.
    fireEvent.press(await getByTestId('bump-plus-case'));
    fireEvent.press(await findByText('Save'));

    await waitFor(() => expect(api.adjustInventoryItem).toHaveBeenCalledWith(5, {
      adjustment_type: 'delivery',
      delta: 12,
      note: null,
    }));
  });

  test('add-item categorize-on-blur populates category', async () => {
    api.categorizeInventoryItem.mockResolvedValue({ category: 'alcohol', confidence: 0.95 });

    const { findByText, getByTestId } = render(<InventoryScreen />);
    fireEvent.press(await findByText('+ Add'));

    const nameInput = await getByTestId('add-name-input');
    fireEvent.changeText(nameInput, "Tito's Vodka 1.75L");
    fireEvent(nameInput, 'blur');

    await waitFor(() => expect(api.categorizeInventoryItem).toHaveBeenCalledWith("Tito's Vodka 1.75L"));
  });
});
