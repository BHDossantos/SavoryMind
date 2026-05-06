/**
 * Mobile API client regression suite.
 *
 * Covers the auth machinery in mobile/services/api.js — the layer that
 * silently broke once before in this PR (the deleted loginSocial path).
 * Each test stubs global.fetch + the in-memory expo-secure-store mock
 * from jest.setup.js so we never hit a real network or device API.
 */
import * as SecureStore from 'expo-secure-store';

// Reset the api.js module between tests so its internal coalescing
// promise (_refreshInFlight) doesn't leak across cases.
let api;
let tokenStore;
let setUnauthenticatedHandler;

beforeEach(async () => {
  jest.resetModules();
  SecureStore.__resetMockStore();
  global.fetch = jest.fn();
  ({ api, tokenStore, setUnauthenticatedHandler } = require('../api'));
});


// ---- Token store --------------------------------------------------------


describe('tokenStore', () => {
  test('round-trips access and refresh tokens', async () => {
    await tokenStore.setAccess('access-1');
    await tokenStore.setRefresh('refresh-1');
    expect(await tokenStore.getAccess()).toBe('access-1');
    expect(await tokenStore.getRefresh()).toBe('refresh-1');
  });

  test('clear() removes both tokens', async () => {
    await tokenStore.setAccess('a');
    await tokenStore.setRefresh('r');
    await tokenStore.clear();
    expect(await tokenStore.getAccess()).toBeNull();
    expect(await tokenStore.getRefresh()).toBeNull();
  });
});


// ---- Request wrapper ---------------------------------------------------


describe('request wrapper', () => {
  function mockJsonResponse(body, status = 200) {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
  }

  test('always sends X-Client-Type: mobile', async () => {
    global.fetch.mockReturnValueOnce(mockJsonResponse({}));
    await api.getMe();
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers['X-Client-Type']).toBe('mobile');
  });

  test('attaches Authorization: Bearer when access token exists', async () => {
    await tokenStore.setAccess('the-access-token');
    global.fetch.mockReturnValueOnce(mockJsonResponse({}));
    await api.getMe();
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer the-access-token');
  });

  test('omits Authorization header when no access token', async () => {
    global.fetch.mockReturnValueOnce(mockJsonResponse({}));
    await api.getMe();
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
  });

  test('targets EXPO_PUBLIC_API_URL', async () => {
    global.fetch.mockReturnValueOnce(mockJsonResponse({}));
    await api.getMe();
    expect(global.fetch.mock.calls[0][0]).toBe('http://test-backend/api/auth/me');
  });

  test('throws using detail from a non-2xx body', async () => {
    global.fetch.mockReturnValueOnce(mockJsonResponse({ detail: 'Email already registered.' }, 400));
    await expect(api.register({})).rejects.toThrow('Email already registered.');
  });
});


// ---- 401 → refresh → retry pipeline ------------------------------------


