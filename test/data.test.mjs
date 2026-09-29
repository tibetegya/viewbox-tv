import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePos, continueWatching, nextUp, backdropFromHtml } from '../src/shell/data.js';

test('parsePos reads episode and movie positions', () => {
  assert.deepEqual(parsePos('pos:78346:1:1', '21:1802:1790649158'), { pid: '78346', pos: 21, dur: 1802, ts: 1790649158000, pct: 21 / 1802, type: 'tv', season: 1, episode: 1 });
  assert.equal(parsePos('pos:22383370', '17:5476:1790677047').type, 'movie');
  assert.equal(parsePos('pos:1', 'garbage'), null);
  assert.equal(parsePos('bm:t:1', '1|'), null);
});

const e = (pid, season, episode, pct, ts, type = 'tv') => ({ pid, season, episode, pct, ts, type });

test('continueWatching: in progress only, newest first, one per show', () => {
  const list = continueWatching([e('a', 1, 1, 0.5, 1), e('a', 1, 2, 0.3, 5), e('b', 1, 1, 0.95, 9), e('c', 2, 3, 0.04, 8), e('m', null, null, 0.4, 3, 'movie')]);
  assert.deepEqual(list.map((x) => `${x.pid}:${x.episode}`), ['a:2', 'm:null']);
});

test('nextUp: next episode after a finished latest one, across seasons', () => {
  const eps = { s: [{ season: 1, episode: 1 }, { season: 1, episode: 2 }, { season: 2, episode: 1 }], t: [{ season: 1, episode: 1 }] };
  const out = nextUp([e('s', 1, 2, 0.97, 10), e('s', 1, 1, 1, 2), e('t', 1, 1, 0.99, 5), e('u', 1, 1, 0.5, 7)], eps);
  assert.deepEqual(out.map((x) => `${x.pid} S${x.season}E${x.episode}`), ['s S2E1']); // t has no next; u not finished
});

test('backdropFromHtml finds the page background image', () => {
  assert.equal(backdropFromHtml('<style>body {background-image: linear-gradient(x), url("https://img.xcdn.to/t/p/w1280/x4lxFIhhrDI4nWtV8osnYwbGESV.jpg");'), 'x4lxFIhhrDI4nWtV8osnYwbGESV.jpg');
  assert.equal(backdropFromHtml('<html></html>'), null);
});

import { formatCode, validCode } from '../src/shell/profiles.js';
test('sync code formatting and validation', () => {
  assert.equal(formatCode('abcd1234x'), 'ABCD-1234-X');
  assert.equal(formatCode('ABCD-1234-X'), 'ABCD-1234-X');
  assert.equal(formatCode(' ab cd'), 'ABCD');
  assert.ok(validCode('ABCD-1234-X'));
  assert.ok(!validCode('ABCD-1234'));
});

import { progressIndex, progressOf } from '../src/shell/data.js';
test('progressIndex: movies, shows (latest episode) and episodes, 5–90 % only', () => {
  const idx = progressIndex([
    { type: 'movie', pid: 'm1', pct: 0.4, ts: 1 }, { type: 'movie', pid: 'm2', pct: 0.95, ts: 1 },
    { type: 'tv', pid: 's1', season: 1, episode: 1, pct: 1, ts: 1 }, { type: 'tv', pid: 's1', season: 1, episode: 2, pct: 0.3, ts: 2 },
    { type: 'tv', pid: 's2', season: 2, episode: 5, pct: 0.5, ts: 1 }, { type: 'tv', pid: 's2', season: 2, episode: 6, pct: 0.99, ts: 3 },
  ]);
  assert.equal(progressOf(idx, { type: 'movie', pid: 'm1' }), 0.4);
  assert.equal(progressOf(idx, { type: 'movie', pid: 'm2' }), 0); // finished → no bar
  assert.equal(progressOf(idx, { type: 'tv', pid: 's1' }), 0.3); // latest episode in progress
  assert.equal(progressOf(idx, { type: 'tv', pid: 's2' }), 0); // latest episode finished
  assert.equal(progressOf(idx, { type: 'tv', pid: 's2', season: 2, episode: 5 }), 0.5); // that episode card
});
