// File: scripts/verify-scheduling.cjs
// Contract and editor-state checks exercise production modules without writing live club data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const jsx = require('react/jsx-runtime');
const compile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const modules = new Map();
const load = (name) => {
  if (name === 'auth-service') return { authService: {} };
  if (modules.has(name)) return modules.get(name);
  const exports = {};
  vm.runInNewContext(compile(`src/data/${name}.ts`), { exports, Error, Date, Intl, Promise, AbortController, setTimeout, clearTimeout,
    fetch: () => { throw new Error('Unexpected network request'); }, require: (path) => load(path.slice(2)) });
  modules.set(name, exports); return exports;
};
const data = load('scheduling');
const { ApiError, createApiAuthService } = load('api-auth');
const id = (n) => `61af7d36-2b80-4c9f-a314-${String(n).padStart(12, '0')}`;
const club = { id: id(1), timeZoneId: 'Australia/Sydney', commencementDate: '2026-01-01' };
const date = '2099-11-07';
const slot = { id: id(2), clubId: club.id, recurringScheduleId: null, localSessionDate: date, timeZoneId: club.timeZoneId,
  startTime: '18:00:00', endTime: '21:00:00', name: null, description: null, startsAtUtc: `${date}T07:00:00Z`, endsAtUtc: `${date}T10:00:00Z`,
  occurrenceType: 'Additional', closedAtUtc: null, closedByUserId: null, revision: 1, tableIds: [], effectiveTableIds: [] };
const rule = { id: id(3), clubId: club.id, timeZoneId: club.timeZoneId, weekday: 'Saturday', startTime: '18:00:00', endTime: '21:00:00',
  scheduleStartDate: date, scheduleEndDate: null, name: null, description: null, tableIds: [] };
const catalogue = [{ id: id(10), name: 'Table 1', size: 'small', availableFromDate: '2026-01-01', isEnabled: true },
  { id: id(11), name: 'Table 2', size: 'large', availableFromDate: '2100-01-01', isEnabled: true },
  { id: id(12), name: 'Disabled', size: 'small', availableFromDate: '2026-01-01', isEnabled: false }];
const json = (value, status = 200, etag = '"v1"') => new Response(status === 204 ? null : JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...(etag ? { ETag: etag } : {}) } });
const plain = (value) => JSON.parse(JSON.stringify(value));

