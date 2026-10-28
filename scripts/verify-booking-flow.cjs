// File: scripts/verify-booking-flow.cjs
// Exercise the real provider and booking form with controlled API replies and timers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');
const compile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(setImmediate);
const selection = {};
vm.runInNewContext(compile('src/data/game-selection.ts'), { exports: selection });
const bookingData = {};
vm.runInNewContext(compile('src/data/bookings.ts'), { exports: bookingData, Intl, Date, Error,
  require: (name) => name === './game-selection' ? selection : { authService: {} } });
const id = (last) => `61af7d36-2b80-4c9f-a314-${String(last).padStart(12, '0')}`;
const club = { id: id(10), name: 'Test Club', timeZoneId: 'Australia/Sydney' };
const slot = { id: id(11), date: '2099-01-01', startsAtUtc: '2098-12-31T23:00:00Z', endsAtUtc: '2099-01-01T05:00:00Z' };
const table = { id: id(12), name: 'Table 12', size: 'large' };
const booking = { id: id(13), requestId: id(14), timeslotId: slot.id, tableId: table.id, tableName: table.name,
  gameId: id(1), gameName: 'Warhammer 40000', spectators: false, demoGame: false, status: 'Pending',
  failureCode: null, canRetry: false, startsAtUtc: slot.startsAtUtc, endsAtUtc: slot.endsAtUtc };
