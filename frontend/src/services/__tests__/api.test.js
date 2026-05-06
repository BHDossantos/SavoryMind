/**
 * Web API client regression suite. Mirrors the mobile suite but for
 * the web flow: in-memory access token + httpOnly refresh cookie
 * (sent via credentials: 'include'), instead of mobile's SecureStore +
 * X-Refresh-Token header.
 */

// Reset api.js module state between tests so the in-memory access
// token / in-flight refresh promise don't leak.
let api;
let setAccessToken;
let getAccessToken;
let setUnauthenticatedHandler;

beforeEach(() => {
  jest.resetModules();
  global.fetch = jest.fn();
  // sentinel host so assertions can target it
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { hostname: 'savorymind.net', href: '' },
  });
  ({ api, setAccessToken, getAccessToken, setUnauthenticatedHandler } = require('../api'));
});


function jsonResp(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}


// ---- Token store --------------------------------------------------------


describe('access token store', () => {
  test('round-trips via setAccessToken / getAccessToken', () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken('the-token');
    expect(getAccessToken()).toBe('the-token');
  });

  test('setAccessToken(null) clears the token', () => {
    setAccessToken('x');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });
});


// ---- Request wrapper ---------------------------------------------------


describe('request wrapper', () => {
  test("always sets credentials: 'include' so the refresh cookie ships", async () => {
    global.fetch.mockReturnValueOnce(jsonResp({}));
    await api.getMe();
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.credentials).toBe('include');
  });

  test('attaches Authorization: Bearer when access token is set', async () => {
    setAccessToken('a-token');
    global.fetch.mockReturnValueOnce(jsonResp({}));
    await api.getMe();
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer a-token');
  });

  test('omits Authorization when no access token', async () => {
    global.fetch.mockReturnValueOnce(jsonResp({}));
    await api.getMe();
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
  });

  test('targets the prod API URL when on a non-localhost host', async () => {
    global.fetch.mockReturnValueOnce(jsonResp({}));
    await api.getMe();
    const [url] = global.fetch.mock.calls[0];
    // Default PROD_API constant in api.js
    expect(url).toBe('https://api.savorymind.net/api/auth/me');
  });

  test('uses the /backend proxy on localhost', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { hostname: 'localhost', href: '' },
    });
    jest.resetModules();
    ({ api } = require('../api'));
    global.fetch.mockReturnValueOnce(jsonResp({}));
    await api.getMe();
    expect(global.fetch.mock.calls[0][0]).toBe('/backend/api/auth/me');
  });

  test('throws using detail from a non-2xx body', async () => {
    global.fetch.mockReturnValueOnce(jsonResp({ detail: 'Email already registered.' }, 400));
    await expect(api.register({})).rejects.toThrow('Email already registered.');
  });
});


// ---- 401 → refresh → retry ---------------------------------------------


describe('401 auto-refresh', () => {
  test('401 on a non-auth call triggers /auth/refresh and retries with the new token', async () => {
    setAccessToken('expired');

    global.fetch
      // First call to /api/auth/me — 401
      .mockReturnValueOnce(jsonResp({ detail: 'expired' }, 401))
      // /api/auth/refresh — returns new access token (refresh comes back via cookie, not body for web)
      .mockReturnValueOnce(jsonResp({ access_token: 'new-access', user: { id: 1 } }))
      // Retry — succeeds
      .mockReturnValueOnce(jsonResp({ id: 1, email: 'u@x.com' }));

    const me = await api.getMe();
    expect(me).toEqual({ id: 1, email: 'u@x.com' });
    expect(global.fetch).toHaveBeenCalledTimes(3);

    // The retry used the refreshed access token
    const [, retryOpts] = global.fetch.mock.calls[2];
    expect(retryOpts.headers.Authorization).toBe('Bearer new-access');
    // In-memory token was updated
    expect(getAccessToken()).toBe('new-access');
  });

  test('refresh path also sends credentials: include (so the cookie reaches /refresh)', async () => {
    setAccessToken('expired');
    global.fetch
      .mockReturnValueOnce(jsonResp({}, 401))
      .mockReturnValueOnce(jsonResp({ access_token: 'new', user: { id: 1 } }))
      .mockReturnValueOnce(jsonResp({}));
    await api.getMe();
    const [refreshUrl, refreshOpts] = global.fetch.mock.calls[1];
    expect(refreshUrl).toMatch(/\/api\/auth\/refresh$/);
    expect(refreshOpts.credentials).toBe('include');
    expect(refreshOpts.method).toBe('POST');
  });

  test('failed refresh clears the in-memory token and triggers the unauth handler', async () => {
    setAccessToken('expired');
    global.fetch
      .mockReturnValueOnce(jsonResp({}, 401))   // /me
      .mockReturnValueOnce(jsonResp({}, 401));  // /refresh

    const onUnauth = jest.fn();
    setUnauthenticatedHandler(onUnauth);

    await expect(api.getMe()).rejects.toThrow('Session expired. Please log in again.');
    expect(getAccessToken()).toBeNull();
    expect(onUnauth).toHaveBeenCalled();
  });

  test('does NOT auto-refresh on /auth/login (so wrong-password 401 surfaces)', async () => {
    global.fetch.mockReturnValueOnce(jsonResp({ detail: 'Incorrect email or password.' }, 401));
    await expect(api.login({ email: 'x', password: 'y' })).rejects.toThrow('Incorrect email or password.');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('does NOT auto-refresh on /auth/refresh itself (would infinite-loop)', async () => {
    global.fetch.mockReturnValueOnce(jsonResp({}, 401));
    await expect(api.refresh()).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
