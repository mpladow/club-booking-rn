// File: scripts/verify-bookings.cjs
// Exercises the repository's SQL against SQLite without a native simulator.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const sqlite = new DatabaseSync(':memory:');
const adapter = {
  execAsync: async (sql) => sqlite.exec(sql),
  runAsync: async (sql, ...params) => sqlite.prepare(sql).run(...params),
  getFirstAsync: async (sql, ...params) => sqlite.prepare(sql).get(...params),
  getAllAsync: async (sql, ...params) => sqlite.prepare(sql).all(...params),
  withTransactionAsync: async (action) => {
    sqlite.exec('BEGIN');
    try { await action(); sqlite.exec('COMMIT'); }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  },
};
const load = () => {
  const source = ts.transpileModule(fs.readFileSync('src/data/bookings.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: () => ({ openDatabaseAsync: async () => adapter }), Intl, Date, Map });
  return exports;
};
(async () => {
  const api = load();
  const first = await api.bookingsRepository.list();
  assert.equal(first.length, 1, 'Only the current user seed is listed');
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM mock_bookings').get().count, 2);
  const booking = { ...first[0], id: 'test-save', game: "Player's game", createdAt: '2099-01-01T00:00:00Z', status: 'pending' };
  assert.equal(api.validDraft(booking), true, 'Today is bookable');
  assert.equal(api.validDraft({ ...booking, game: '' }), true, 'Game is optional');
  assert.equal(api.validDraft({ ...booking, game: 'x'.repeat(50) }), true);
  assert.equal(api.validDraft({ ...booking, game: 'x'.repeat(51) }), false);
  assert.equal(api.validDraft({ ...booking, date: '2000-01-01' }), false);
  assert.equal(api.validDraft({ ...booking, table: 5 }), false);
  await api.bookingsRepository.create(booking);
  await api.bookingsRepository.create({ ...booking, id: 'past', date: '2000-01-01' });
  const reloaded = await load().bookingsRepository.list();
  assert.equal(reloaded.length, 2, 'Reload excludes past bookings and does not reseed');
  assert.equal(reloaded[0].id, booking.id, 'Newest first');
  assert.equal(reloaded[0].game, booking.game, 'Bound SQL preserves apostrophes');
  assert.equal(reloaded[0].status, 'confirmed', 'Only confirmed state is persisted');
  assert.equal(sqlite.prepare('PRAGMA user_version').get().user_version, 1);
  sqlite.close();
  console.log('Booking repository checks passed: seeding, ownership, dates, validation, ordering, persistence, SQL binding, migration version.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