const editorHarness = (service, resource) => {
  const hooks = [], effects = [];
  let cursor = 0, changed = false, state, dirty;
  const equalDeps = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);
  const react = {
    useState: (initial) => { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], (next) => { const value = typeof next === 'function' ? next(hooks[i]) : next; if (!Object.is(value, hooks[i])) changed = true; hooks[i] = value; }]; },
    useCallback: (fn, deps) => { const i = cursor++; if (!equalDeps(hooks[i]?.deps, deps)) hooks[i] = { fn, deps }; return hooks[i].fn; },
    useEffect: (fn, deps) => { const i = cursor++; if (!equalDeps(hooks[i]?.deps, deps)) { hooks[i]?.cleanup?.(); hooks[i] = { deps }; effects.push(() => { hooks[i].cleanup = fn(); }); } },
  };
  const exports = {};
  vm.runInNewContext(compile('src/hooks/use-schedule-editor.ts'), { exports, Error, Date, Promise, setInterval, clearInterval,
    require: (name) => name === 'react' ? react : name === './use-administration' ? {
      useAdministration: () => ({ clubId: club.id, handleFailure: () => {}, leaving: false }),
      useAdministrationLifetime: () => () => true, useAdministrationResource: () => resource,
    } : name === './use-confirmation' ? { useUnsavedChanges: (value) => { dirty = value; return { markSaved: () => {} }; } }
      : name.endsWith('/scheduling') ? { ...data, schedulingService: service } : name.endsWith('/schedule-tables') ? load('schedule-tables')
      : name.endsWith('/administration') ? { ...load('administration'), administrationService: { club: async () => club, tables: async () => catalogue } }
      : name.endsWith('/api-auth') ? load('api-auth') : name.endsWith('/bookings') ? load('bookings') : (() => { throw new Error(name); })() });
  return {
    render: (kind = 'single', existing = slot.id) => { let n = 0; do { cursor = 0; changed = false; state = exports.useScheduleEditor(kind, true, existing); if (++n > 20) throw new Error('Render loop'); } while (changed);
      effects.splice(0).forEach((fn) => fn()); return state; },
    get dirty() { return dirty; }, dispose: () => hooks.forEach((hook) => hook?.cleanup?.()),
  };
};
const pickerHarness = (initial = {}) => {
  const hooks = []; let cursor, tree;
  const applied = []; let closed = 0;
  let props = { value: [], inheritedIds: null, tables: catalogue, retainedIds: [], canInherit: false, disabled: false, refreshing: false,
    refresh: async () => {}, apply: (ids) => applied.push(plain(ids)), close: () => { closed++; }, ...initial };
  const exports = {};
  vm.runInNewContext(compile('src/components/administration/TableAssignments.tsx'), { exports,
    require: (name) => name === 'react' ? { useState: (initial) => { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], (value) => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; } }
      : name === 'react/jsx-runtime' ? jsx : name === 'react-native' ? Object.fromEntries(['FlatList', 'Pressable', 'Switch', 'Text', 'View'].map((key) => [key, key]))
      : name === '@expo/vector-icons' ? { Ionicons: 'Icon' } : name.endsWith('/schedule-tables') ? load('schedule-tables')
      : name.endsWith('/Button') ? { Button: 'Button' } : name === './AdminPage' ? { Message: 'Message' } : name === './ScheduleControls' ? { ScheduleModal: 'Modal' }
      : (() => { throw new Error(name); })() });
  const elements = (root = tree) => { const result = []; const visit = (node) => React.Children.forEach(node, (el) => {
    if (React.isValidElement(el)) { result.push(el); visit(el.props.children); visit(el.props.ListHeaderComponent); visit(el.props.ListFooterComponent); }
  }); visit(root); return result; };
  const render = (next = {}) => { props = { ...props, ...next }; cursor = 0; tree = exports.TableAssignmentPicker(props); };
  const find = (type, text) => { const el = elements().find((el) => el.type === type && (text === undefined || el.props.children === text)); assert.ok(el, `Missing ${type}: ${text}`); return el.props; };
  render();
  return { render, applied, get closed() { return closed; }, find,
    row: (id) => { const list = find('FlatList'); const index = list.data.findIndex((item) => item.id === id); assert.ok(index >= 0, `Missing table row ${id}`);
      return elements(list.renderItem({ item: list.data[index], index })).find((el) => el.props.accessibilityRole === 'checkbox').props; },
  };
};
(async () => {
  let saved = JSON.stringify({ accessToken: 'opaque', refreshToken: 'refresh', expiresAt: Date.now() + 900000, clubId: club.id });
  const calls = [];
  let reply = () => json(slot);
  const auth = createApiAuthService({ baseUrl: 'https://api.test', storage: { read: () => saved, write: (v) => { saved = v; }, clear: () => { saved = null; } },
    fetcher: async (url, init) => { calls.push({ url, ...init }); return reply(url, init); } });
  const service = data.createSchedulingService(auth);
  assert.equal((await service.details(club.id, 'single', slot.id)).etag, '"v1"');
  let draft = data.emptyDraft(date);
  await service.save(club.id, 'single', draft, { id: slot.id, etag: '"opaque-version"' });
  assert.equal(calls.at(-1).headers['If-Match'], '"opaque-version"');
  assert.equal(calls.at(-1).method, 'PUT');
  assert.deepEqual(JSON.parse(calls.at(-1).body), { name: null, description: null, startTime: '18:00:00', endTime: '21:00:00', localSessionDate: date, tableIds: [] });
  reply = () => json(rule, 201);
  await service.save(club.id, 'recurring', { ...draft, name: ' Weekly ', description: ' Details ' });
  assert.equal(calls.at(-1).method, 'POST');
  assert.equal(calls.at(-1).headers['If-Match'], undefined);
  assert.deepEqual(JSON.parse(calls.at(-1).body), { name: 'Weekly', description: 'Details', weekday: draft.weekday, startTime: '18:00:00', endTime: '21:00:00', scheduleStartDate: date, scheduleEndDate: null, tableIds: [] });
  reply = () => json([slot]);
  await service.timeslots(club.id, date, date);
  assert.ok(calls.at(-1).url.endsWith(`/administration/timeslots?fromDate=${date}&toDate=${date}&includeClosed=false`));
  await service.timeslots(club.id, date, date, true);
  assert.ok(calls.at(-1).url.endsWith('includeClosed=true'), 'Calendar can read closure exceptions without displaying them');
  reply = () => json(null, 204);
  await service.remove(club.id, 'single', slot.id, '"delete-version"');
  assert.equal(calls.at(-1).method, 'DELETE');
  assert.equal(calls.at(-1).headers['If-Match'], '"delete-version"');
  assert.equal(calls.at(-1).body, undefined);
  reply = () => json(slot, 200, null);
  await assert.rejects(service.details(club.id, 'single', slot.id), /ETag/);
  let rejected = false;
  reply = (url, init) => url.endsWith('/auth/refresh') ? json({ tokenType: 'Bearer', accessToken: 'fresh', refreshToken: 'fresh-refresh', expiresIn: 900 })
    : url.endsWith('/auth/me') ? (init.headers.Authorization === 'Bearer fresh' ? json({ userId: id(9), email: 'owner@example.test', displayName: 'Owner', clubId: club.id }) : json({}, 401))
    : !rejected ? (rejected = true, json({}, 401)) : json(slot, 200, '"v2"');
  assert.equal((await service.save(club.id, 'single', draft, { id: slot.id, etag: '"v1"' })).etag, '"v2"');
  assert.equal(calls.at(-1).headers['If-Match'], '"v1"', 'Refresh retains precondition');
  assert.equal(calls.at(-1).method, 'PUT');
  assert.equal(calls.at(-1).headers.Authorization, 'Bearer fresh');
  assert.equal(data.displayName(slot), 'Additional Session');
  const inherited = { ...slot, recurringScheduleId: rule.id, occurrenceType: 'Customised', tableIds: null, effectiveTableIds: [id(10)] };
  const inheritedDraft = data.draftFrom(inherited, date);
  assert.equal(inheritedDraft.tableIds, null, 'Name/time-customised sessions retain separate table inheritance');
  assert.equal(data.schedulePayload({ ...inheritedDraft, name: 'New name' }, 'single').tableIds, null);
  assert.deepEqual(plain(data.schedulePayload({ ...inheritedDraft, tableIds: [] }, 'single').tableIds), [], 'Zero overrides stay explicit');
  reply = () => json(inherited);
  await service.save(club.id, 'single', { ...inheritedDraft, name: 'Only the title changed' }, { id: slot.id, etag: '"inherited"' });
  assert.equal(JSON.parse(calls.at(-1).body).tableIds, null, 'The real authenticated PUT preserves inheritance');
  assert.equal('effectiveTableIds' in JSON.parse(calls.at(-1).body), false, 'Server-owned resolved IDs never enter the write payload');
  assert.throws(() => data.schedulePayload({ ...draft, tableIds: null }, 'recurring'), /selection/);
  assert.throws(() => data.parseSchedule({ ...slot, tableIds: undefined }, 'single'), /outdated/);
  assert.throws(() => data.parseSchedule({ ...slot, tableIds: null }, 'single'), /outdated/, 'One-offs cannot inherit');
  assert.throws(() => data.parseSchedule({ ...rule, tableIds: [id(10), id(10)] }, 'recurring'), /outdated/);
  const selection = load('schedule-tables');
  assert.equal(selection.tableSelectionError([], catalogue, [], false), undefined);
  assert.equal(selection.tableSelectionError([id(11)], catalogue, [], false), undefined, 'Future availability does not prevent assignment');
  assert.equal(selection.tableSelectionError([id(12)], catalogue, [id(12)], false), undefined, 'Disabled existing assignments may be retained');
  assert.match(selection.tableSelectionError([id(12)], catalogue, [], false), /disabled/);
  assert.match(selection.tableSelectionError([id(99)], catalogue, [], false), /no longer/);
  assert.equal(selection.tableSelectionError(null, catalogue, [], true), undefined);
  assert.match(selection.tableSelectionError(null, catalogue, [], false), /explicit/);
  assert.deepEqual(plain(selection.assignmentRows(catalogue, [id(12)])).map((row) => row.id), [id(10), id(11), id(12)]);
  assert.deepEqual(plain(selection.toggleTable([id(10), id(12)], id(10))), [id(12)], 'Toggling another row does not drop disabled assignments');
  assert.equal(data.savedDraft({ ...rule, scheduleStartDate: '2026-01-01' }).scheduleStartDate, '2026-01-01', 'Latest saved comparison shows the stored range, not the edit default');
  assert.equal(data.displayName({ ...slot, occurrenceType: 'Customised' }), 'Regular Session');
  assert.equal(data.editableTimeslot({ ...slot, startsAtUtc: '2000-01-01T00:00:00Z' }), false);
  assert.equal(data.editableTimeslot({ ...slot, closedAtUtc: '2026-01-01T00:00:00Z' }), false);
  assert.ok(data.validateSchedule({ ...draft, startTime: '18:07:00' }, 'single', '2099-11-06', '10:00:00', '2026-01-01').startTime);
  assert.ok(data.validateSchedule({ ...draft, endTime: '17:00:00' }, 'single', '2099-11-06', '10:00:00', '2026-01-01').endTime);
  assert.ok(data.validateSchedule(draft, 'single', date, '19:00:00', '2026-01-01').startTime);
  assert.ok(data.validateSchedule({ ...draft, scheduleEndDate: '2020-01-01' }, 'recurring', '2026-10-29', '10:00:00', '2026-01-01').scheduleEndDate);
  assert.deepEqual(plain(data.monthRange('2028-02')), { from: '2028-02-01', to: '2028-02-29' });
  assert.equal(data.moveMonth('2026-12', 1), '2027-01');
  assert.equal(data.sortSchedules([{ ...rule, scheduleEndDate: '2026-01-01' }, { ...rule, weekday: 'Monday' }], '2026-10-29', false).length, 1);

  let writes = 0, failure = null, sent;
  const resource = { data: { club, item: { value: slot, etag: '"original"' }, tables: catalogue, parentTableIds: null }, loading: false, error: null, refreshing: false, refresh: async () => {} };
  const mock = { save: async (...args) => { writes++; sent = args; if (failure) throw failure; return { value: { ...slot, name: args[2].name, tableIds: args[2].tableIds, effectiveTableIds: args[2].tableIds ?? [id(10)] }, etag: '"saved"' }; },
    details: async () => ({ value: { ...slot, name: 'Someone else changed this' }, etag: '"latest"' }) };
  const harness = editorHarness(mock, resource);
  try {
    let editor = harness.render();
    editor.change('name', 'My draft'); editor.change('tableIds', [id(10)]); editor = harness.render();
    editor.review(); editor = harness.render();
    assert.equal(editor.stage, 'review'); assert.equal(writes, 0, 'Save is review-only');
    failure = new ApiError(409, 'service', 'Conflict', 'TimeslotHasActiveBookings');
    assert.equal(await editor.confirm(), false); editor = harness.render();
    assert.equal(editor.input.name, 'My draft'); assert.equal(editor.stage, 'review'); assert.match(editor.error, /bookings/);
    assert.deepEqual(plain(editor.input.tableIds), [id(10)], '409 retains table selection');
    failure = new ApiError(412, 'service', 'Stale', 'PreconditionFailed');
    await editor.confirm(); editor = harness.render();
    assert.equal(editor.stale, true); const count = writes;
    await editor.confirm(); editor = harness.render(); assert.equal(writes, count, 'No stale retry');
    await editor.reloadLatest(); editor = harness.render();
    assert.equal(editor.input.name, 'My draft'); assert.equal(editor.latest.etag, '"latest"');
    assert.deepEqual(plain(editor.input.tableIds), [id(10)], '412 reload retains provisional table selection until explicit reconciliation');
    editor.reconcile(true); editor = harness.render();
    assert.equal(editor.stage, 'form'); assert.equal(editor.input.name, 'My draft');
    failure = null; editor.review(); editor = harness.render(); await editor.confirm(); editor = harness.render();
    assert.equal(sent[3].etag, '"latest"', 'Explicit reconciliation adopts latest version');
    assert.equal(editor.stage, 'saved'); assert.equal(harness.dirty, false);
    const confirmed = writes; await editor.confirm(); assert.equal(writes, confirmed, 'Saved summary cannot submit again');
    editor.editSaved(); editor = harness.render(); assert.equal(editor.stage, 'form'); assert.equal(editor.current.etag, '"saved"');
  } finally { harness.dispose(); }
  const locked = editorHarness(mock, { ...resource, data: { club, item: { value: { ...slot, startsAtUtc: '2000-01-01T00:00:00Z' }, etag: '"started"' } } });
  try { const editor = locked.render(); assert.equal(editor.readOnly, true); const initial = editor.input.name; editor.change('name', 'forbidden'); assert.equal(locked.render().input.name, initial); assert.equal(editor.review(), false); }
  finally { locked.dispose(); }
  const create = editorHarness(mock, { ...resource, data: { club, item: null, tables: catalogue, parentTableIds: null } });
  try {
    let editor = create.render(); editor.change('localSessionDate', date); editor = create.render();
    editor.review(); editor = create.render(); await editor.confirm(); editor = create.render();
    assert.equal(sent[3], undefined, 'A new timeslot is created without an existing ID');
    assert.equal(editor.stage, 'saved');
    editor.editSaved(); editor = create.render(); editor.change('description', 'Updated after creation'); editor = create.render();
    editor.review(); editor = create.render(); await editor.confirm();
    assert.equal(sent[3].id, slot.id, 'Editing after creation uses the returned resource ID');
    assert.equal(sent[3].etag, '"saved"');
  } finally { create.dispose(); }
  const inheritedService = { ...mock, details: async (_club, kind) => ({ value: kind === 'recurring' ? { ...rule, tableIds: [id(10)] } : inherited, etag: '"inherited-latest"' }) };
  const inheritedEditor = editorHarness(inheritedService, { ...resource, data: { ...resource.data, item: { value: inherited, etag: '"inherited"' }, parentTableIds: [id(10)] } });
  try {
    let editor = inheritedEditor.render(); assert.equal(editor.input.tableIds, null); assert.equal(editor.dateFixed, true);
    editor.change('name', 'Title only'); editor = inheritedEditor.render(); editor.review(); editor = inheritedEditor.render(); await editor.confirm();
    assert.equal(sent[2].tableIds, null, 'An unrelated form edit preserves inheritance through the actual editor submission');
  } finally { inheritedEditor.dispose(); }
  const futureRule = editorHarness(mock, { ...resource, data: { ...resource.data, item: { value: { ...rule, tableIds: [id(10)] }, etag: '"rule"' } } });
  try {
    let editor = futureRule.render('recurring', rule.id); editor.change('tableIds', [id(11)]); editor.change('scheduleStartDate', date);
    editor = futureRule.render('recurring', rule.id); editor.review(); editor = futureRule.render('recurring', rule.id);
    assert.equal(editor.stage, 'form'); assert.match(editor.errors.tableIds, /only today/, 'Known API cutoff gap cannot silently change earlier assignments');
    const before = writes; await editor.confirm(); assert.equal(writes, before);
    editor.change('tableIds', [id(10)]); editor = futureRule.render('recurring', rule.id); editor.review(); editor = futureRule.render('recurring', rule.id);
    assert.equal(editor.stage, 'review', 'Unchanged table selections still permit unrelated future-effective edits');
  } finally { futureRule.dispose(); }
  const newFutureRule = editorHarness(mock, { ...resource, data: { ...resource.data, item: null } });
  try {
    let editor = newFutureRule.render('recurring'); editor.change('scheduleStartDate', date); editor.change('tableIds', [id(11)]);
    editor = newFutureRule.render('recurring'); editor.review(); assert.equal(newFutureRule.render('recurring').stage, 'review', 'New future schedules can configure tables');
  } finally { newFutureRule.dispose(); }
  const picker = pickerHarness();
  assert.equal(picker.row(id(11)).accessibilityState.checked, false, 'Future-available active tables are offered, never auto-selected');
  picker.row(id(10)).onPress(); picker.render(); assert.equal(picker.applied.length, 0, 'Taps remain provisional');
  picker.row(id(10)).onPress(); picker.render(); picker.find('Button', 'Confirm').onPress();
  assert.deepEqual(picker.applied, [[]], 'Confirm accepts an empty table selection');
  const cancel = pickerHarness(); cancel.row(id(10)).onPress(); cancel.render(); cancel.find('Button', 'Cancel').onPress();
  assert.equal(cancel.applied.length, 0); assert.equal(cancel.closed, 1, 'Cancel closes without modifying form state');
  const back = pickerHarness(); back.row(id(10)).onPress(); back.render(); back.find('Modal').close();
  assert.equal(back.applied.length, 0, 'Native Back/Close discards only picker changes');
  const inheritPicker = pickerHarness({ value: null, inheritedIds: [id(10), id(12)], retainedIds: [id(10), id(12)], canInherit: true });
  assert.equal(inheritPicker.row(id(10)).disabled, true);
  inheritPicker.find('Button', 'Confirm').onPress(); assert.deepEqual(inheritPicker.applied, [null], 'Unchanged inherited confirmation never freezes a snapshot');
  inheritPicker.find('Switch').onValueChange(false); inheritPicker.render(); inheritPicker.row(id(11)).onPress(); inheritPicker.render();
  inheritPicker.find('Button', 'Confirm').onPress(); assert.deepEqual(inheritPicker.applied.at(-1), [id(10), id(11), id(12)]);
  const reset = pickerHarness({ value: [], inheritedIds: [id(10)], retainedIds: [], canInherit: true });
  reset.find('Switch').onValueChange(true); reset.render(); reset.find('Button', 'Confirm').onPress(); assert.deepEqual(reset.applied, [null], 'Zero-table override can restore inheritance');
  const disabled = pickerHarness({ value: [id(10), id(12)], retainedIds: [id(10), id(12)] });
  disabled.row(id(10)).onPress(); disabled.render(); disabled.find('Button', 'Confirm').onPress();
  assert.deepEqual(disabled.applied, [[id(12)]], 'Selecting active tables never silently drops hidden disabled assignments');
  const changed = pickerHarness(); changed.row(id(10)).onPress(); changed.render({ tables: catalogue.map((table) => table.id === id(10) ? { ...table, isEnabled: false } : table) });
  changed.find('Button', 'Confirm').onPress(); changed.render(); assert.equal(changed.applied.length, 0, 'A newly disabled selection requires explicit correction');
  changed.row(id(10)).onPress(); changed.render(); changed.find('Button', 'Confirm').onPress(); assert.deepEqual(changed.applied, [[]]);
  const removed = pickerHarness({ value: [id(10)], retainedIds: [id(10)] }); removed.render({ tables: catalogue.filter((table) => table.id !== id(10)) });
  removed.find('Button', 'Confirm').onPress(); assert.equal(removed.applied.length, 0);
  removed.row(id(10)).onPress(); removed.render(); removed.find('Button', 'Confirm').onPress(); assert.deepEqual(removed.applied, [[]]);
  const refreshed = pickerHarness({ value: [id(10)], retainedIds: [id(10)] });
  refreshed.render({ tables: [...catalogue, { ...catalogue[0], id: id(14), name: 'New table' }] });
  assert.equal(refreshed.row(id(14)).accessibilityState.checked, false, 'Refreshing new tables never automatically assigns them');
  console.log('Scheduling verified: table picker draft/confirm/cancel, disabled/deleted selections, empty sets, inheritance/reset, exact payloads and ETags, conflicts/reconciliation, saved flow and read-only sessions.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
