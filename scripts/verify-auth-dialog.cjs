// File: scripts/verify-auth-dialog.cjs
// Exercise popup events with controlled auth responses; no emails or credentials leave this process.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const jsx = require('react/jsx-runtime');
const ts = require('typescript');
const compile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const authModule = { exports: {} };
vm.runInNewContext(compile('src/data/auth.ts'), { exports: authModule.exports });
const { AuthError, ClubSelectionError } = authModule.exports;
const pending = () => { let resolve; let reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const resetMessage = 'An password reset has been sent to the email provided.';

const mount = (initialTab = 'sign-in') => {
  const hooks = [];
  const cleanups = [];
  let cursor = 0;
  let mounted = true;
  let lateUpdates = 0;
  let tree;
  let closed = 0;
  const navigation = [];
  const calls = { signIn: [], signUp: [], reset: [], resend: 0 };
  const auth = {
    flowEmail: '',
    signIn: async (...args) => { calls.signIn.push(args); },
    signUp: async (input) => { calls.signUp.push(input); auth.flowEmail = input.email; },
    requestPasswordReset: async (email) => { calls.reset.push(email); },
    resendConfirmation: async () => { calls.resend++; },
  };
  const dispose = () => { if (mounted) { cleanups.forEach((cleanup) => cleanup?.()); mounted = false; } };
  const reactHooks = {
    useState: (initial) => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], (next) => {
        if (!mounted) lateUpdates++;
        hooks[index] = typeof next === 'function' ? next(hooks[index]) : next;
      }];
    },
    useRef: (initial) => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect: (effect) => {
      const index = cursor++;
      if (!(index in hooks)) { hooks[index] = true; cleanups.push(effect()); }
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compile('src/components/auth/AuthDialog.tsx'), {
    exports: module.exports,
    require: (name) => {
      if (name === 'react') return reactHooks;
      if (name === 'react/jsx-runtime') return jsx;
      if (name === 'expo-router') return { router: { replace: (url) => navigation.push(url) } };
      if (name === 'react-native') return { Modal: 'Modal', View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'web' } };
      if (name === '@/data/auth') return authModule.exports;
      if (name === '@/hooks/use-auth') return { useAuth: () => auth };
      if (name === './AuthField') return { AuthField: 'AuthField' };
      if (name === '@/components/ui/Button') return { Button: 'Button' };
      if (name === '@/components/ui/Blur') return { BlurView: 'BlurView' };
      if (name === '@/components/ui/SafeAreaView') return { SafeAreaView: 'SafeAreaView' };
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  const render = () => {
    cursor = 0;
    tree = module.exports.AuthDialog({ initialTab, checkEmail: false, blurTarget: { current: null }, onClose: () => { closed++; dispose(); } });
    return tree;
  };
  const elements = () => {
    const all = [];
    const visit = (node) => React.Children.forEach(node, (child) => { if (React.isValidElement(child)) { all.push(child); visit(child.props.children); } });
    visit(tree);
    return all;
  };
  const find = (predicate) => { const result = elements().find(predicate); assert.ok(result, 'Expected popup control'); return result; };
  const field = (label) => find((element) => element.type === 'AuthField' && element.props.label === label).props;
  const button = (label) => find((element) => element.type === 'Button' && element.props.children === label).props;
  const change = (label, value) => { field(label).onChangeText(value); render(); };
  const switchTo = (label) => { find((element) => element.props.accessibilityRole === 'tab' && element.props.accessibilityLabel === label).props.onPress(); render(); };
  const press = (label) => { const promise = button(label).onPress(); render(); return promise; };
  const hasText = (text) => elements().some((element) => element.type === 'Text' && element.props.children === text);
  render();
  return { auth, calls, navigation, render, elements, field, button, change, switchTo, press, hasText, find, dispose, closed: () => closed, lateUpdates: () => lateUpdates };
};

(async () => {
  const d = mount();
  d.change('Email', 'member@example.com');
  d.change('Password', 'SecretPassword123!');
  d.switchTo('Register');
  assert.equal(d.field('Email').value, 'member@example.com');
  assert.equal(d.field('Password').value, '');
  for (const [label, value] of [['First Name', 'Alex'], ['Surname', 'Smith'], ['Display Name', 'Table Captain'], ['Password', 'SecretPassword123!'], ['Confirm Password', 'SecretPassword123!']]) d.change(label, value);
  d.switchTo('Sign In');
  assert.equal(d.field('Password').value, '');
  d.switchTo('Register');
  assert.equal(d.field('First Name').value, 'Alex');
  assert.equal(d.field('Surname').value, 'Smith');
  assert.equal(d.field('Display Name').value, 'Table Captain');
  assert.equal(d.field('Confirm Password').value, '');
  d.change('Password', 'SecretPassword123!');
  d.change('Confirm Password', 'SecretPassword123!');
  await d.press('Register');
  d.render();
  assert.equal(d.calls.signUp.length, 1);
  assert.equal(d.calls.signUp[0].displayName, 'Table Captain');
  assert.equal(d.field('Password').value, '');
  assert.equal(d.hasText('Check your email'), true);
  assert.equal(d.button('Sign In').disabled, false, 'Registration switches to Sign In');
  assert.deepEqual(d.navigation, [], 'Registration does not navigate to another page');
  await d.press('Resend confirmation');
  d.render();
  assert.equal(d.calls.resend, 1);

  const r = mount();
  await r.press('Reset password');
  r.render();
  assert.equal(r.field('Email').error, 'Please enter your Email address.');
  assert.equal(r.calls.reset.length, 0);
  r.change('Email', 'invalid');
  await r.press('Reset password');
  r.render();
  assert.equal(r.field('Email').error, 'Enter a valid email address.');
  const reset = pending();
  r.auth.requestPasswordReset = async (email) => { r.calls.reset.push(email); await reset.promise; };
  r.change('Email', 'member@example.com');
  const resetting = r.press('Reset password');
  assert.equal(r.hasText(resetMessage), false, 'Acknowledgement waits for API acceptance');
  assert.equal(r.button('Sign In').disabled, true);
  await r.press('Sending reset…');
  assert.equal(r.calls.reset.length, 1, 'Duplicate requests are suppressed');
  reset.resolve();
  await resetting;
  r.render();
  assert.equal(r.hasText(resetMessage), true);
  const all = r.elements();
  assert.ok(all.findIndex((element) => element.type === 'Text' && element.props.children === resetMessage) < all.findIndex((element) => element.type === 'Button' && element.props.children === 'Sign In'));
  assert.deepEqual(r.navigation, []);
  r.change('Email', 'other@example.com');
  assert.equal(r.hasText(resetMessage), false, 'Changing email clears the previous acknowledgement');
  r.auth.requestPasswordReset = async () => { throw new AuthError('network', 'Connection unavailable'); };
  r.render();
  await r.press('Reset password');
  r.render();
  assert.equal(r.hasText('Connection unavailable'), true);
  assert.equal(r.hasText(resetMessage), false);

  d.change('Password', 'SecretPassword123!');
  await d.press('Sign In');
  assert.equal(d.closed(), 1);
  assert.deepEqual(d.navigation, ['/']);
  assert.equal(d.lateUpdates(), 0, 'Closing after sign-in does not update an unmounted form');

  for (const label of ['Close authentication popup', 'Dismiss authentication popup']) {
    const dismissed = mount();
    dismissed.find((element) => element.props.accessibilityLabel === label).props.onPress();
    assert.equal(dismissed.closed(), 1);
  }
  const back = mount();
  back.find((element) => element.type === 'Modal').props.onRequestClose();
  assert.equal(back.closed(), 1, 'Native Back / web Escape use the dismissal handler');
  const late = mount('register');
  for (const [label, value] of [['Email', 'member@example.com'], ['First Name', 'Alex'], ['Surname', 'Smith'], ['Display Name', 'Table Captain'], ['Password', 'SecretPassword123!'], ['Confirm Password', 'SecretPassword123!']]) late.change(label, value);
  const registration = pending();
  late.auth.signUp = () => registration.promise;
  late.render();
  const registering = late.press('Register');
  late.find((element) => element.props.accessibilityLabel === 'Close authentication popup').props.onPress();
  registration.resolve();
  await registering;
  assert.equal(late.lateUpdates(), 0, 'A dismissed request cannot change or reopen the popup');
  assert.deepEqual(late.navigation, []);
  const clubs = mount();
  clubs.change('Email', 'member@example.com');
  clubs.change('Password', 'SecretPassword123!');
  const clubId = '61af7d36-2b80-4c9f-a314-000000000010';
  clubs.auth.signIn = async (...args) => {
    clubs.calls.signIn.push(args);
    if (!args[2]) throw new ClubSelectionError([{ id: clubId, name: 'Test Club' }]);
  };
  clubs.render();
  await clubs.press('Sign In');
  clubs.render();
  assert.equal(clubs.hasText('Choose your club'), true);
  await clubs.press('Test Club');
  await clubs.press('Sign In');
  assert.equal(clubs.calls.signIn.at(-1)[2], clubId);
  assert.equal(clubs.closed(), 1, 'Selecting a membership completes sign-in');

  console.log('Auth popup checks passed: tabs, preserved fields, registration, email requests, duplicate suppression, sign-in, club selection, dismissal and outstanding-request cleanup.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
