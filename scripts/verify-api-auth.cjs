// File: scripts/verify-api-auth.cjs
// Exercise the API contract and session lifecycle without creating backend accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const createLoader = (globals = {}, { native = false, dependencies = {} } = {}) => {
  const modules = new Map();
  const load = (name) => {
    if (modules.has(name)) return modules.get(name);
    const exports = {};
    const suffix = native && name === 'auth-session-storage' ? '.native' : '';
    const source = ts.transpileModule(fs.readFileSync(`src/data/${name}${suffix}.ts`, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, {
      exports, require: (path) => path.startsWith('./') ? load(path.slice(2)) : dependencies[path], Date, Promise, AbortController, setTimeout, clearTimeout,
      fetch: async () => { throw new Error('Unexpected real network request'); }, process: { env: {} },
      ...globals,
    });
    modules.set(name, exports);
    return exports;
  };
  return load;
};
const load = createLoader();

const { createApiAuthService } = load('api-auth');
const { AuthError } = load('auth');
const baseUrl = 'https://localhost:7145';
const user = { userId: 'member-id', email: 'member@example.com', displayName: 'Table Captain', firstName: 'Alex', surname: 'Smith', emailConfirmed: false };
const tokens = (suffix = '1') => ({ tokenType: 'Bearer', accessToken: `opaque-access-${suffix}`, refreshToken: `opaque-refresh-${suffix}`, expiresIn: 900 });
const input = { email: ' Member@Example.com ', firstName: ' Alex ', surname: ' Smith ', displayName: ' Table Captain ', password: 'TestPassword123!', passwordConfirmation: 'TestPassword123!' };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

const fixture = () => {
  let saved = null;
  let clock = 1_000_000;
  let handler = () => { throw new Error('Unexpected request'); };
  const calls = [];
  const storage = {
    read: () => saved,
    write: (value) => { saved = value; },
    clear: () => { saved = null; },
  };
  const options = {
    baseUrl: `${baseUrl}/`, storage, now: () => clock,
    fetcher: async (url, init) => {
      assert.equal(init.credentials, 'omit');
      assert.equal(init.headers.Accept, 'application/json');
      const call = { path: url.slice(baseUrl.length), ...init, body: init.body ? JSON.parse(init.body) : undefined };
      calls.push(call);
      return handler(call);
    },
  };
  return {
    options, calls, storage,
    create: () => createApiAuthService(options),
    handle: (next) => { handler = next; },
    seed: (value) => { saved = value; },
    saved: () => saved,
    advance: (ms) => { clock += ms; },
  };
};

