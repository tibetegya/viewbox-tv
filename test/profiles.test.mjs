import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCode, sameCode, activeProfile, addProfile, updateProfile, removeProfile, migrate, hashPin, checkPin, MAX_PROFILES, initialOf } from '../src/shell/profiles.js';

test('sync codes match across formats', () => {
  assert.equal(formatCode('abcd1234x'), 'ABCD-1234-X');
  assert.ok(sameCode('ABCD1234X', 'abcd-1234-x'));
  assert.ok(!sameCode('ABCD1234X', ''));
  const list = [{ id: '1', name: 'A', code: 'ABCD-1234-X' }, { id: '2', name: 'B', code: 'WXYZ-5678-Q' }];
  assert.equal(activeProfile(list, 'WXYZ5678Q').name, 'B');
  assert.equal(activeProfile(list, null), null);
});

test('add / update / remove profiles', () => {
  let list = addProfile([], { name: '  Anna  ', code: 'abcd1234x' }, 'a');
  assert.deepEqual(list[0], { id: 'a', name: 'Anna', color: '#1E88E5', code: 'ABCD-1234-X' });
  assert.throws(() => addProfile(list, { name: 'Dup', code: 'ABCD-1234-X' }, 'b'), /already uses/);
  list = addProfile(list, { name: 'Ben', code: 'WXYZ5678Q' }, 'b');
  assert.throws(() => updateProfile(list, 'b', { code: 'abcd1234x' }), /already uses/);
  list = updateProfile(list, 'b', { name: 'Benji', pinHash: 'h' });
  assert.equal(list[1].name, 'Benji');
  assert.equal(list[1].pinHash, 'h');
  list = updateProfile(list, 'b', { pinHash: null });
  assert.equal('pinHash' in list[1], false);
  assert.deepEqual(removeProfile(list, 'a').map((p) => p.id), ['b']);
  let full = [];
  for (let i = 0; i < MAX_PROFILES; i++) full = addProfile(full, { name: `P${i}`, code: `AAAA000${i}A` }, String(i));
  assert.throws(() => addProfile(full, { name: 'X', code: 'ZZZZ0000Z' }), /Up to/);
  assert.equal(initialOf(' anna'), 'A');
});

test('migration: the active code becomes Profile 1; nothing to do otherwise', () => {
  assert.deepEqual(migrate([], 'ABCD1234X'), [{ id: '1', name: 'Profile 1', color: '#1E88E5', code: 'ABCD-1234-X' }]);
  assert.deepEqual(migrate([], ''), []);
  const existing = [{ id: 'x', name: 'X', code: 'WXYZ-5678-Q' }];
  assert.equal(migrate(existing, 'ABCD1234X'), existing);
});

test('PIN check', async () => {
  const p = { id: 'a', pinHash: await hashPin('a', '1234') };
  assert.ok(await checkPin(p, '1234'));
  assert.ok(!(await checkPin(p, '0000')));
  assert.ok(await checkPin({ id: 'b' }, '')); // no PIN set
});
