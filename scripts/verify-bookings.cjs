// File: scripts/verify-bookings.cjs
// Verify the HTTP booking contract with a controlled service; no live bookings are created.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = (name) => ts.transpileModule(fs.readFileSync(`src/data/${name}.ts`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const selection = {};
vm.runInNewContext(compile('game-selection'), { exports: selection });
const exportsValue = {};
vm.runInNewContext(compile('bookings'), { exports: exportsValue, Intl, Date, Map, Error,
  require: (name) => name === './game-selection' ? selection : { authService: {} } });
const { createBookingsService, createRequestId, validDraft, processingBooking, bookingDate, bookingErrorMessage } = exportsValue;
const id = (last) => `61af7d36-2b80-4c9f-a314-${String(last).padStart(12, '0')}`;
const clubId = id(10);
const slot = { id: id(11), date: '2099-01-01', startsAtUtc: '2098-12-31T23:00:00Z', endsAtUtc: '2099-01-01T05:00:00Z' };
const table = { id: id(12), name: 'Table 12', size: 'large' };
const draft = { requestId: createRequestId(), timeslotId: slot.id, tableId: table.id, table: table.name, date: slot.date,
  startsAtUtc: slot.startsAtUtc, endsAtUtc: slot.endsAtUtc, gameId: selection.OTHER_GAME_ID, game: "Player's game",
  otherGameName: "  Player's game  ", spectators: true, demo: true };
const booking = { id: id(13), requestId: draft.requestId, timeslotId: slot.id, tableId: table.id, tableName: table.name,
  gameId: draft.gameId, gameName: draft.game, spectators: true, demoGame: true, status: 'Pending', failureCode: null, canRetry: false,
  startsAtUtc: slot.startsAtUtc, endsAtUtc: slot.endsAtUtc };
const calls = [];
let reply = booking;
let fail = false;
const service = createBookingsService({
  get: async (path) => {
    calls.push({ path, method: 'GET' });
    if (path === `/clubs/${clubId}`) return { id: clubId, name: 'Test Club', timeZoneId: 'Australia/Sydney' };
    if (path.endsWith('/timeslots')) return [slot];
    if (path.endsWith('/tables')) return [table];
    if (path.endsWith(`/bookings/${booking.id}`)) return reply;
    if (path.endsWith('/bookings')) return reply.status === 'Rejected' ? [] : [reply];
    throw new Error(`Unexpected path ${path}`);
  },
  post: async (path, body) => {
    calls.push({ path, method: 'POST', body });
    if (fail) { fail = false; throw new Error('Connection lost'); }
    return reply;
  },
});
(async () => {
  assert.match(draft.requestId, /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/);
  assert.equal(validDraft(draft), true);
  for (const patch of [{ timeslotId: '' }, { tableId: '1' }, { requestId: '' }, { gameId: '' }, { otherGameName: ' ' }, { otherGameName: 'x'.repeat(201) }])
    assert.equal(validDraft({ ...draft, ...patch }), false);
  assert.equal(validDraft({ ...draft, otherGameName: 'x'.repeat(200) }), true);
  assert.equal((await service.club(clubId)).timeZoneId, 'Australia/Sydney');
  assert.equal((await service.timeslots(clubId))[0].id, slot.id);
  assert.equal((await service.tables(clubId, slot.id))[0].id, table.id);
  const saved = await service.create(clubId, draft);
  assert.equal(saved.status, 'Pending', 'A 202 response never becomes simulated confirmation');
  assert.equal(processingBooking(saved), true);
  const command = calls.at(-1);
  assert.equal(command.path, `/clubs/${clubId}/bookings`);
  assert.equal(command.method, 'POST');
  assert.deepEqual(JSON.parse(JSON.stringify(command.body)), {
    requestId: draft.requestId, timeslotId: slot.id, tableId: table.id, gameId: selection.OTHER_GAME_ID,
    otherGameName: "Player's game", spectators: true, demoGame: true,
  });
  assert.equal((await service.list(clubId))[0].id, saved.id, 'Reload uses server bookings');
  assert.equal(bookingDate(saved, 'Australia/Sydney'), '2099-01-01', 'Date uses club timezone');
  fail = true;
  await assert.rejects(service.create(clubId, draft), /Connection lost/);
  await service.create(clubId, draft);
  assert.equal(calls.at(-1).body.requestId, calls.at(-2).body.requestId, 'Transport retries reuse the command UUID');
  await service.create(clubId, { ...draft, gameId: id(1), game: 'Warhammer 40000', otherGameName: '' });
  assert.equal('otherGameName' in calls.at(-1).body, false, 'Catalogue requests omit Other text');
  reply = { ...booking, status: 'Confirmed' };
  assert.equal((await service.get(clubId, saved.id)).status, 'Confirmed');
  assert.equal(processingBooking(reply), false);
  reply = { ...booking, status: 'Rejected', failureCode: 'ProcessingTimeout', canRetry: true };
  assert.equal((await service.list(clubId)).length, 0);
  assert.equal((await service.get(clubId, saved.id)).failureCode, 'ProcessingTimeout', 'Poll details for terminal outcomes excluded from active lists');
  const before = calls.length;
  await assert.rejects(service.list(''), /No club/);
  await assert.rejects(service.create(clubId, { ...draft, tableId: '1' }), /Check/);
  assert.equal(calls.length, before, 'Invalid routing/selection never contacts the API');
  reply = {};
  await assert.rejects(service.get(clubId, saved.id), /invalid booking/);
  assert.match(bookingErrorMessage({ serverCode: 'TableUnavailable' }), /another table/);
  console.log('Booking API checks passed: club routing, live option IDs, exact POST contract, Other names, stable retry UUID, server reload/statuses, validation and conflicts.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
