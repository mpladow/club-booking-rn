// File: scripts/verify-schedule-calendar.cjs
// Calendar previews use local dates and never masquerade as persisted timeslots.
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
  vm.runInNewContext(compile(`src/data/${name}.ts`), { exports, Date, Intl, Error, Promise,
    require: (path) => load(path.slice(2)) });
  modules.set(name, exports);
  return exports;
};
const calendar = load('schedule-calendar');
const scheduling = load('scheduling');
const plain = (value) => JSON.parse(JSON.stringify(value));
const club = { id: 'club', timeZoneId: 'Australia/Sydney', commencementDate: '2026-10-28', bookingWindowDays: 7 };
const friday = { id: 'friday', weekday: 'Friday', scheduleStartDate: '2026-10-30', scheduleEndDate: '2026-12-01',
  startTime: '18:00:00', endTime: '21:00:00', description: 'Weekly session', name: null, tableIds: [] };
const tuesday = { ...friday, id: 'tuesday', weekday: 'Tuesday', scheduleEndDate: '2026-11-10', startTime: '17:00:00' };
const persisted = [{ id: 'generated', recurringScheduleId: friday.id, localSessionDate: '2026-10-30', closedAtUtc: null, startTime: friday.startTime },
  { id: 'tuesday-slot', recurringScheduleId: tuesday.id, localSessionDate: '2026-11-03', closedAtUtc: null, startTime: tuesday.startTime }];
const preview = (month = '2026-11', rules = [friday, tuesday], slots = persisted, metadata = club, today = '2026-10-30') =>
  calendar.recurringPreviews(month, today, metadata, rules, slots);
const dates = (values) => plain(values.map((value) => `${value.schedule.id}:${value.localSessionDate}`));
assert.equal(calendar.bookingWindowEnd('2026-10-30', 7), '2026-11-05');
assert.deepEqual(dates(preview()), ['friday:2026-11-06', 'tuesday:2026-11-10', 'friday:2026-11-13', 'friday:2026-11-20', 'friday:2026-11-27'], 'Reported November calendar previews all remaining weekly dates');
assert.deepEqual(dates(preview('2026-10')), [], 'Never invent past dates or fill missing generated dates within the window');
assert.deepEqual(dates(preview('2026-12')), [], 'End dates are inclusive and weekday matching is required');
assert.deepEqual(dates(preview('2026-11', [])), [], 'Removing a rule removes its previews');
assert.deepEqual(dates(preview('2026-11', [{ ...friday, scheduleStartDate: '2026-11-07', scheduleEndDate: '2026-11-20' }])), ['friday:2026-11-13', 'friday:2026-11-20']);
assert.deepEqual(dates(preview('2026-11', [friday], [], { ...club, commencementDate: '2026-11-21' })), ['friday:2026-11-27'], 'Respect club commencement');
const exceptions = [
  { ...persisted[0], localSessionDate: '2026-11-06', closedAtUtc: '2026-10-30T01:00:00Z' },
  { ...persisted[0], localSessionDate: '2026-11-13', occurrenceType: 'Customised', startTime: '19:00:00' },
];
assert.deepEqual(dates(preview('2026-11', [friday], exceptions)), ['friday:2026-11-20', 'friday:2026-11-27'], 'Closed and customised exceptions never reappear as default previews');
assert.deepEqual(dates(preview('2026-11', [friday], [{ ...persisted[0], recurringScheduleId: null, localSessionDate: '2026-11-06' }])), ['friday:2026-11-06', 'friday:2026-11-13', 'friday:2026-11-20', 'friday:2026-11-27'], 'A one-off on the same day does not suppress another recurring rule');
assert.equal(preview('2026-11', [friday], persisted, club, '2026-10-31').some((item) => item.localSessionDate === '2026-11-06'), false, 'As the window rolls forward, previews yield to generated occurrences');
assert.deepEqual(dates(preview('2028-02', [{ ...friday, weekday: 'Tuesday', scheduleStartDate: '2028-02-01', scheduleEndDate: null }], [], club, '2028-02-20')), ['friday:2028-02-29'], 'Leap day and open-ended rules use calendar arithmetic');
assert.deepEqual(dates(preview('2026-10', [{ ...friday, weekday: 'Sunday', scheduleStartDate: '2026-09-01', scheduleEndDate: null }], [], club, '2026-09-25')), [], 'Commencement can exclude DST-transition dates');
assert.deepEqual(dates(preview('2026-10', [{ ...friday, weekday: 'Sunday', scheduleStartDate: '2026-09-01', scheduleEndDate: null }], [], { ...club, commencementDate: '2026-01-01' }, '2026-09-25')), ['friday:2026-10-04', 'friday:2026-10-11', 'friday:2026-10-18', 'friday:2026-10-25'], 'Club-local dates stay stable across Sydney DST');

const elements = (root) => {
  const result = [];
  const visit = (node) => React.Children.forEach(node, (el) => { if (React.isValidElement(el)) { result.push(el); visit(el.props.children); } });
  visit(root); return result;
};
const calendarExports = {};
vm.runInNewContext(compile('src/components/administration/ScheduleCalendar.tsx'), { exports: calendarExports, Date,
  require: (name) => name === 'react/jsx-runtime' ? jsx : name === 'react-native' ? { View: 'View', Text: 'Text', Pressable: 'Pressable' }
    : name.endsWith('/scheduling') ? scheduling : name.endsWith('/Button') ? { Button: 'Button' } : (() => { throw new Error(name); })() });
