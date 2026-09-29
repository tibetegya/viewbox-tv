import { test } from 'node:test';
import assert from 'node:assert/strict';
import { semverGt, updateStatus } from '../src/shell/version.js';

test('semverGt', () => {
  assert.ok(semverGt('0.7.1', '0.7.0'));
  assert.ok(semverGt('v1.0.0', '0.9.9'));
  assert.ok(semverGt('0.10.0', '0.9.0'));
  assert.ok(!semverGt('0.7.0', '0.7.0'));
  assert.ok(!semverGt('0.6.9', 'v0.7.0'));
});

test('updateStatus: hot update vs reinstall', () => {
  assert.deepEqual(updateStatus('0.7.0', { version: '0.7.0', viewboxService: 1 }, 1), { available: false, needsReinstall: false });
  assert.deepEqual(updateStatus('0.7.0', { version: '0.7.1', viewboxService: 1 }, 1), { available: true, needsReinstall: false });
  assert.deepEqual(updateStatus('0.7.0', { version: '0.8.0', viewboxService: 2 }, 1), { available: true, needsReinstall: true });
  assert.deepEqual(updateStatus('0.7.0', { version: '0.7.1' }, 1), { available: true, needsReinstall: false });
  assert.deepEqual(updateStatus('0.7.0', null, 1), { available: false, needsReinstall: false });
});
