// File: scripts/verify-auth.cjs
// Exercises the mock service with persistent storage and a Node crypto adapter.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash, randomUUID } = require('node:crypto');
const ts = require('typescript');

const modules = new Map();
const load = (name) => {
  if (modules.has(name)) return modules.get(name);
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(`src/data/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: (path) => load(path.slice(2)), Date, Promise, setTimeout });
  modules.set(name, exports);
  return exports;
};

(async () => {
  const { passwordError, emailError, validateSignUp, AuthError } = load('auth');
  const { createMockAuthService } = load('mock-auth');
  let saved = null;
  let clock = Date.now();
  let writesFail = false;
  const options = {
    storage: {
      read: async () => saved,
      write: async (value) => { if (writesFail) throw new Error('Storage unavailable'); saved = value; },
    },
    passwords: {
      salt: randomUUID,
      hash: async (password, salt) => createHash('sha256').update(`${salt}:${password}`).digest('hex'),
    },
    now: () => clock,
    delay: async () => {},
  };
  let service = createMockAuthService(options);
  const input = { email: ' Member@Example.com ', firstName: ' Alex ', surname: ' Smith ', displayName: ' Table Captain ', password: 'Lowercase123!', passwordConfirmation: 'Lowercase123!' };
  assert.equal(passwordError(input.password), undefined);
  assert.ok(passwordError('lowercase123!'), 'An uppercase letter is required');
  assert.ok(passwordError('UPPERCASE123!'), 'A lowercase letter is required');
  assert.ok(passwordError('12345678901!'), 'Letters are required');
  assert.ok(passwordError('Long-password!'), 'A number is required');
  assert.ok(passwordError('Longpassword123'), 'A symbol is required');
  assert.ok(passwordError('Longpassword123 '), 'Whitespace is not a symbol');
  assert.ok(passwordError('short123!'));
  assert.equal(passwordError('A' + 'a'.repeat(125) + '1!'), undefined);
  assert.ok(passwordError('A' + 'a'.repeat(126) + '1!'));
  assert.ok(emailError('no-at-sign'));
  assert.ok(validateSignUp({ ...input, firstName: ' ', passwordConfirmation: 'different' }).firstName);
  assert.ok(validateSignUp({ ...input, passwordConfirmation: 'different' }).passwordConfirmation);
  assert.deepEqual(Object.keys(validateSignUp(input)), [], 'Complete signup details are valid');
  assert.ok(validateSignUp({ ...input, displayName: ' ' }).displayName, 'Display name is required');
  assert.equal(validateSignUp({ ...input, displayName: 'd'.repeat(200) }).displayName, undefined);
  assert.ok(validateSignUp({ ...input, displayName: 'd'.repeat(201) }).displayName, 'Display name is capped at 200 characters');
  assert.equal(await service.restoreSession(), null);
  await service.signUp(input);
  assert.equal(saved.includes(input.password), false, 'Raw passwords are never persisted');
  assert.equal(saved.includes('passwordConfirmation'), false);
  assert.equal(await service.restoreSession(), null, 'Registration does not sign in automatically');
  await assert.rejects(service.signUp({ ...input, email: 'member@example.com' }), (error) => error instanceof AuthError && error.code === 'email-exists');
  const firstUser = await service.signIn('MEMBER@example.com', input.password);
  assert.equal(firstUser.displayName, 'Table Captain', 'The submitted display name is trimmed and kept separate from first name and surname');
  assert.equal(firstUser.email, 'member@example.com');
  service = createMockAuthService(options);
  assert.equal((await service.restoreSession()).id, firstUser.id, 'Session survives service recreation');
  await service.signOut();
  assert.equal(await createMockAuthService(options).restoreSession(), null, 'Sign-out persists');
  for (let attempt = 1; attempt <= 4; attempt++) {
    await assert.rejects(service.signIn('member@example.com', 'wrong'), (error) => error.code === 'invalid-credentials' && error.attemptsRemaining === 5 - attempt && error.message === 'Email or password is incorrect.');
  }
  service = createMockAuthService(options);
  await assert.rejects(service.signIn('member@example.com', 'wrong'), (error) => error.code === 'reset-required');
  clock += 24 * 60 * 60 * 1000;
  await assert.rejects(service.signIn('member@example.com', input.password), (error) => error.code === 'reset-required', 'Waiting cannot remove the mandatory reset');
  assert.equal(await service.requestPasswordReset('member@example.com'), undefined);
  assert.equal(await service.requestPasswordReset('unknown@example.com'), undefined, 'Known and unknown reset requests have the same result');
  await assert.rejects(service.signIn('member@example.com', input.password), (error) => error.code === 'reset-required', 'Requesting a reset does not unlock the account');
  await service.resendConfirmation('member@example.com');
  await service.resendConfirmation('unknown@example.com');
  await assert.rejects(service.requestPasswordReset('invalid'), (error) => error.code === 'validation');
  const second = { ...input, email: 'other@example.com' };
  await service.signUp(second);
  const secondUser = await service.signIn(second.email, second.password);
  assert.notEqual(secondUser.id, firstUser.id);
  clock += 8 * 24 * 60 * 60 * 1000;
  assert.equal(await service.restoreSession(), null, 'Expired sessions are discarded');
  writesFail = true;
  await assert.rejects(service.signIn(second.email, 'wrong'), /Storage unavailable/);
  writesFail = false;
  await assert.rejects(service.signIn(second.email, 'wrong'), (error) => error.attemptsRemaining === 4, 'Storage failures do not consume a password attempt');
  await service.signIn(second.email, second.password);
  await service.signOut();
  const attempts = await Promise.allSettled(Array.from({ length: 5 }, () => service.signIn(second.email, 'wrong')));
  assert.equal(attempts.filter((result) => result.reason?.code === 'reset-required').length, 1, 'Concurrent failures are counted once each');
  assert.equal(JSON.parse(saved).attempts.find((entry) => entry.email === second.email).count, 5);
  assert.equal(typeof service.confirmAccount, 'undefined', 'Email-link implementation remains blocked');
  assert.equal(typeof service.resetPassword, 'undefined', 'Reset completion remains blocked');
  console.log('Auth checks passed: validation, normalized names/email, password privacy, account/session persistence, sign-out, expiry, five-attempt lockout, generic email responses, storage errors and concurrent attempts.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
