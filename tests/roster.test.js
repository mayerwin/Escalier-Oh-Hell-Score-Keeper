import assert from 'node:assert/strict';
import test from 'node:test';

import * as R from '../src/roster.js';

test('sanitize drops what cannot be a player and keeps the order', () => {
  const list = R.sanitize([
    { name: '  Ana  ', always: true },
    null,
    { name: '' },
    'Ben',
    { name: 'Ben', always: 'yes' },
    { name: 'ana' }, // same person, different spelling
  ]);
  assert.deepEqual(list, [
    { name: 'Ana', always: true },
    { name: 'Ben', always: false },
  ]);
});

test('sanitize survives anything that is not a list', () => {
  for (const raw of [null, undefined, 'Ana', 42, { name: 'Ana' }]) {
    assert.deepEqual(R.sanitize(raw), []);
  }
});

test('a name is matched regardless of accents, case and spacing', () => {
  assert.equal(R.key('Cléo'), R.key('  CLEO '));
  assert.equal(R.key('Jean  Marc'), R.key('jean marc'));
});

test('adding a name that is already known changes nothing', () => {
  const list = R.add(R.add([], 'Ana'), 'ANA');
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Ana', 'the first spelling is the one kept');
});

test('learning from a game never promotes anyone to a regular', () => {
  const before = [{ name: 'Ana', always: true }];
  const after = R.learn(before, ['Ana', 'Ben', 'Cleo']);
  assert.deepEqual(
    after.map((e) => [e.name, e.always]),
    [
      ['Ana', true],
      ['Ben', false],
      ['Cleo', false],
    ]
  );
});

test('regulars come back in roster order, not in the order they were added', () => {
  const list = [
    { name: 'Ana', always: false },
    { name: 'Ben', always: true },
    { name: 'Cleo', always: true },
  ];
  assert.deepEqual(
    R.regulars(list).map((e) => e.name),
    ['Ben', 'Cleo']
  );
});

test('renaming is refused when it would empty or duplicate a name', () => {
  const list = [
    { name: 'Ana', always: false },
    { name: 'Ben', always: false },
  ];
  assert.equal(R.rename(list, 1, 'ana').ok, false);
  assert.deepEqual(R.rename(list, 1, 'ana').list, list, 'the roster is unchanged');
  assert.equal(R.rename(list, 1, '   ').ok, false, 'emptying a name is what delete is for');

  const renamed = R.rename(list, 1, 'Benoit');
  assert.equal(renamed.ok, true);
  assert.equal(renamed.list[1].name, 'Benoit');
  assert.equal(R.rename(list, 9, 'Nobody').ok, false, 'an index off the end is a no-op');
});

test('a name is capped rather than truncating the roster', () => {
  const long = 'x'.repeat(R.MAX_NAME + 20);
  assert.equal(R.add([], long)[0].name.length, R.MAX_NAME);
});

test('the roster stops growing at its ceiling', () => {
  let list = [];
  for (let i = 0; i < R.MAX_ROSTER + 5; i += 1) list = R.add(list, `P${i}`);
  assert.equal(list.length, R.MAX_ROSTER);
});

test('moving a name puts it where it was dropped', () => {
  const list = [{ name: 'A' }, { name: 'B' }, { name: 'C' }].map((e) => ({ ...e, always: false }));
  assert.deepEqual(
    R.move(list, 0, 2).map((e) => e.name),
    ['B', 'C', 'A']
  );
  assert.deepEqual(R.move(list, 0, 0), R.sanitize(list), 'a move to the same slot is a no-op');
  assert.deepEqual(R.move(list, -1, 2), R.sanitize(list));
});

test('suggestions prefer a prefix, then roster order', () => {
  const list = R.sanitize([{ name: 'Bernard' }, { name: 'Ana' }, { name: 'Anabel' }, { name: 'Susana' }]);
  assert.deepEqual(
    R.suggest(list, 'ana').map((e) => e.name),
    ['Ana', 'Anabel', 'Susana']
  );
});

test('suggestions never offer somebody already at the table', () => {
  const list = R.sanitize([{ name: 'Ana' }, { name: 'Anabel' }]);
  assert.deepEqual(
    R.suggest(list, 'ana', ['ANA']).map((e) => e.name),
    ['Anabel']
  );
});

test('a name that is already typed in full is not suggested back', () => {
  const list = R.sanitize([{ name: 'Ana' }, { name: 'Ben' }]);
  assert.deepEqual(R.suggest(list, 'Ana'), [], 'nothing left to complete');
  assert.equal(R.suggest(list, 'An').length, 1, 'still a real completion');
});

test('an empty query offers the whole roster, capped', () => {
  const list = R.sanitize(Array.from({ length: 10 }, (_, i) => ({ name: `P${i}` })));
  assert.equal(R.suggest(list, '').length, 6);
  assert.equal(R.suggest(list, '', [], 3).length, 3);
});
