// File: scripts/verify-administration.cjs
// Exercise wire contracts, permission discovery, session races and form recovery without changing backend data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const jsx = require('react/jsx-runtime');
const compile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const modules = new Map();
const load = (name) => {
  if (name === 'auth-service') return { authService: {} };
  if (modules.has(name)) return modules.get(name);
  const exports = {};
  vm.runInNewContext(compile(`src/data/${name}.ts`), { exports, Error, Date, Intl, Promise, AbortController, setTimeout, clearTimeout,
    fetch: () => { throw new Error('Unexpected network request'); }, require: (path) => load(path.slice(2)) });
  modules.set(name, exports);
  return exports;
};
const data = load('administration');
const { ApiError, createApiAuthService } = load('api-auth');
const { AuthError } = load('auth');
const id = (n) => `61af7d36-2b80-4c9f-a314-${String(n).padStart(12, '0')}`;
const club = { id: id(1), name: 'Club', timeZoneId: 'Australia/Sydney', commencementDate: '2026-01-01', bookingWindowDays: 30, role: 'Owner', isPaidMember: true };
const table = { id: id(2), name: 'Table 1', size: 'small', availableFromDate: '2026-10-28', isEnabled: true };
const grants = (allowed) => ({ canAccessAdministration: allowed, permissions: Object.fromEntries(data.ADMIN_SECTIONS.map((key) => [key, { view: allowed, edit: allowed, delete: allowed }])) });
const json = (value, status = 200) => new Response(status === 204 ? null : JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(setImmediate);

const harness = (file, dependency, getContext = () => undefined) => {
  let cursor = 0, changedState = false, tree;
  const hooks = [], effects = [];
  const changed = (a, b) => !a || !b || a.length !== b.length || b.some((value, i) => value !== a[i]);
  const effect = (fn, deps) => { const i = cursor++; if (changed(hooks[i]?.deps, deps)) {
    hooks[i]?.cleanup?.(); hooks[i] = { deps }; effects.push(() => { hooks[i].cleanup = fn(); });
  } };
  const react = {
    useState: (initial) => { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], (next) => { const value = typeof next === 'function' ? next(hooks[i]) : next; if (!Object.is(value, hooks[i])) changedState = true; hooks[i] = value; }]; },
    useRef: (initial) => { const i = cursor++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i]; },
    useCallback: (fn, deps) => { const i = cursor++; if (changed(hooks[i]?.deps, deps)) hooks[i] = { fn, deps }; return hooks[i].fn; },
    useEffect: effect, useLayoutEffect: effect, createContext: () => ({ Provider: 'Provider' }), useContext: () => getContext(),
  };
  const mod = {};
  vm.runInNewContext(compile(file), { exports: mod, Error, Date, Promise, Intl,
    require: (name) => name === 'react' ? react : name === 'react/jsx-runtime' ? jsx : dependency(name) });
  const render = (fn) => {
    let iterations = 0;
    do { cursor = 0; changedState = false; tree = fn(mod); if (++iterations > 20) throw new Error('Render loop'); } while (changedState);
    effects.splice(0).forEach((fn) => fn());
    return tree;
  };
  const elements = () => { const all = []; const visit = (node) => React.Children.forEach(node, (child) => {
    if (React.isValidElement(child)) { all.push(child); visit(child.props.children); }
  }); visit(tree); return all; };
  return { render, elements, find: (type, label) => { const found = elements().find((el) => el.type === type && (el.props.label === label || el.props.children === label));
    assert.ok(found, `Missing ${type}: ${label}`); return found.props; }, dispose: () => hooks.forEach((hook) => hook?.cleanup?.()) };
};

