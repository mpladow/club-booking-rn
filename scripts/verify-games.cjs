// File: scripts/verify-games.cjs
// Check catalogue responses and dropdown interactions without a device or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const ts = require('typescript');
const compile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const selection = {};
vm.runInNewContext(compile('src/data/game-selection.ts'), { exports: selection });
const { OTHER_GAME_ID, gameSelectionError } = selection;
const catalogue = [
  { id: OTHER_GAME_ID, name: 'Other', ordering: 0 },
  { id: '61af7d36-2b80-4c9f-a314-000000000002', name: 'Bolt Action', ordering: 2 },
  { id: '61af7d36-2b80-4c9f-a314-000000000001', name: 'Warhammer 40000', ordering: 1 },
];
let response = catalogue;
const api = {};
vm.runInNewContext(compile('src/data/games.ts'), {
  exports: api,
  require: (name) => name === './game-selection' ? selection : { authService: { get: async (path) => {
    assert.equal(path, '/games'); return response;
  } } },
});

const mount = (loadGames) => {
  const hooks = [];
  const effects = [];
  let cursor = 0;
  let tree;
  let value = { gameId: '', game: '', otherGameName: '' };
  const component = {};
  vm.runInNewContext(compile('src/components/game-select.tsx'), {
    exports: component,
    require: (name) => {
      if (name === 'react/jsx-runtime') return require('react/jsx-runtime');
      if (name === 'react') return {
        useState: (initial) => {
          const i = cursor++;
          if (!(i in hooks)) hooks[i] = initial;
          return [hooks[i], (next) => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }];
        },
        useEffect: (effect, deps) => {
          const i = cursor++;
          if (!hooks[i] || deps.some((dep, index) => dep !== hooks[i].deps[index])) {
            hooks[i]?.cleanup?.();
            hooks[i] = { deps };
            effects.push(() => { hooks[i].cleanup = effect(); });
          }
        },
      };
      if (name === 'react-native') return { Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View' };
      if (name === '@/components/ui/Button') return { Button: 'Button' };
      if (name === '@/data/game-selection') return selection;
      if (name === '@/data/games') return { loadGames };
      throw new Error(name);
    },
  });
  const render = () => {
    cursor = 0;
    tree = component.GameSelect({ value, onChange: (next) => { value = next; } });
    effects.splice(0).forEach((effect) => effect());
  };
  const elements = () => {
    const all = [];
    const visit = (node) => React.Children.forEach(node, (child) => {
      if (React.isValidElement(child)) { all.push(child); visit(child.props.children); }
    });
    visit(tree);
    return all;
  };
  const find = (predicate) => { const result = elements().find(predicate); assert.ok(result, 'Expected game control'); return result.props; };
  const open = () => { find((el) => el.props.accessibilityHint === 'Opens the game dropdown').onPress(); render(); };
  const choose = (name) => { find((el) => el.props.accessibilityRole === 'radio' && el.props.accessibilityLabel === name).onPress(); render(); };
  const flush = async () => { await new Promise(setImmediate); render(); };
  render();
  return { render, elements, find, open, choose, flush, value: () => value,
    dispose: () => hooks.forEach((hook) => hook?.cleanup?.()) };
};

(async () => {
  const games = await api.loadGames();
  assert.deepEqual(Array.from(games, (game) => game.name), ['Warhammer 40000', 'Bolt Action', 'Other']);
  for (response of [null, [], {}, [{ id: 'broken', name: 'Other', ordering: 1 }], [{ ...catalogue[0], ordering: '1' }]])
    await assert.rejects(api.loadGames(), /unavailable/);
  response = catalogue;
  const d = mount(api.loadGames);
  assert.equal(d.find((el) => el.props.accessibilityHint).disabled, true, 'Loading disables selection');
  await d.flush();
  assert.equal(d.elements().some((el) => el.type === 'TextInput'), false);
  assert.equal(gameSelectionError(d.value()), 'Choose a game.');
  d.open();
  d.choose('Other');
  assert.equal(d.elements().some((el) => el.props.accessibilityRole === 'radio'), false, 'Selection closes dropdown');
  assert.equal(gameSelectionError(d.value()), 'Enter your game name.');
  const input = d.find((el) => el.type === 'TextInput');
  assert.equal(input.maxLength, 200);
  input.onChangeText('   ');
  d.render();
  assert.equal(gameSelectionError(d.value()), 'Enter your game name.');
  d.find((el) => el.type === 'TextInput').onChangeText("  Player's custom game  ");
  d.render();
  assert.equal(d.value().game, "Player's custom game", 'Confirmation uses trimmed display name');
  assert.equal(gameSelectionError(d.value()), null);
  d.render();
  assert.equal(d.find((el) => el.type === 'TextInput').value, "  Player's custom game  ");
  d.open();
  d.choose('Bolt Action');
  assert.equal(d.value().gameId, catalogue[1].id);
  assert.equal(d.value().game, 'Bolt Action');
  assert.equal(d.value().otherGameName, '', 'Switching to catalogue clears custom name');
  assert.equal(d.elements().some((el) => el.type === 'TextInput'), false);
  assert.equal(gameSelectionError(d.value()), null);
  let fail = true;
  const retry = mount(async () => { if (fail) throw new Error('Offline'); return games; });
  await retry.flush();
  assert.equal(retry.elements().some((el) => el.props.accessibilityRole === 'alert'), true);
  fail = false;
  retry.find((el) => el.type === 'Button').onPress();
  retry.render();
  await retry.flush();
  assert.equal(retry.elements().some((el) => el.props.accessibilityRole === 'alert'), false);
  retry.open();
  retry.choose('Other');
  assert.equal(retry.value().gameId, OTHER_GAME_ID);
  d.dispose(); retry.dispose();
  console.log('Game checks passed: API shape/order, required selection, Other text/limits, display name, selection changes, loading and retry.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
