import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNext } from '../src/nav.js';
import { parseAirDate, countNew } from '../src/episodes.js';

const box = (left, top, w = 100, h = 150) => ({ rect: { left, top, width: w, height: h } });

test('pickNext: stays in the row, skips the wrong direction', () => {
  const from = box(200, 100).rect;
  const right = box(320, 100), farRight = box(440, 100), below = box(200, 300), diag = box(330, 260);
  assert.equal(pickNext(from, [farRight, below, right, diag], 'right'), right);
  assert.equal(pickNext(from, [farRight, below, right, diag], 'down'), below);
  assert.equal(pickNext(from, [farRight, right], 'left'), null);
});

test('parseAirDate reads the site\'s mm/dd/yy format', () => {
  assert.equal(parseAirDate('09/24/26'), '2026-09-24');
  assert.equal(parseAirDate(' Thu 09/24/26 '), '2026-09-24');
  assert.equal(parseAirDate(''), null);
});

test('countNew counts aired episodes after the last visit', () => {
  const now = Date.parse('2026-09-29T12:00:00Z');
  const eps = [{ airDate: '2026-09-10' }, { airDate: '2026-09-27' }, { airDate: '2026-10-05' }, { airDate: null }];
  assert.equal(countNew(eps, Date.parse('2026-09-20T00:00:00Z'), now), 1);
});

import { normalizeSite } from '../src/launcher.js';

test('normalizeSite accepts bare hosts and full URLs, rejects junk', () => {
  assert.equal(normalizeSite('example.com'), 'https://example.com/home');
  assert.equal(normalizeSite(' https://www.example.com/some/page?x=1 '), 'https://www.example.com/home');
  assert.equal(normalizeSite('http://example.org'), 'http://example.org/home');
  assert.equal(normalizeSite(''), null);
  assert.equal(normalizeSite('not a site'), null);
  assert.equal(normalizeSite('javascript:alert(1)'), null);
  assert.equal(normalizeSite('localhost'), null);
});

test('pickNext: next card in the row beats a header tab just above (v0.3.0 regression)', () => {
  const movies = { left: 514, top: 160, width: 427, height: 240 };
  const favourites = { rect: { left: 965, top: 160, width: 427, height: 240 } };
  const homeTab = { rect: { left: 822, top: 0, width: 115, height: 86 } };
  assert.equal(pickNext(movies, [homeTab, favourites], 'right'), favourites);
});

test('pickNext: a wide control above is reachable from any button under it (OSD timeline)', () => {
  const ff = { left: 150, top: 1000, width: 56, height: 56 };
  const slider = { rect: { left: 100, top: 958, width: 1700, height: 38 } };
  const back = { rect: { left: 30, top: 22, width: 56, height: 56 } };
  assert.equal(pickNext(ff, [back, slider], 'up'), slider);
  assert.equal(pickNext(slider.rect, [back], 'up'), back);
});