(async () => {
  const f = fixture();
  let service = f.create();
  assert.equal(await service.restoreSession(), null);
  assert.equal(f.calls.length, 0, 'Guests do not contact the API');
  f.handle(() => json({ status: 'confirmationRequired' }, 202));
  await service.signUp(input);
  assert.equal(f.calls[0].path, '/auth/register');
  assert.equal(f.calls[0].method, 'POST');
  assert.deepEqual(f.calls[0].body, { email: 'member@example.com', password: input.password, firstName: 'Alex', surname: 'Smith', displayName: 'Table Captain' });
  assert.equal(f.saved(), null, 'Registration does not sign in or save passwords');
  await assert.rejects(service.signUp({ ...input, displayName: ' ' }), (error) => error.code === 'validation');
  assert.equal(f.calls.length, 1, 'Invalid registration is not submitted');
  f.handle(() => json({ status: 'accepted' }, 202));
  await service.requestPasswordReset(' Unknown@Example.com ');
  await service.resendConfirmation(' Member@Example.com ');
  assert.equal(f.calls[1].path, '/auth/forgot-password');
  assert.equal(f.calls[1].body.email, 'unknown@example.com');
  assert.equal(f.calls[2].path, '/auth/resend-confirmation');
  assert.equal(f.saved(), null, 'Email requests never create a session');

  f.handle((call) => call.path === '/auth/login' ? json(tokens()) : json(user));
  const signedIn = await service.signIn(input.email, input.password);
  assert.deepEqual({ ...signedIn }, { id: user.userId, email: user.email, displayName: user.displayName });
  assert.deepEqual(f.calls[3].body, { email: 'member@example.com', password: input.password });
  assert.equal(f.calls[4].headers.Authorization, 'Bearer opaque-access-1');
  assert.deepEqual(Object.keys(JSON.parse(f.saved())).sort(), ['accessToken', 'expiresAt', 'refreshToken']);
  assert.equal(f.saved().includes(input.password), false);
  service = f.create();
  await service.restoreSession();
  assert.equal(f.calls.at(-1).path, '/auth/me', 'A valid saved session survives recreation');

  f.advance(900_000);
  f.handle((call) => call.path === '/auth/refresh' ? json(tokens('2')) : json(user));
  const before = f.calls.length;
  await Promise.all([service.restoreSession(), service.restoreSession()]);
  assert.equal(f.calls.length - before, 2, 'Concurrent restoration shares one refresh and profile request');
  assert.deepEqual(f.calls.at(-2).body, { refreshToken: 'opaque-refresh-1' });
  assert.equal(f.calls.at(-1).headers.Authorization, 'Bearer opaque-access-2');
  assert.equal(JSON.parse(f.saved()).refreshToken, 'opaque-refresh-2');

  let profileCalls = 0;
  f.handle((call) => {
    if (call.path === '/auth/refresh') return json(tokens('3'));
    return ++profileCalls === 1 ? new Response(null, { status: 401 }) : json(user);
  });
  await f.create().restoreSession();
  assert.equal(profileCalls, 2, 'An unexpected profile 401 refreshes once and retries');
  assert.equal(f.calls.at(-1).headers.Authorization, 'Bearer opaque-access-3');

  const preserved = f.saved();
  f.advance(900_000);
  f.handle(() => { throw new TypeError('Network unavailable'); });
  await assert.rejects(f.create().restoreSession(), (error) => error instanceof AuthError && error.code === 'network');
  assert.equal(f.saved(), preserved, 'An outage preserves credentials for Retry');
  f.handle(() => new Response(null, { status: 429 }));
  await assert.rejects(f.create().restoreSession(), (error) => error.code === 'rate-limited');
  assert.equal(f.saved(), preserved, 'Rate limiting does not destroy a session');
  f.handle(() => new Response(null, { status: 401 }));
  assert.equal(await f.create().restoreSession(), null);
  assert.equal(f.saved(), null, 'A rejected refresh signs the user out');

  for (const raw of ['broken-json', '{}', '{"accessToken":""}']) {
    f.seed(raw);
    const count = f.calls.length;
    assert.equal(await f.create().restoreSession(), null);
    assert.equal(f.saved(), null, 'Invalid saved sessions are removed');
    assert.equal(f.calls.length, count);
  }
  f.handle(() => json({ errors: { DuplicateEmail: ['An account with this email already exists.'] } }, 400));
  await assert.rejects(service.signUp(input), (error) => error.code === 'email-exists' && error.message.includes('already exists'));
  f.handle(() => json({ errors: { Password: ['Password is too weak.'] } }, 400));
  await assert.rejects(service.signUp(input), (error) => error.code === 'validation' && error.message === 'Password is too weak.');
  f.handle(() => new Response(null, { status: 401 }));
  await assert.rejects(service.signIn(input.email, input.password), (error) => error.code === 'invalid-credentials' && !error.message.includes('remaining'));
  f.handle(() => new Response('<html>Internal details</html>', { status: 500 }));
  await assert.rejects(service.signIn(input.email, input.password), (error) => error.code === 'service' && !error.message.includes('Internal details'));
  f.handle(() => json({ accessToken: 'missing-fields' }));
  await assert.rejects(service.signIn(input.email, input.password), (error) => error.code === 'service');
  assert.equal(f.saved(), null, 'Malformed token responses are not saved');
  f.handle((call) => call.path === '/auth/login' ? json(tokens()) : json({ displayName: 'Missing ID' }));
  await assert.rejects(service.signIn(input.email, input.password), (error) => error.code === 'service');
  assert.equal(f.saved(), null, 'Malformed profiles do not create a local session');

  const race = fixture();
  race.seed(JSON.stringify({ accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 }));
  const refreshReply = deferred();
  const refreshStarted = deferred();
  race.handle(() => { refreshStarted.resolve(); return refreshReply.promise; });
  const racingService = race.create();
  const restoration = racingService.restoreSession();
  await refreshStarted.promise;
  await racingService.signOut();
  assert.equal(race.saved(), null, 'Sign-out clears tokens without waiting for network');
  refreshReply.resolve(json(tokens()));
  assert.equal(await restoration, null);
  assert.equal(race.saved(), null, 'An outstanding refresh cannot undo sign-out');
  assert.equal(race.calls.length, 1, 'Cancelled restoration does not request a profile');

  const loginReply = deferred();
  race.handle(() => loginReply.promise);
  const login = racingService.signIn(input.email, input.password);
  await racingService.signOut();
  loginReply.resolve(json(tokens()));
  race.handle(() => json(user));
  await assert.rejects(login, (error) => error.code === 'session-expired');
  assert.equal(race.saved(), null, 'An outstanding login cannot undo sign-out');

  const failingStorage = fixture();
  failingStorage.storage.write = () => { throw new Error('Storage unavailable'); };
  failingStorage.handle((call) => call.path === '/auth/login' ? json(tokens()) : json(user));
  await assert.rejects(failingStorage.create().signIn(input.email, input.password), /Storage unavailable/);
  assert.equal(await load('auth-service').authService.restoreSession(), null, 'Server rendering does not access browser storage');

  const browserValues = new Map();
  const browserUrls = [];
  const browserGlobals = {
    process: { env: { EXPO_PUBLIC_API_BASE_URL: 'https://api.example.test/' } },
    window: { localStorage: {
      getItem: (key) => browserValues.get(key) ?? null,
      setItem: (key, value) => browserValues.set(key, value),
      removeItem: (key) => browserValues.delete(key),
    } },
    fetch: async (url) => { browserUrls.push(url); return json(url.endsWith('/login') ? tokens() : user); },
  };
  let browserService = createLoader(browserGlobals)('auth-service').authService;
  await browserService.signIn(input.email, input.password);
  const browserKey = 'club-booking:auth:v1:https://api.example.test';
  assert.equal(browserValues.has(browserKey), true, 'The singleton persists tokens in browser storage scoped to its configured API');
  assert.equal(browserUrls[0], 'https://api.example.test/auth/login');
  browserService = createLoader(browserGlobals)('auth-service').authService;
  assert.equal((await browserService.restoreSession()).id, user.userId, 'Browser reload restores the saved session');
  await browserService.signOut();
  assert.equal(browserValues.has(browserKey), false);
  const deniedStorage = createLoader({ window: { get localStorage() { throw new Error('Denied'); } } })('auth-service').authService;
  await assert.rejects(deniedStorage.restoreSession(), (error) => error.code === 'storage');

  // Load the actual native singleton without window/localStorage. These async
  // stand-ins exercise the native boundary without needing a simulator or API.
  const nativeValues = new Map();
  let nativeRequests = 0;
  const secureStore = {
    getItemAsync: async (key) => nativeValues.get(key) ?? null,
    setItemAsync: async (key, value) => {
      assert.match(key, /^[A-Za-z0-9._-]+$/, 'SecureStore keys contain only supported characters');
      nativeValues.set(key, value);
    },
    deleteItemAsync: async (key) => { nativeValues.delete(key); },
  };
  const nativeOptions = { native: true, dependencies: { 'expo-secure-store': secureStore } };
  const nativeGlobals = { fetch: async (url) => {
    nativeRequests += 1;
    return json(url.endsWith('/login') || url.endsWith('/refresh') ? tokens('native') : user);
  } };
  let nativeService = createLoader(nativeGlobals, nativeOptions)('auth-service').authService;
  assert.equal(await nativeService.restoreSession(), null, 'A fresh Expo Go install starts as a guest');
  assert.equal(nativeRequests, 0, 'Empty native storage does not contact the API');
  await nativeService.signIn(input.email, input.password);
  assert.equal(nativeValues.size, 1);
  const [nativeKey, nativeRaw] = [...nativeValues][0];
  assert.deepEqual(Object.keys(JSON.parse(nativeRaw)).sort(), ['accessToken', 'expiresAt', 'refreshToken']);
  assert.equal(nativeRaw.includes(input.password), false, 'Native storage never receives passwords');
  nativeService = createLoader(nativeGlobals, nativeOptions)('auth-service').authService;
  assert.equal((await nativeService.restoreSession()).id, user.userId, 'Native sessions survive service recreation');
  nativeValues.set(nativeKey, JSON.stringify({ ...JSON.parse(nativeRaw), expiresAt: 0 }));
  assert.equal((await nativeService.restoreSession()).id, user.userId, 'Expired native sessions refresh');
  assert.ok(JSON.parse(nativeValues.get(nativeKey)).expiresAt > Date.now());

  const otherApi = createLoader({ ...nativeGlobals, process: { env: { EXPO_PUBLIC_API_BASE_URL: 'https://other.example.test' } } }, nativeOptions)('auth-service').authService;
  assert.equal(await otherApi.restoreSession(), null, 'Native tokens are isolated by API URL');
  await nativeService.signOut();
  assert.equal(nativeValues.size, 0, 'Native sign-out deletes persisted tokens');
  assert.equal(await nativeService.restoreSession(), null);
  nativeValues.set(nativeKey, 'broken-json');
  assert.equal(await nativeService.restoreSession(), null);
  assert.equal(nativeValues.size, 0, 'Corrupt native sessions are removed');

  const nativeStorage = createLoader({}, nativeOptions)('auth-session-storage').createAuthSessionStorage('test-key');
  const nativeRead = secureStore.getItemAsync;
  secureStore.getItemAsync = async () => { throw new Error('Device storage unavailable'); };
  await assert.rejects(nativeService.restoreSession(), (error) => error.code === 'storage');
  secureStore.getItemAsync = nativeRead;
  assert.equal(await nativeService.restoreSession(), null, 'Retry recovers after a transient native read failure');
  for (const [method, operation, args] of [
    ['getItemAsync', 'read', []], ['setItemAsync', 'write', ['tokens']], ['deleteItemAsync', 'clear', []],
  ]) {
    const original = secureStore[method];
    secureStore[method] = async () => { throw new Error('Device storage unavailable'); };
    await assert.rejects(nativeStorage[operation](...args), (error) => error.code === 'storage');
    secureStore[method] = original;
  }

  // An async write already in progress must finish before logout's deletion.
  const writeRace = fixture();
  const writeStarted = deferred();
  const writeDone = deferred();
  const originalWrite = writeRace.storage.write;
  writeRace.storage.write = async (value) => { writeStarted.resolve(); await writeDone.promise; originalWrite(value); };
  writeRace.handle((call) => json(call.path === '/auth/login' ? tokens() : user));
  const writeRaceService = writeRace.create();
  const pendingLogin = writeRaceService.signIn(input.email, input.password);
  const cancelledLogin = assert.rejects(pendingLogin, (error) => error.code === 'session-expired');
  await writeStarted.promise;
  let signedOut = false;
  const logout = writeRaceService.signOut().then(() => { signedOut = true; });
  assert.equal(signedOut, false, 'Sign-out waits for pending storage work');
  writeDone.resolve();
  await Promise.all([cancelledLogin, logout]);
  assert.equal(writeRace.saved(), null, 'A late async write cannot reinstate tokens after sign-out');

  const readRace = fixture();
  const readStarted = deferred();
  const readDone = deferred();
  readRace.storage.read = async () => { readStarted.resolve(); return readDone.promise; };
  const readRaceService = readRace.create();
  const pendingRestore = readRaceService.restoreSession();
  await readStarted.promise;
  const readLogout = readRaceService.signOut();
  readDone.resolve(JSON.stringify({ accessToken: 'old', refreshToken: 'old', expiresAt: 0 }));
  await readLogout;
  assert.equal(await pendingRestore, null, 'Sign-out cancels an in-flight native read');
  assert.equal(readRace.calls.length, 0);

  console.log('API auth checks passed: API contract, browser/native persistence, empty native guest startup, refresh/retry, asynchronous storage and logout races, invalid sessions, validation, outages and storage errors.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
