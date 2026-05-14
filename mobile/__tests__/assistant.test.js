/**
 * Culinary Assistant screen tests — verifies the chat UI calls
 * api.askAssistant on send, renders the response inline, and falls
 * back to a graceful error message on failure.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

// Declare the mock fn inside the factory and re-grab it via require()
// after the hoist runs. Trying to close over an outer-scope variable
// (even one prefixed with `mock`) doesn't work cleanly for Jest's
// auto-hoist when the factory captures the binding pre-initialisation.
jest.mock('../services/api', () => ({
  // Phase 14 — the screen calls listConversations() on mount to resume
  // the latest thread. Default it to "no prior conversations" so tests
  // start on a fresh chat unless they override it.
  api: {
    askAssistant: jest.fn(),
    listConversations: jest.fn().mockResolvedValue({ conversations: [] }),
    getConversation: jest.fn(),
  },
}));
const { api } = require('../services/api');

const AssistantScreen = require('../app/(consumer)/assistant').default;


beforeEach(() => {
  mockBack.mockReset();
  api.askAssistant.mockReset();
  // Keep the mount-resume effect quiet — no prior conversations.
  api.listConversations.mockReset().mockResolvedValue({ conversations: [] });
  api.getConversation.mockReset();
});


describe('Assistant screen', () => {
  test('renders the welcome message and suggestion chips on mount', () => {
    const { getByText } = render(<AssistantScreen />);
    expect(getByText("Hey, I'm Flavor 👋")).toBeTruthy();
    expect(getByText('Substitute for buttermilk?')).toBeTruthy();
  });

  test('typing + Send calls askAssistant with the question', async () => {
    api.askAssistant.mockResolvedValue({ title: 'Resting times', answer: 'Rest 5 minutes.' });

    const { getByText, getByPlaceholderText } = render(<AssistantScreen />);
    fireEvent.changeText(
      getByPlaceholderText('Ask anything — recipes, techniques, pairings, fixes…'),
      'How long to rest a steak?',
    );

    await act(async () => { fireEvent.press(getByText('Send')); });

    expect(api.askAssistant).toHaveBeenCalledWith('How long to rest a steak?', null);
    await waitFor(() => expect(getByText('Rest 5 minutes.')).toBeTruthy());
    expect(getByText('Resting times')).toBeTruthy();
  });

  test('tapping a suggestion chip sends that suggestion', async () => {
    api.askAssistant.mockResolvedValue({ title: 'Buttermilk swap', answer: 'Use 1 cup milk + 1 tbsp lemon juice.' });

    const { getByText } = render(<AssistantScreen />);
    await act(async () => { fireEvent.press(getByText('Substitute for buttermilk?')); });

    expect(api.askAssistant).toHaveBeenCalledWith('Substitute for buttermilk?', null);
    await waitFor(() => expect(getByText('Use 1 cup milk + 1 tbsp lemon juice.')).toBeTruthy());
  });

  test('rejection surfaces an in-thread "Oops" message instead of crashing', async () => {
    api.askAssistant.mockRejectedValue(new Error('Network down'));

    const { getByText, getByPlaceholderText } = render(<AssistantScreen />);
    fireEvent.changeText(
      getByPlaceholderText('Ask anything — recipes, techniques, pairings, fixes…'),
      'something',
    );

    await act(async () => { fireEvent.press(getByText('Send')); });

    await waitFor(() => expect(getByText('Oops')).toBeTruthy());
    expect(getByText('Network down')).toBeTruthy();
  });

  test('back arrow calls router.back()', () => {
    const { getByText } = render(<AssistantScreen />);
    fireEvent.press(getByText('← Back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
