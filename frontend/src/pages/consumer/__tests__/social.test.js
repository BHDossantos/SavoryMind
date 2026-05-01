/**
 * Spotify connect screen tests.
 *
 * Specifically verifies the "Reconnect for richer recommendations"
 * nudge — the migration-loop closer for users whose Spotify
 * connection predates the user-top-read scope. Without this test, the
 * nudge could silently disappear (e.g. someone refactors the scope
 * detection or strips the `scopes` field from the response) and
 * existing users would never benefit from the listening-signal feature.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const mockReplace = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true,
    query: {},
    push: jest.fn(),
    replace: mockReplace,
  }),
}));

jest.mock('../../../services/api', () => ({
  api: {
    getConnections:    jest.fn(),
    startSpotifyAuth:  jest.fn(),
    disconnectSpotify: jest.fn(),
  },
}));

const { api } = require('../../../services/api');
const SocialPage = require('../social').default;


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  mockReplace.mockReset();
});


function connectionWithScopes(scopes) {
  return [{
    id: 1,
    platform: 'spotify',
    connected: true,
    username: 'alice-spotify',
    profile_url: 'https://open.spotify.com/user/alice',
    scopes,
  }];
}


describe('Spotify connect screen — reconnect nudge', () => {
  test('shows the reconnect nudge when user-top-read is NOT in granted scopes', async () => {
    api.getConnections.mockResolvedValue(connectionWithScopes(
      'user-read-private user-read-email',  // legacy scopes, missing user-top-read
    ));

    render(<SocialPage />);
    await waitFor(() => {
      expect(screen.getByText(/Reconnect for richer recommendations/i)).toBeInTheDocument();
    });
  });

  test('hides the nudge once user-top-read has been granted', async () => {
    api.getConnections.mockResolvedValue(connectionWithScopes(
      'user-read-private user-read-email user-top-read',
    ));

    render(<SocialPage />);
    // Wait for the page to finish its initial fetch so we know the
    // conditional has settled in the rendered tree.
    await waitFor(() => {
      expect(screen.getByText(/Connected as alice-spotify/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Reconnect for richer recommendations/i)).not.toBeInTheDocument();
  });

  test('hides the nudge when not connected at all', async () => {
    api.getConnections.mockResolvedValue([]);

    render(<SocialPage />);
    await waitFor(() => {
      // Wait for the disconnected-state CTA to appear so we know the
      // load promise has resolved.
      expect(screen.getByText('Connect Spotify')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Reconnect for richer recommendations/i)).not.toBeInTheDocument();
  });

  test('hides the nudge when scopes is null (older row pre-migration)', async () => {
    api.getConnections.mockResolvedValue([{
      id: 1, platform: 'spotify', connected: true,
      username: 'bob', profile_url: null, scopes: null,
    }]);

    render(<SocialPage />);
    await waitFor(() => {
      expect(screen.getByText(/Connected as bob/i)).toBeInTheDocument();
    });
    // Null scopes means we don't *know* what was granted — don't nag the
    // user. Better to hide than to show a false positive.
    expect(screen.queryByText(/Reconnect for richer recommendations/i)).not.toBeInTheDocument();
  });
});