(async () => {
  let saved = JSON.stringify({ accessToken: 'opaque', refreshToken: 'refresh', expiresAt: Date.now() + 900000, clubId: club.id });
  const calls = [];
  let reply = () => json(club);
  const auth = createApiAuthService({ baseUrl: 'https://api.test', storage: { read: () => saved, write: (v) => { saved = v; }, clear: () => { saved = null; } },
    fetcher: async (url, init) => { calls.push({ url, ...init }); return reply(url, init); } });
  const service = data.createAdministrationService(auth);
  reply = () => json(grants(true));
  assert.equal((await service.access(club.id)).permissions.adminTables.delete, true);
  reply = () => json(grants(false));
  assert.equal((await service.access(club.id)).canAccessAdministration, false);
  assert.throws(() => data.parseAccess({ ...grants(true), permissions: {} }), /invalid details/);
  reply = () => json(club);
  await service.renameClub(club.id, ' New Club ');
  assert.equal(calls.at(-1).method, 'PUT');
  assert.deepEqual(JSON.parse(calls.at(-1).body), { name: 'New Club' });
  reply = () => json([table, { ...table, id: id(3), isEnabled: false }]);
  assert.equal((await service.tables(club.id)).length, 2, 'Disabled tables are retained');
  reply = () => json(table, 201);
  await service.saveTable(club.id, { ...table, name: ' Table 1 ', extra: 'must not be sent' });
  assert.equal(calls.at(-1).method, 'POST');
  assert.deepEqual(JSON.parse(calls.at(-1).body), { name: 'Table 1', size: 'small', availableFromDate: table.availableFromDate, isEnabled: true });
  reply = () => json({ ...table, isEnabled: false });
  await service.saveTable(club.id, { ...table, isEnabled: false }, table.id);
  assert.equal(calls.at(-1).method, 'PUT');
  assert.equal(JSON.parse(calls.at(-1).body).isEnabled, false);
  reply = () => json(null, 204);
  await service.removeTable(club.id, table.id);
  assert.equal(calls.at(-1).method, 'DELETE');
  assert.equal(calls.at(-1).body, undefined);
  for (const call of calls) assert.equal(call.headers.Authorization, 'Bearer opaque');
  for (const code of ['TableNameInUse', 'TableHasActiveBookings', 'ConcurrentChange']) {
    reply = () => json({ code }, 409);
    await assert.rejects(service.saveTable(club.id, table, table.id), (error) => error.status === 409 && error.serverCode === code && data.administrationErrorMessage(error) !== error.message);
  }
  assert.ok(data.validDate('2028-02-29'));
  assert.equal(data.validDate('2026-02-29'), false);
  assert.equal(data.validDate('0000-01-01'), false);
  assert.equal(Object.keys(data.validateTable({ ...table, size: '', availableFromDate: '2026-02-30' })).length, 2);
  const before = calls.length;
  await assert.rejects(service.saveTable(club.id, { ...table, name: ' ' }));
  await assert.rejects(service.table('../foreign', table.id));
  assert.equal(calls.length, before, 'Invalid input and route IDs cannot reach the API');
  let rejected = false;
  reply = (url, init) => url.endsWith('/auth/refresh') ? json({ tokenType: 'Bearer', accessToken: 'fresh', refreshToken: 'fresh-refresh', expiresIn: 900 })
    : url.endsWith('/auth/me') ? (init.headers.Authorization === 'Bearer fresh' ? json({ userId: id(9), email: 'owner@example.test', displayName: 'Owner', clubId: club.id }) : json({}, 401))
    : !rejected ? (rejected = true, json({}, 401)) : json(club);
  await service.renameClub(club.id, 'Refreshed');
  const last = calls.at(-1);
  assert.equal(last.method, 'PUT');
  assert.equal(last.headers.Authorization, 'Bearer fresh');
  assert.deepEqual(JSON.parse(last.body), { name: 'Refreshed' }, 'Token refresh preserves PUT method and body');

  // Execute the actual form component; controlled responses verify validation, retained drafts and post-save routing.
  let resource = { data: { club, table: null }, loading: false, error: null, refreshing: false, refresh: async () => {} };
  let pending, inputSeen, enabled, dirty, discarded, mounted = true, marked = 0;
  const navigation = [];
  const form = harness('src/components/administration/TableForm.tsx', (name) => {
    if (name === 'expo-router') return { router: { dismissTo: (path) => navigation.push(path) } };
    if (name === 'react-native') return { Switch: 'Switch', Text: 'Text', View: 'View' };
    if (name === '@/data/administration') return { ...data, administrationService: { saveTable: async (clubId, input) => { inputSeen = input; return pending.promise; } } };
    if (name === '@/data/bookings') return { today: () => '2026-10-28' };
    if (name === '@/hooks/use-administration') return { useAdministrationLifetime: () => () => mounted, useAdministrationFocus: () => true, useAdministration: () => ({ clubId: club.id, handleFailure() {} }), useAdministrationResource: (load, allowed) => { enabled = allowed; return resource; } };
    if (name === '@/hooks/use-confirmation') return { useUnsavedChanges: (value, discard) => { dirty = value; discarded = discard; return { markSaved: () => { marked++; } }; } };
    if (name === './AdminPage') return { AdminPage: 'AdminPage', Message: 'Message' };
    if (name === '@/components/auth/AuthField') return { AuthField: 'AuthField' };
    if (name === '@/components/ui/Button') return { Button: 'Button' };
    throw new Error(name);
  });
  const render = () => form.render((mod) => mod.TableForm({}));
  render();
  assert.equal(enabled, true);
  assert.equal(form.find('AuthField', 'Available from').value, '2026-10-28');
  assert.equal(form.elements().find((el) => el.type === 'Switch').props.value, true);
  await form.find('Button', 'Create Table').onPress(); render();
  assert.equal(inputSeen, undefined, 'Explicit size and name are required');
  form.find('AuthField', 'Table name').onChangeText('New table'); render();
  form.find('Button', 'Large').onPress(); render();
  assert.equal(dirty, true);
  pending = deferred();
  const failure = form.find('Button', 'Create Table').onPress();
  render();
  pending.reject(new ApiError(409, 'service', 'Conflict', 'TableHasActiveBookings'));
  await failure; render();
  assert.equal(form.find('AuthField', 'Table name').value, 'New table');
  assert.match(form.elements().find((el) => el.type === 'Message').props.children, /Active bookings/);
  assert.deepEqual(navigation, []);
  resource = { ...resource, data: { club, table: null } }; render();
  assert.equal(form.find('AuthField', 'Table name').value, 'New table', 'Refresh cannot replace a dirty draft');
  discarded(); render();
  assert.equal(form.find('AuthField', 'Table name').value, '', 'Discard resets a retained tab form');
  form.find('AuthField', 'Table name').onChangeText('New table'); render();
  form.find('Button', 'Small').onPress(); render();
  pending = deferred();
  const success = form.find('Button', 'Create Table').onPress();
  assert.deepEqual(navigation, []);
  pending.resolve(table); await success; render();
  assert.deepEqual(navigation, ['/admin/tables']);
  assert.equal(marked, 1);
  pending = deferred();
  const staleSave = form.find('Button', 'Create Table').onPress();
  mounted = false;
  pending.resolve(table); await staleSave;
  assert.equal(navigation.length, 1, 'An unmounted form cannot navigate a newer session');
  form.dispose();

  let clubResource = { data: club, loading: false, error: null, refreshing: false, refresh: async () => {} };
  const details = harness('src/app/(tabs)/admin/club-details.tsx', (name) => {
    if (name === 'react-native') return { Text: 'Text', View: 'View' };
    if (name === '@/data/administration') return { ...data, administrationService: { renameClub: async () => ({ ...club, name: 'Renamed Club' }) } };
    if (name === '@/data/bookings') return { dateLabel: (date) => date };
    if (name === '@/hooks/use-administration') return { useAdministrationLifetime: () => () => true, useAdministrationFocus: () => true, useAdministration: () => ({ clubId: club.id, access: grants(true), handleFailure() {} }), useAdministrationResource: () => clubResource };
    if (name === '@/hooks/use-confirmation') return { useUnsavedChanges: () => ({ markSaved() {} }) };
    if (name === '@/components/administration/AdminPage') return { AdminPage: 'AdminPage', Message: 'Message' };
    if (name === '@/components/auth/AuthField') return { AuthField: 'AuthField' };
    if (name === '@/components/ui/Button') return { Button: 'Button' };
    throw new Error(name);
  });
  const renderDetails = () => details.render((mod) => mod.default());
  renderDetails();
  details.find('AuthField', 'Club name').onChangeText('Renamed Club'); renderDetails();
  await details.find('Button', 'Save changes').onPress(); renderDetails();
  assert.equal(details.find('AuthField', 'Club name').value, 'Renamed Club', 'Stale resource data cannot undo a successful save');
  assert.equal(details.find('Button', 'Save changes').disabled, true);
  assert.equal(details.find('Message', 'Club details saved.').children, 'Club details saved.');
  details.dispose();

  // Both custom tab navigation and router Back use the same unsaved-change decision.
  let guard, blocked, removeCallback, accepts = false, confirmations = 0, discards = 0, disables = 0, focused = true;
  let hasChanges = true, saving = false;
  const confirmationContext = {
    confirm: async () => { confirmations++; return accepts; },
    registerGuard: (next) => { guard = next; return () => { if (guard === next) guard = null; }; },
  };
  const unsaved = harness('src/hooks/use-confirmation.tsx', (name) => {
    if (name === 'expo-router') return { useIsFocused: () => focused, usePreventRemove: (flag, callback) => { blocked = flag; removeCallback = callback; return () => { disables++; }; } };
    if (name === 'react-native') return { Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', View: 'View' };
    if (name === '@/components/ui/SafeAreaView') return { SafeAreaView: 'SafeAreaView' };
    if (name === '@/components/ui/Button') return { Button: 'Button' };
    throw new Error(name);
  }, () => confirmationContext);
  const renderGuard = () => unsaved.render((mod) => mod.useUnsavedChanges(hasChanges, () => { discards++; hasChanges = false; }, saving));
  renderGuard();
  assert.equal(blocked, true);
  assert.equal(await guard(), false);
  assert.equal(discards, 0);
  accepts = true;
  let repeated = false;
  removeCallback({ repeat: () => { repeated = true; } }); await flush(); renderGuard();
  assert.equal(repeated, true);
  assert.equal(discards, 1);
  assert.ok(disables > 0);
  assert.equal(blocked, false);
  const confirmed = confirmations;
  await guard();
  assert.equal(confirmations, confirmed, 'Saved or discarded forms do not prompt again');
  saving = true; renderGuard();
  assert.equal(await guard(), false, 'An in-flight save cannot be discarded mid-request');
  focused = false; renderGuard();
  assert.equal(guard, null, 'An inactive form does not block navigation elsewhere');
  unsaved.dispose();

  // A delayed permission response from a signed-out owner must not grant a newer user's session access.
  let user = { id: id(9), clubId: club.id }, pathname = '/admin', signIns = 0;
  const requests = [], redirects = [];
  const provider = harness('src/hooks/use-administration.tsx', (name) => {
    if (name === 'expo-router') return { router: { replace: (path) => redirects.push(path) }, usePathname: () => pathname };
    if (name === 'react-native') return { AppState: { addEventListener: () => ({ remove() {} }) } };
    if (name === '@/data/api-auth') return { ApiError };
    if (name === '@/data/administration') return { ...data, administrationService: { access: () => { const next = deferred(); requests.push(next); return next.promise; } } };
    if (name === './use-auth') return { useAuth: () => ({ user, signOut: async () => { user = null; } }) };
    if (name === './use-auth-dialog') return { useAuthDialog: () => ({ openAuthDialog: () => { signIns++; } }) };
    throw new Error(name);
  });
  const state = () => provider.render((mod) => mod.AdministrationProvider({ children: null })).props.value;
  const oldFailureHandler = state().handleFailure;
  user = { id: id(10), clubId: id(11) }; state();
  oldFailureHandler(new AuthError('session-expired', 'Old session expired'));
  assert.equal(user.id, id(10), 'A stale callback must not sign out the newer user');
  requests[0].resolve(grants(true)); await flush();
  assert.equal(state().access, null);
  requests[1].resolve(grants(false)); await flush();
  assert.equal(state().access.canAccessAdministration, false);
  assert.ok(redirects.includes('/'));
  pathname = '/';
  const expired = state().refresh();
  requests.at(-1).reject(new AuthError('session-expired', 'Expired')); await expired; await flush(); state();
  assert.equal(user, null);
  assert.equal(signIns, 1);
  provider.dispose();
  console.log('Administration checks passed: permission parsing and session isolation, authenticated CRUD/refresh, conflicts, date/name validation, form defaults, retained drafts, discard and post-save navigation.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
