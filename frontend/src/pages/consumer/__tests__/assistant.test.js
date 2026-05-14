/**
 * Consumer assistant (Flavor chat) page tests — Phase 13 coverage.
 *
 * The assistant page is the most-changed web surface in this PR:
 * Phase 7 added history threading, Phase 12 added inline tool cards,
 * and the Cellar deep-link feeds it a ?q= seed param. These tests
 * lock in: greeting render, send → response, history threading on
 * the 2nd turn, tool-card rendering, the ?q= auto-send, and the
 * error path.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// Router mock — query is overridden per-test for the ?q= seed cases.
let mockQuery = {};
const mockReplace = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true,
    query: mockQuery,
    push: jest.fn(),
    replace: mockReplace,
  }),
}));

// next/link stub for the recipe deep-link cards FlavorToolCards renders.
jest.mock('next/link', () => {
  return ({ href, children }) => <a href={typeof href === 'string' ? href : '#'}>{children}</a>;
});

jest.mock('../../../services/api', () => ({
  // Phase 14 — the page calls listConversations() on mount to resume
  // the latest thread. Default to "no prior conversations" so tests
  // open on a fresh chat unless they override it.
  api: {
    askAssistant: jest.fn(),
    listConversations: jest.fn(),
    getConversation: jest.fn(),
  },
}));

const { api } = require('../../../services/api');
const AssistantPage = require('../assistant').default;


beforeEach(() => {
  api.askAssistant.mockReset();
  api.listConversations.mockReset().mockResolvedValue({ conversations: [] });
  api.getConversation.mockReset();
  mockReplace.mockReset();
  mockQuery = {};
  // jsdom doesn't implement scrollIntoView — the page calls it on every
  // message render. Stub it so the effect doesn't throw.
  Element.prototype.scrollIntoView = jest.fn();
});


// Phase 14 — the response carries conversation_id, not history. The
// server owns the thread; the client just threads the id.
function reply(overrides = {}) {
  return {
    title: 'Resting times',
    answer: 'Rest a 1-inch steak 5 minutes.',
    tool_calls: [],
    conversation_id: 1,
    ...overrides,
  };
}


describe('Assistant page — basics', () => {
  it('renders the Flavor greeting on mount', () => {
    render(<AssistantPage />);
    expect(screen.getByText(/Hey, I'm Flavor/)).toBeInTheDocument();
  });

  it('sends a typed message and renders the response', async () => {
    api.askAssistant.mockResolvedValue(reply());
    render(<AssistantPage />);

    const textarea = screen.getByPlaceholderText(/Ask anything/);
    fireEvent.change(textarea, { target: { value: 'How long to rest a steak?' } });
    await act(async () => { fireEvent.click(screen.getByText('Send')); });

    // Fresh conversation → first call passes conversation_id null.
    expect(api.askAssistant).toHaveBeenCalledWith('How long to rest a steak?', null);
    await waitFor(() => expect(screen.getByText('Rest a 1-inch steak 5 minutes.')).toBeInTheDocument());
    expect(screen.getByText('Resting times')).toBeInTheDocument();
  });

  it('threads the conversation_id into the second request', async () => {
    api.askAssistant
      .mockResolvedValueOnce(reply({ conversation_id: 42 }))
      .mockResolvedValueOnce(reply({ title: 'Follow-up', answer: 'A white instead.', conversation_id: 42 }));

    render(<AssistantPage />);
    const textarea = screen.getByPlaceholderText(/Ask anything/);

    fireEvent.change(textarea, { target: { value: 'wine for steak?' } });
    await act(async () => { fireEvent.click(screen.getByText('Send')); });
    await waitFor(() => expect(api.askAssistant).toHaveBeenCalledTimes(1));

    fireEvent.change(textarea, { target: { value: 'what about a white?' } });
    await act(async () => { fireEvent.click(screen.getByText('Send')); });

    // 2nd call must carry the conversation_id the 1st call returned.
    expect(api.askAssistant).toHaveBeenNthCalledWith(2, 'what about a white?', 42);
  });

  it('resumes the most recent conversation on mount', async () => {
    api.listConversations.mockResolvedValue({
      conversations: [{ id: 7, title: 'Old chat', message_count: 2, updated_at: '2026-05-14' }],
    });
    api.getConversation.mockResolvedValue({
      id: 7,
      title: 'Old chat',
      messages: [
        { role: 'user', content: 'what wine with fish?' },
        { role: 'assistant', content: [{ type: 'text', text: 'TITLE: Fish pairing\n\nGo with a crisp white.' }] },
      ],
    });

    await act(async () => { render(<AssistantPage />); });

    // The persisted thread is rebuilt into the UI.
    await waitFor(() => expect(screen.getByText('what wine with fish?')).toBeInTheDocument());
    expect(screen.getByText('Go with a crisp white.')).toBeInTheDocument();
    expect(screen.getByText('Fish pairing')).toBeInTheDocument();

    // And the next message threads that conversation's id.
    api.askAssistant.mockResolvedValue(reply({ conversation_id: 7 }));
    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), { target: { value: 'and with steak?' } });
    await act(async () => { fireEvent.click(screen.getByText('Send')); });
    expect(api.askAssistant).toHaveBeenCalledWith('and with steak?', 7);
  });

  it('New chat button resets the thread and detaches the conversation', async () => {
    api.askAssistant.mockResolvedValue(reply({ conversation_id: 5 }));
    render(<AssistantPage />);

    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), { target: { value: 'first message' } });
    await act(async () => { fireEvent.click(screen.getByText('Send')); });
    await waitFor(() => expect(screen.getByText('first message')).toBeInTheDocument());

    // "+ New chat" appears once there's a thread.
    fireEvent.click(screen.getByText('+ New chat'));
    expect(screen.queryByText('first message')).not.toBeInTheDocument();

    // Next send starts a fresh conversation (id null again).
    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), { target: { value: 'brand new' } });
    await act(async () => { fireEvent.click(screen.getByText('Send')); });
    expect(api.askAssistant).toHaveBeenLastCalledWith('brand new', null);
  });

  it('shows a friendly error when the API call rejects', async () => {
    api.askAssistant.mockRejectedValue(new Error('network down'));
    render(<AssistantPage />);

    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), { target: { value: 'anything' } });
    await act(async () => { fireEvent.click(screen.getByText('Send')); });

    await waitFor(() => expect(screen.getByText('Oops')).toBeInTheDocument());
  });

  it('does not send a blank message', async () => {
    render(<AssistantPage />);
    await act(async () => { fireEvent.click(screen.getByText('Send')); });
    expect(api.askAssistant).not.toHaveBeenCalled();
  });
});


describe('Assistant page — tool cards', () => {
  it('renders inline cards when the response carries tool_calls', async () => {
    api.askAssistant.mockResolvedValue(reply({
      title: 'Wine pick',
      answer: 'A Malbec works well.',
      tool_calls: [
        { name: 'get_wine_pairing', args: { dish: 'steak' }, result: {
          dish: 'steak',
          pairings: [{ name: 'Malbec', style: 'Full-bodied Red', confidence: 0.9 }],
        } },
      ],
    }));
    render(<AssistantPage />);

    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), { target: { value: 'wine for steak?' } });
    await act(async () => { fireEvent.click(screen.getByText('Send')); });

    await waitFor(() => expect(screen.getByText('A Malbec works well.')).toBeInTheDocument());
    // The card row from FlavorToolCards:
    expect(screen.getByText('Malbec')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    // And the ghost line still summarises:
    expect(screen.getByText(/Flavor checked/)).toBeInTheDocument();
  });
});


describe('Assistant page — ?q= seed deep-link', () => {
  it('auto-sends the q param on mount and clears the URL', async () => {
    mockQuery = { q: 'Tell me about Malbec.' };
    api.askAssistant.mockResolvedValue(reply({ title: 'Malbec', answer: 'Bold Argentine red.' }));

    await act(async () => { render(<AssistantPage />); });

    await waitFor(() => expect(api.askAssistant).toHaveBeenCalledWith('Tell me about Malbec.', null));
    // URL is cleared so a refresh doesn't replay the seed.
    expect(mockReplace).toHaveBeenCalledWith('/consumer/assistant', undefined, { shallow: true });
    await waitFor(() => expect(screen.getByText('Bold Argentine red.')).toBeInTheDocument());
  });

  it('does not auto-send when there is no q param', async () => {
    mockQuery = {};
    await act(async () => { render(<AssistantPage />); });
    expect(api.askAssistant).not.toHaveBeenCalled();
  });
});
