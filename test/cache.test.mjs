import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCache, swr } from '../src/shell/cache.js';

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('cache keeps the newest 40 entries', () => {
  const c = createCache(memory());
  for (let i = 0; i < 45; i++) c.set(`k${i}`, i);
  assert.equal(c.get('k0'), undefined);
  assert.equal(c.get('k44'), 44);
});

test('swr: fetches when empty, then serves stale and reports a changed revalidation', async () => {
  const c = createCache(memory());
  assert.deepEqual(await swr('a', async () => [1], null, c), [1]); // nothing cached: waits for the load
  let updated = null;
  const got = await swr('a', async () => [2], (v) => { updated = v; }, c);
  assert.deepEqual(got, [1]); // stale right away
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(updated, [2]);
  assert.deepEqual(c.get('a'), [2]);
  let again = false;
  await swr('a', async () => [2], () => { again = true; }, c);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(again, false); // unchanged: no redraw
});

test('swr: a failed revalidation keeps the cached copy', async () => {
  const c = createCache(memory());
  c.set('a', 'old');
  assert.equal(await swr('a', async () => { throw new Error('offline'); }, null, c), 'old');
});
