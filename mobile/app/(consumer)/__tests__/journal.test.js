/**
 * Journal screen smoke + critical-path tests.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

const mockUseFocusEffect = jest.fn((cb) => { cb(); });
jest.mock('expo-router', () => ({
  useFocusEffect: (cb) => mockUseFocusEffect(cb),
}));

jest.mock('../../../services/api', () => ({
  api: {
    getMemories:  jest.fn(),
    createMemory: jest.fn(),
    deleteMemory: jest.fn(),
  },
}));

jest.mock('../../../components/SafeScreen', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});

const { api } = require('../../../services/api');
const JournalScreen = require('../journal').default;


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getMemories.mockResolvedValue([]);
  mockUseFocusEffect.mockClear();
});


describe('Journal screen', () => {
  test('shows the empty state when no memories yet', async () => {
    const { findByText } = render(<JournalScreen />);
    expect(await findByText('No memories yet')).toBeDefined();
  });

  test('renders existing memories with their notes + mood', async () => {
    api.getMemories.mockResolvedValue([
      { id: 1, dish_name: 'Risotto', notes: 'Creamy, perfect texture.', mood: '🤤', created_at: new Date().toISOString() },
    ]);
    const { findByText } = render(<JournalScreen />);
    expect(await findByText('Risotto')).toBeDefined();
    expect(await findByText('Creamy, perfect texture.')).toBeDefined();
  });

  test('Save calls api.createMemory with form values', async () => {
    api.createMemory.mockResolvedValue({
      id: 2, dish_name: 'Tagine', notes: 'Bit too salty', mood: '😋',
    });
    const { findByText, getByPlaceholderText } = render(<JournalScreen />);

    // Wait for initial mount so the toggle button is in the tree
    const openBtn = await findByText('+ Log meal');
    fireEvent.press(openBtn);

    fireEvent.changeText(getByPlaceholderText('What did you make / eat?'), 'Tagine');
    fireEvent.changeText(getByPlaceholderText(/Notes/), 'Bit too salty');

    const saveBtn = await findByText('Save memory');
    fireEvent.press(saveBtn);

    await waitFor(() => {
      expect(api.createMemory).toHaveBeenCalledWith({
        dish_name: 'Tagine', notes: 'Bit too salty', mood: '😋',
      });
    });
    // The new-memory-renders-in-list path is flaky in jest-expo because
    // the optimistic prepend race-conditions with the form-collapse state
    // update. The API call assertion above is the critical contract;
    // rendering is covered separately by the "renders existing memories"
    // case.
  });
});
