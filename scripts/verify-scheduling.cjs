// File: scripts/verify-scheduling.cjs
// Contract and editor-state checks exercise production modules without writing live club data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
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
  occurrenceType: 'Additional', closedAtUtc: null, closedByUserId: null, revision: 1 };
const rule = { id: id(3), clubId: club.id, timeZoneId: club.timeZoneId, weekday: 'Saturday', startTime: '18:00:00', endTime: '21:00:00',
  scheduleStartDate: date, scheduleEndDate: null, name: null, description: null };
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
      : name.endsWith('/scheduling') ? { ...data, schedulingService: service } : name.endsWith('/administration') ? load('administration')
      : name.endsWith('/api-auth') ? load('api-auth') : name.endsWith('/bookings') ? load('bookings') : (() => { throw new Error(name); })() });
  return {
    render: (kind = 'single', existing = slot.id) => { let n = 0; do { cursor = 0; changed = false; state = exports.useScheduleEditor(kind, true, existing); if (++n > 20) throw new Error('Render loop'); } while (changed);
      effects.splice(0).forEach((fn) => fn()); return state; },
    get dirty() { return dirty; }, dispose: () => hooks.forEach((hook) => hook?.cleanup?.()),
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
  assert.deepEqual(JSON.parse(calls.at(-1).body), { name: null, description: null, startTime: '18:00:00', endTime: '21:00:00', localSessionDate: date });
  reply = () => json(rule, 201);
  await service.save(club.id, 'recurring', { ...draft, name: ' Weekly ', description: ' Details ' });
  assert.equal(calls.at(-1).method, 'POST');
  assert.equal(calls.at(-1).headers['If-Match'], undefined);
  assert.deepEqual(JSON.parse(calls.at(-1).body), { name: 'Weekly', description: 'Details', weekday: draft.weekday, startTime: '18:00:00', endTime: '21:00:00', scheduleStartDate: date, scheduleEndDate: null });
  reply = () => json([slot]);
  await service.timeslots(club.id, date, date);
  assert.ok(calls.at(-1).url.endsWith(`/administration/timeslots?fromDate=${date}&toDate=${date}&includeClosed=false`));
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
  const resource = { data: { club, item: { value: slot, etag: '"original"' } }, loading: false, error: null, refreshing: false, refresh: async () => {} };
  const mock = { save: async (...args) => { writes++; sent = args; if (failure) throw failure; return { value: { ...slot, name: args[2].name }, etag: '"saved"' }; },
    details: async () => ({ value: { ...slot, name: 'Someone else changed this' }, etag: '"latest"' }) };
  const harness = editorHarness(mock, resource);
  try {
    let editor = harness.render();
    editor.change('name', 'My draft'); editor = harness.render();
    editor.review(); editor = harness.render();
    assert.equal(editor.stage, 'review'); assert.equal(writes, 0, 'Save is review-only');
    failure = new ApiError(409, 'service', 'Conflict', 'TimeslotHasActiveBookings');
    assert.equal(await editor.confirm(), false); editor = harness.render();
    assert.equal(editor.input.name, 'My draft'); assert.equal(editor.stage, 'review'); assert.match(editor.error, /bookings/);
    failure = new ApiError(412, 'service', 'Stale', 'PreconditionFailed');
    await editor.confirm(); editor = harness.render();
    assert.equal(editor.stale, true); const count = writes;
    await editor.confirm(); editor = harness.render(); assert.equal(writes, count, 'No stale retry');
    await editor.reloadLatest(); editor = harness.render();
    assert.equal(editor.input.name, 'My draft'); assert.equal(editor.latest.etag, '"latest"');
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
  const create = editorHarness(mock, { ...resource, data: { club, item: null } });
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
  console.log('Scheduling verified: exact payloads, ETags and refresh, API conflicts, review-only Save, explicit stale reconciliation, saved flow and read-only sessions.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