describe('401 auto-refresh', () => {
  function jsonResp(body, status = 200) {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
  }

  test('401 on a non-auth call triggers /auth/refresh and retries', async () => {
    await tokenStore.setAccess('expired-access');
    await tokenStore.setRefresh('valid-refresh');

    global.fetch
      // First call to /api/auth/me — 401
      .mockReturnValueOnce(jsonResp({ detail: 'expired' }, 401))
      // /api/auth/refresh — returns new tokens
      .mockReturnValueOnce(jsonResp({ access_token: 'new-access', refresh_token: 'new-refresh' }))
      // Retry of /api/auth/me — succeeds
      .mockReturnValueOnce(jsonResp({ id: 1, email: 'u@x.com' }));

    const me = await api.getMe();
    expect(me).toEqual({ id: 1, email: 'u@x.com' });

    // Three calls total: original, refresh, retry
    expect(global.fetch).toHaveBeenCalledTimes(3);

    // The retry used the refreshed access token
    const [, retryOpts] = global.fetch.mock.calls[2];
    expect(retryOpts.headers.Authorization).toBe('Bearer new-access');

    // SecureStore was updated with the new tokens
    expect(await tokenStore.getAccess()).toBe('new-access');
    expect(await tokenStore.getRefresh()).toBe('new-refresh');
  });

  test('refresh path uses X-Refresh-Token header (not cookie)', async () => {
    await tokenStore.setAccess('expired');
    await tokenStore.setRefresh('the-refresh-value');

    global.fetch
      .mockReturnValueOnce(jsonResp({}, 401))
      .mockReturnValueOnce(jsonResp({ access_token: 'new', refresh_token: 'new-r' }))
      .mockReturnValueOnce(jsonResp({}));

    await api.getMe();

    const [refreshUrl, refreshOpts] = global.fetch.mock.calls[1];
    expect(refreshUrl).toBe('http://test-backend/api/auth/refresh');
    expect(refreshOpts.method).toBe('POST');
    expect(refreshOpts.headers['X-Refresh-Token']).toBe('the-refresh-value');
    expect(refreshOpts.headers['X-Client-Type']).toBe('mobile');
  });

  test('failed refresh wipes tokens and triggers the unauth handler', async () => {
    await tokenStore.setAccess('expired');
    await tokenStore.setRefresh('also-expired');

    global.fetch
      .mockReturnValueOnce(jsonResp({}, 401))   // /me 401
      .mockReturnValueOnce(jsonResp({}, 401));  // /refresh also 401

    const onUnauth = jest.fn();
    setUnauthenticatedHandler(onUnauth);

    await expect(api.getMe()).rejects.toThrow('Session expired. Please log in again.');

    // Local store cleared so the next session starts fresh
    expect(await tokenStore.getAccess()).toBeNull();
    expect(await tokenStore.getRefresh()).toBeNull();
    // App-layer notified so it can route back to /login
    expect(onUnauth).toHaveBeenCalled();
  });

  test('does NOT auto-refresh on the auth endpoints themselves', async () => {
    // A 401 from /api/auth/login means "wrong password", not "token expired".
    // Hitting /refresh in that case would mask the real error.
    global.fetch.mockReturnValueOnce(jsonResp({ detail: 'Incorrect email or password.' }, 401));

    await expect(api.login({ email: 'x', password: 'y' })).rejects.toThrow('Incorrect email or password.');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});


// ---- login / register / logout flows ----------------------------------


describe('login flow', () => {
  test('stores both access and refresh tokens from response body', async () => {
    global.fetch.mockReturnValueOnce(Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        access_token: 'a-from-login',
        refresh_token: 'r-from-login',
        user: { id: 7 },
      }),
    }));

    const result = await api.login({ email: 'a@b.com', password: 'pw' });

    expect(result.user.id).toBe(7);
    expect(await tokenStore.getAccess()).toBe('a-from-login');
    expect(await tokenStore.getRefresh()).toBe('r-from-login');
  });
});


describe('googleLogin flow', () => {
  test('POSTs the id_token to /api/auth/google and stores both tokens', async () => {
    global.fetch.mockReturnValueOnce(Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        access_token:  'access-from-google',
        refresh_token: 'refresh-from-google',
        user: { id: 33, email: 'g@example.com' },
      }),
    }));

    const result = await api.googleLogin('eyJhbGc.IDTOKEN.signed');

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('http://test-backend/api/auth/google');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ id_token: 'eyJhbGc.IDTOKEN.signed' });
    // Mobile path: refresh comes back in body, gets stored alongside access
    expect(result.user.id).toBe(33);
    expect(await tokenStore.getAccess()).toBe('access-from-google');
    expect(await tokenStore.getRefresh()).toBe('refresh-from-google');
  });

  test('propagates the backend detail when the verifier rejects', async () => {
    global.fetch.mockReturnValueOnce(Promise.resolve({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: 'Token expired.' }),
    }));
    await expect(api.googleLogin('expired')).rejects.toThrow('Token expired.');
    // No tokens written when the call failed
    expect(await tokenStore.getAccess()).toBeNull();
  });
});


describe('logout flow', () => {
  test('calls /auth/logout with the refresh token, then clears local store', async () => {
    await tokenStore.setAccess('a');
    await tokenStore.setRefresh('the-refresh');

    global.fetch.mockReturnValueOnce(Promise.resolve({ ok: true, status: 204 }));
    await api.logout();

    const [logoutUrl, logoutOpts] = global.fetch.mock.calls[0];
    expect(logoutUrl).toBe('http://test-backend/api/auth/logout');
    expect(logoutOpts.method).toBe('POST');
    expect(logoutOpts.headers['X-Refresh-Token']).toBe('the-refresh');
    expect(logoutOpts.headers['X-Client-Type']).toBe('mobile');

    expect(await tokenStore.getAccess()).toBeNull();
    expect(await tokenStore.getRefresh()).toBeNull();
  });

  test('still clears local store even if the network call fails', async () => {
    await tokenStore.setAccess('a');
    await tokenStore.setRefresh('r');

    global.fetch.mockRejectedValueOnce(new Error('network down'));
    await api.logout();

    // User shouldn't be stuck logged in client-side because the network
    // happened to fail at logout time.
    expect(await tokenStore.getAccess()).toBeNull();
    expect(await tokenStore.getRefresh()).toBeNull();
  });
});