const baseProps = { month: '2026-11', today: '2026-10-30', generatedThrough: '2026-11-05', timeslots: [persisted[1]], previews: preview(),
  canCreate: false, busy: false, changeMonth: () => {}, selectDate: () => {} };
let selected;
const cells = elements(calendarExports.ScheduleCalendar({ ...baseProps, selectDate: (date) => { selected = date; } })).filter((el) => el.type === 'Pressable');
const cell = (date) => cells.find((el) => el.props.accessibilityLabel.startsWith(`${date},`)).props;
assert.match(cell('2026-11-06').className, /border-dashed/);
assert.match(cell('2026-11-06').accessibilityLabel, /0 timeslots, 1 recurring previews/);
assert.equal(cell('2026-11-06').disabled, false, 'View-only administrators may open previews');
cell('2026-11-06').onPress(); assert.equal(selected, '2026-11-06');
assert.match(cell('2026-11-03').className, /bg-indigo-50/);
assert.equal(cell('2026-11-04').disabled, true, 'View-only administrators cannot create on empty dates');
assert.equal(elements(calendarExports.ScheduleCalendar({ ...baseProps, busy: true })).filter((el) => el.type === 'Pressable').every((el) => el.props.disabled), true);
const mixed = elements(calendarExports.ScheduleCalendar({ ...baseProps, timeslots: [{ ...persisted[1], localSessionDate: '2026-11-06' }] }))
  .find((el) => el.type === 'Pressable' && el.props.accessibilityLabel.startsWith('2026-11-06,'));
assert.match(mixed.props.accessibilityLabel, /1 timeslots, 1 recurring previews/);
assert.match(mixed.props.className, /bg-indigo-50/);

// Exercise the production screen's loader, date selection and popup actions.
const screenExports = {}, hooks = [], routes = [], requests = [];
let cursor = 0, canEdit = true, resourceData;
let loader;
const react = { useState: (initial) => { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
  return [hooks[i], (next) => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }]; }, useCallback: (fn) => fn };
const service = { ...scheduling.schedulingService, list: async () => [friday, tuesday], timeslots: async (...args) => { requests.push(args); return [...persisted, ...exceptions]; } };
vm.runInNewContext(compile('src/components/administration/ScheduleScreen.tsx'), { exports: screenExports, Date, Promise,
  require: (name) => name === 'react' ? react : name === 'react/jsx-runtime' ? jsx : name === 'expo-router' ? { router: { push: (route) => routes.push(plain(route)) } }
    : name === 'react-native' ? { View: 'View', Text: 'Text', ScrollView: 'ScrollView', Switch: 'Switch' }
    : name.endsWith('/scheduling') ? { ...scheduling, schedulingService: service } : name.endsWith('/schedule-calendar') ? calendar
    : name.endsWith('/administration') ? { administrationService: { club: async () => club } }
    : name.endsWith('/api-auth') ? load('api-auth') : name.endsWith('/bookings') ? { today: () => '2026-10-30', dateLabel: (date) => date }
    : name.endsWith('/use-administration') ? { useAdministrationFocus: () => true, useAdministrationLifetime: () => () => true,
      useAdministration: () => ({ clubId: club.id, access: { permissions: { adminSchedules: { edit: canEdit, delete: canEdit } } } }),
      useAdministrationResource: (load) => { loader = load; return { data: resourceData, loading: false, refreshing: false, refresh: async () => {} }; } }
    : name.endsWith('/use-confirmation') ? { useConfirmation: () => ({ confirm: async () => true }) }
    : name === './ScheduleCalendar' ? { ScheduleCalendar: 'Calendar' } : name === './ScheduleControls' ? { ScheduleModal: 'Modal' }
    : name === './AdminPage' ? { AdminPage: 'Page', Message: 'Message' } : name.endsWith('/SurfaceTile') ? { SurfaceTile: 'Tile' }
    : name.endsWith('/Button') ? { Button: 'Button' } : (() => { throw new Error(name); })() });
const render = () => { cursor = 0; return elements(screenExports.default()); };
const find = (nodes, type) => nodes.find((el) => el.type === type).props;
(async () => {
  render();
  resourceData = await loader();
  assert.deepEqual(requests[0], [club.id, '2026-10-01', '2026-10-31', true], 'The real loader requests closed exceptions too');
  find(render(), 'Calendar').changeMonth('2026-11');
  render(); resourceData = await loader();
  assert.deepEqual(requests.at(-1), [club.id, '2026-11-01', '2026-11-30', true]);
  let nodes = render();
  assert.equal(find(nodes, 'Calendar').timeslots.some((slot) => slot.closedAtUtc), false, 'Closed sessions never become solid highlights');
  find(nodes, 'Calendar').selectDate('2026-11-20');
  let popup = elements(find(render(), 'Modal').children);
  assert.equal(find(render(), 'Modal').visible, true);
  assert.equal(popup.filter((el) => el.type === 'Button').length, 1, 'A preview has only recurring-rule editing');
  assert.equal(find(popup, 'Button').children, 'Edit Recurring Timeslot');
  find(popup, 'Button').onPress();
  assert.deepEqual(routes.at(-1), { pathname: '/admin/schedule/recurring', params: { id: friday.id } });
  assert.equal(find(render(), 'Modal').visible, false);
  canEdit = false;
  find(render(), 'Calendar').selectDate('2026-11-20');
  popup = elements(find(render(), 'Modal').children);
  assert.equal(popup.some((el) => el.type === 'Button'), false, 'View-only preview popups expose no mutation actions');
  console.log('Schedule calendar verified: reported dates, rolling horizon, inclusive bounds, DST/leap days, persisted exceptions, mixed counts, loader and preview navigation.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