const harness = (file, dependency, globals = {}) => {
  let cursor = 0;
  const hooks = [];
  const effects = [];
  const changed = (a, b) => !a || !b || a.length !== b.length || b.some((value, i) => value !== a[i]);
  const reactHooks = {
    useState: (initial) => { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], (next) => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }]; },
    useRef: (initial) => { const i = cursor++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i]; },
    useCallback: (fn, deps) => { const i = cursor++; if (changed(hooks[i]?.deps, deps)) hooks[i] = { deps, fn }; return hooks[i].fn; },
    useEffect: (effect, deps) => { const i = cursor++; if (changed(hooks[i]?.deps, deps)) {
      hooks[i]?.cleanup?.(); hooks[i] = { deps }; effects.push(() => { hooks[i].cleanup = effect(); });
    } },
    createContext: () => ({ Provider: 'Provider' }),
  };
  const mod = {};
  vm.runInNewContext(compile(file), { exports: mod, ...globals,
    require: (name) => name === 'react' ? reactHooks : name === 'react/jsx-runtime' ? jsx : dependency(name) });
  let tree;
  const render = (fn) => { cursor = 0; tree = fn(mod); effects.splice(0).forEach((effect) => effect()); return tree; };
  const elements = () => { const all = []; const visit = (node) => React.Children.forEach(node, (child) => {
    if (React.isValidElement(child)) { all.push(child); visit(child.props.children); }
  }); visit(tree); return all; };
  const find = (predicate) => { const el = elements().find(predicate); assert.ok(el, 'Expected booking control'); return el.props; };
  return { render, elements, find, dispose: () => hooks.forEach((hook) => hook?.cleanup?.()) };
};
(async () => {
  let records = [];
  let details = booking;
  let createReply;
  const submitted = [];
  const api = {
    club: async () => club,
    list: async () => records,
    get: async () => details,
    create: async (clubId, draft) => { submitted.push({ clubId, draft }); return createReply.promise; },
  };
  const timers = new Map();
  let timerId = 0;
  const p = harness('src/hooks/use-bookings.tsx', (name) => {
    if (name === '@/data/bookings') return { ...bookingData, bookingsService: api };
    if (name === 'react-native') return { Platform: { OS: 'web' }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } };
    if (name === 'expo-haptics') return {};
    throw new Error(name);
  }, { setTimeout: (fn) => { timers.set(++timerId, fn); return timerId; }, clearTimeout: (key) => timers.delete(key) });
  const provider = () => p.render((mod) => mod.BookingsProvider({ clubId: club.id, children: null })).props.value;
  provider(); await flush();
  let state = provider();
  assert.equal(state.club.id, club.id);
  const navigation = [];
  const f = harness('src/app/create-booking.tsx', (name) => {
    if (name === 'expo-router') return { router: { replace: (path) => navigation.push(path) }, Stack: { Screen: 'Screen' }, usePreventRemove: () => () => {}, Redirect: 'Redirect' };
    if (name === 'react-native') return { ActivityIndicator: 'ActivityIndicator', KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: 'Modal', Platform: { OS: 'web' }, Pressable: 'Pressable', ScrollView: 'ScrollView', Switch: 'Switch', Text: 'Text', View: 'View' };
    if (name === '@/data/bookings') return bookingData;
    if (name === '@/data/game-selection') return selection;
    if (name === '@/hooks/use-bookings') return { useBookings: () => state };
    if (name === '@/hooks/use-auth') return { useAuth: () => ({ user: { id: 'member', clubId: club.id } }) };
    if (name === '@/hooks/use-wide-navigation') return { useWideNavigation: () => false };
    if (name === '@/hooks/use-header-scroll') return { useScreenScroll: () => () => {} };
    if (name === '@/hooks/use-booking-options') return { useBookingOptions: () => ({ timeslots: [slot], tables: [table], loadingDates: false, loadingTables: false, datesError: null, tablesError: null, retry() {} }) };
    const components = {
      '@/components/ui/SafeAreaView': { SafeAreaView: 'SafeAreaView' },
      '@/components/ui/Button': { Button: 'Button' },
      '@/components/booking-calendar': { BookingCalendar: 'BookingCalendar' },
      '@/components/game-select': { GameSelect: 'GameSelect' },
      '@/components/navigation-header': { HeaderScrollInset: 'HeaderScrollInset' },
      '@/components/screen-heading': { ScreenHeading: 'ScreenHeading' },
    };
    if (components[name]) return components[name];
    throw new Error(name);
  });
  const render = () => f.render((mod) => { const Form = mod.default().type; return Form(); });
  const button = (label) => f.find((el) => el.type === 'Button' && el.props.children === label);
  const press = (label) => { const result = button(label).onPress(); render(); return result; };
  render();
  await press('Next');
  assert.equal(submitted.length, 0, 'Incomplete form cannot submit');
  f.find((el) => el.type === 'BookingCalendar').onChange(slot.date); render();
  await press('Next');
  await press(table.name);
  await press('Next');
  const select = f.find((el) => el.type === 'GameSelect');
  select.onChange({ ...select.value, gameId: booking.gameId, game: booking.gameName, otherGameName: '' }); render();
  await press('Next');
  createReply = deferred();
  const failure = press('Confirm Booking');
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].clubId, club.id);
  assert.equal(submitted[0].draft.timeslotId, slot.id);
  assert.equal(submitted[0].draft.tableId, table.id);
  assert.deepEqual(navigation, [], 'Form waits for API acceptance');
  await press('Confirm Booking');
  assert.equal(submitted.length, 1, 'Duplicate presses cannot submit twice');
  createReply.reject(new Error('Connection unavailable'));
  await failure; render();
  assert.equal(f.elements().some((el) => el.type === 'Text' && el.props.children === 'Connection unavailable'), true);
  assert.deepEqual(navigation, [], 'Submission errors keep the form open');
  const requestId = submitted[0].draft.requestId;
  createReply = deferred();
  const success = press('Confirm Booking');
  assert.equal(submitted[1].draft.requestId, requestId, 'Retry preserves the command UUID');
  createReply.resolve({ ...booking, requestId });
  await success; render(); state = provider();
  assert.deepEqual(navigation, ['/']);
  assert.equal(state.bookings[0].status, 'Pending');
  assert.equal(state.bookings.length, 1);
  records = [];
  details = { ...booking, requestId, status: 'Rejected', failureCode: 'ProcessingTimeout', canRetry: true };
  const tick = [...timers.values()][0]; timers.clear();
  await tick(); await flush(); state = provider();
  assert.equal(state.bookings[0].status, 'Rejected', 'Polling retains rejection even when it disappears from the active list');
  await state.refresh(); state = provider();
  assert.equal(state.bookings[0].failureCode, 'ProcessingTimeout');
  f.dispose(); p.dispose();
  assert.equal(timers.size, 0, 'Provider unmount clears status polling');

  const tableRequests = [];
  const o = harness('src/hooks/use-booking-options.ts', (name) => {
    if (name === '@/data/bookings') return { ...bookingData, bookingsService: {
      timeslots: async () => [slot],
      tables: async (selectedClub, selectedSlot) => {
        const response = deferred();
        tableRequests.push({ selectedClub, selectedSlot, response });
        return response.promise;
      },
    } };
    throw new Error(name);
  });
  let selectedSlot = slot.id;
  const optionState = () => o.render((mod) => mod.useBookingOptions(club.id, selectedSlot));
  assert.equal(optionState().loadingTables, true);
  await flush();
  assert.equal(optionState().timeslots[0].id, slot.id);
  selectedSlot = id(20);
  assert.equal(optionState().tables.length, 0, 'Session changes immediately hide stale tables');
  tableRequests[0].response.resolve([table]);
  await flush();
  assert.equal(optionState().loadingTables, true, 'A late result from the previous session is ignored');
  tableRequests[1].response.resolve([{ ...table, id: id(21), name: 'New session table' }]);
  await flush();
  assert.equal(optionState().tables[0].id, id(21));
  optionState().retry();
  assert.equal(optionState().loadingTables, true);
  tableRequests[2].response.reject(new Error('Availability unavailable'));
  await flush();
  assert.equal(optionState().tablesError, 'Availability unavailable');
  assert.equal(optionState().tables.length, 0);
  o.dispose();
  console.log('Booking flow checks passed: API acceptance before navigation, real IDs, duplicate prevention, visible failures, stable retries, pending/rejection polling and cleanup.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
