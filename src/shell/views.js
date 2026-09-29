// Home, Favourites, Library and Search screens (Jellyfin TV layout, tv/JELLYFIN_STYLE.md).
import { h, icon, card, section, header, epLabel, isSignedIn, toast } from './ui.js';
import { library, search, watchEntries, continueWatching, nextUp, metaCache, progressIndex, progressOf } from './data.js';
import { ensureMeta, epsOf, findEp, hrefOf } from './meta.js';
import { counts as newCounts, load as loadScan } from '../episodes.js';

export const HOME_TABS = [{ id: 'home', label: 'Home', href: '/home' }, { id: 'favourites', label: 'Favourites', href: '/mylists/favorites' }];
const favoritePids = (t) => Object.keys(localStorage).filter((k) => k.startsWith(`bm:${t}:`)).map((k) => k.split(':')[2]);
// Watch progress (site's pos:* history), indexed once per page: poster cards show a bar like Jellyfin's when 5–90 % watched.
let progress = null;
const prog = () => progress || (progress = progressIndex(watchEntries()));
const posterCard = (c) => card({ href: c.href, image: c.poster, title: c.title, sub: c.season ? epLabel(c.season, c.episode) : c.year, progress: progressOf(prog(), c) });
const focusFirst = (root) => setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) root.querySelector('.jf-card, button, a')?.focus({ preventScroll: true }); }, 0);

// ---- Home ------------------------------------------------------------------------------------------------------
// site: parseHome() of the site's page — fresh, or the cached copy while the page is still loading (shell.js).
export function homeView(app, site) {
  const main = h('main', { class: 'jf-main' });
  app.append(header({ tabs: HOME_TABS, active: 'home' }), main);

  const backdropOf = (type) => site.hero.find((x) => x.href.includes(`/${type}/`) && x.backdrop)?.backdrop;
  const media = section('My Media', [
    card({ href: '/show/tvshows', image: backdropOf('tv'), imageSize: 'w780', title: 'Shows', shape: 'landscape' }),
    card({ href: '/show/movies', image: backdropOf('movie'), imageSize: 'w780', title: 'Movies', shape: 'landscape' }),
    card({ href: '/mylists/favorites', image: site.hero.map((x) => x.backdrop).filter((b) => b && b !== backdropOf('tv') && b !== backdropOf('movie'))[0], imageSize: 'w780', title: 'Favourites', shape: 'landscape' }),
  ]);
  const personal = h('div', { class: 'jf-personal' });
  main.append(media, personal,
    site.latest.length ? section('Latest Episodes & Movies', site.latest.map(posterCard)) : '',
    site.popular.length ? section('Popular', site.popular.map(posterCard)) : '',
    site.tv.length ? section('Shows', site.tv.map(posterCard)) : '',
    site.movies.length ? section('Movies', site.movies.map(posterCard)) : '');
  focusFirst(main);

  const history = watchEntries();
  const cw = continueWatching(history).slice(0, 12);
  const scanned = loadScan();
  const epsByPid = Object.fromEntries(Object.entries(metaCache.all()).map(([pid, m]) => [pid, epsOf(m)]));
  for (const [pid, s] of Object.entries(scanned)) if (!epsByPid[pid] && s.eps) epsByPid[pid] = s.eps;
  const drawPersonal = () => {
    const meta = metaCache.all();
    const cwCards = cw.filter((e) => meta[e.pid]).map((e) => {
      const m = meta[e.pid];
      const ep = e.type === 'tv' && findEp(m, e.season, e.episode);
      return card({
        href: hrefOf(e.type, e.pid, m, e.season, e.episode), shape: 'landscape',
        image: (ep && ep.thumb) || m.backdrop, imageSize: ep && ep.thumb ? 'w300' : 'w780',
        title: m.title, sub: e.type === 'tv' ? epLabel(e.season, e.episode, ep && ep.title) : m.year, progress: e.pct,
      });
    });
    const eps = { ...epsByPid };
    for (const [pid, m] of Object.entries(meta)) if (m.eps) eps[pid] = epsOf(m);
    const up = nextUp(history, eps).slice(0, 12);
    const upCards = up.filter((x) => meta[x.pid]).map((x) => {
      const m = meta[x.pid];
      const ep = findEp(m, x.season, x.episode);
      return card({ href: hrefOf('tv', x.pid, m, x.season, x.episode), shape: 'landscape', image: (ep && ep.thumb) || m.backdrop, imageSize: ep && ep.thumb ? 'w300' : 'w780', title: m.title, sub: epLabel(x.season, x.episode, ep && ep.title) });
    });
    const nc = newCounts(scanned);
    const newCards = Object.entries(nc).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).map(([pid, n]) => {
      const s = scanned[pid];
      return card({ href: `/watch/tv/${pid}/${s.slug}`, image: s.poster, title: s.title, sub: `${n} new episode${n > 1 ? 's' : ''}`, badge: n });
    });
    const hadFocus = personal.contains(document.activeElement);
    personal.replaceChildren(
      cwCards.length ? section('Continue Watching', cwCards) : '',
      upCards.length ? section('Next Up', upCards) : '',
      newCards.length ? section('New Episodes', newCards) : '');
    if (hadFocus) personal.querySelector('.jf-card')?.focus({ preventScroll: true });
  };
  drawPersonal();
  document.addEventListener('fc-scanned', drawPersonal); // favourites scan finished (episodes.js)
  const need = [...cw.map((e) => ({ pid: e.pid, type: e.type })), ...history.filter((e) => e.type === 'tv' && e.pct >= 0.9).sort((a, b) => b.ts - a.ts).map((e) => ({ pid: e.pid, type: 'tv' }))];
  const uniq = [...new Map(need.map((x) => [x.pid, x])).values()].slice(0, 16);
  ensureMeta(uniq).then(drawPersonal);
}

// ---- Favourites --------------------------------------------------------------------------------------------------
// The site keeps favourites per browser in localStorage (bm:t:*/bm:m:*), filled by its sync once a Sync Code is active.
export function favouritesView(app) {
  const main = h('main', { class: 'jf-main' });
  app.append(header({ tabs: HOME_TABS, active: 'favourites' }), main);
  const settingsLink = (text) => h('p', { class: 'jf-empty' }, text, ' ', h('a', { class: 'jf-button jf-button--inline', href: '/home#settings' }, 'Open Settings'));
  let loading = true;
  const itemsNow = () => [...favoritePids('t').map((pid) => ({ pid, type: 'tv' })), ...favoritePids('m').map((pid) => ({ pid, type: 'movie' }))];
  const draw = () => {
    const items = itemsNow();
    const meta = metaCache.all();
    const scanned = loadScan();
    const cardFor = (it) => {
      const m = meta[it.pid] || scanned[it.pid];
      return m && m.title ? card({ href: hrefOf(it.type, it.pid, m), image: m.poster, title: m.title, sub: m.year, progress: progressOf(prog(), it) }) : null;
    };
    const shows = items.filter((i) => i.type === 'tv').map(cardFor).filter(Boolean);
    const movies = items.filter((i) => i.type === 'movie').map(cardFor).filter(Boolean);
    let empty = '';
    if (!shows.length && !movies.length) {
      if (!isSignedIn()) empty = settingsLink('Sign in to your VIP account to see your favourites.');
      else if (!items.length && !localStorage.getItem('hqs.code')) empty = h('p', { class: 'jf-empty' }, 'No profile yet — your favourites come with a profile (tied to a sync code).', ' ', h('a', { class: 'jf-button jf-button--inline', href: '/home#profiles-manage' }, 'Add a profile'));
      else if (!items.length) empty = h('p', { class: 'jf-empty' }, 'No favourites in this list yet.');
      else empty = h('p', { class: 'jf-empty' }, loading ? 'Loading favourites…' : 'Couldn\'t load your favourites. Try again later.');
    }
    const had = main.contains(document.activeElement);
    main.replaceChildren(shows.length ? section('Shows', shows, 'jf-grid') : '', movies.length ? section('Movies', movies, 'jf-grid') : '', empty);
    if (!had) focusFirst(main);
  };
  const load = () => {
    loading = true;
    const scanned = loadScan();
    ensureMeta(itemsNow().filter((i) => !scanned[i.pid]?.title), 60, draw).then(() => { loading = false; draw(); }); // redraw as each one arrives
  };
  draw();
  load();
}

// ---- Library (Shows / Movies) ------------------------------------------------------------------------------------
const SORTS = [['latest', 'Latest'], ['best', 'Best Rated'], ['name', 'Name']];
// first: the page the site rendered ({cards, lastPage}, or its cached copy), for the default sort only.
export function libraryView(app, kind, first) {
  const params = new URLSearchParams(location.search);
  let sort = params.get('sort') || 'latest';
  let page = 1;
  let lastPage = first ? first.lastPage : 1;
  let loading = false;
  const tabs = [{ id: 'tv', label: 'Shows', href: '/show/tvshows' }, { id: 'movies', label: 'Movies', href: '/show/movies' }];
  const grid = h('div', { class: 'jf-grid' });
  const count = h('span', { class: 'jf-toolbar__count' });
  const sortBtn = h('button', { class: 'jf-iconbtn jf-toolbar__sort', 'aria-label': 'Sort', onclick: () => { const i = SORTS.findIndex(([k]) => k === sort); sort = SORTS[(i + 1) % SORTS.length][0]; history.replaceState(null, '', `?sort=${sort}`); reload(); } }, icon('sort'), h('span', {}, ''));
  const main = h('main', { class: 'jf-main' }, h('div', { class: 'jf-toolbar' }, count, sortBtn), grid);
  app.append(header({ tabs, active: kind, title: kind === 'movies' ? 'Movies' : 'Shows' }), main);

  const add = (cards) => grid.append(...cards.map(posterCard));
  const label = () => { count.textContent = `1-${grid.children.length} of ${lastPage > page ? `${lastPage * 24}+` : grid.children.length}`; sortBtn.lastChild.textContent = SORTS.find(([k]) => k === sort)[1]; };
  async function more() {
    if (loading || page >= lastPage) return;
    loading = true;
    try { const r = await library(kind, page + 1, sort); page += 1; lastPage = r.lastPage; add(r.cards); label(); } finally { loading = false; }
  }
  async function reload() {
    loading = true;
    try { const r = await library(kind, 1, sort); page = 1; lastPage = r.lastPage; grid.replaceChildren(); add(r.cards); label(); grid.querySelector('.jf-card')?.focus(); } finally { loading = false; }
  }
  if (first) { add(first.cards); label(); focusFirst(grid); } else reload();
  // Infinite scroll: fetch the next page when focus reaches the last two rows.
  grid.addEventListener('focusin', (e) => { const i = [...grid.children].indexOf(e.target.closest('.jf-card')); if (i >= grid.children.length - 14) more(); });
}

// ---- Search ------------------------------------------------------------------------------------------------------
const LETTERS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export function searchView(app) {
  const initial = decodeURIComponent(location.pathname.replace(/^\/search\/?/, '')).replace(/^\*$/, '');
  const input = h('input', { class: 'jf-search__input', type: 'text', placeholder: 'Search', value: initial, 'aria-label': 'Search', autocomplete: 'off', spellcheck: 'false' });
  const results = h('div', { class: 'jf-search__results' });
  const keys = h('div', { class: 'jf-keys' },
    h('div', { class: 'jf-keys__row' }, LETTERS.map((l) => h('button', { class: 'jf-key', 'aria-label': l === ' ' ? 'Space' : l, onclick: () => type(l) }, l === ' ' ? '␣' : l)),
      h('button', { class: 'jf-key', 'aria-label': 'Delete', onclick: () => { input.value = input.value.slice(0, -1); changed(); } }, icon('backspace'))),
    h('div', { class: 'jf-keys__row' }, '0123456789'.split('').map((d) => h('button', { class: 'jf-key', onclick: () => type(d) }, d))));
  const main = h('main', { class: 'jf-main jf-search' }, h('div', { class: 'jf-search__bar' }, icon('search', 'jf-search__icon'), input), keys, results);
  app.append(header({ title: 'Search' }), main);

  function type(ch) { input.value += ch.toLowerCase(); changed(); }
  let timer;
  let token = 0;
  function changed() { clearTimeout(timer); timer = setTimeout(run, 450); }
  async function run() {
    const q = input.value.trim();
    history.replaceState(null, '', `/search/${encodeURIComponent(q)}`);
    const my = ++token;
    if (!q) return suggestions();
    results.replaceChildren(h('p', { class: 'jf-empty' }, 'Searching…'));
    const show = (r) => {
      if (my !== token) return;
      const shows = r.cards.filter((c) => c.type === 'tv').map(posterCard);
      const movies = r.cards.filter((c) => c.type === 'movie').map(posterCard);
      const had = results.contains(document.activeElement);
      results.replaceChildren(
        shows.length ? section('Shows', shows) : '',
        movies.length ? section('Movies', movies) : '',
        !shows.length && !movies.length ? h('p', { class: 'jf-empty' }, 'No results.') : '');
      if (had) results.querySelector('.jf-card')?.focus({ preventScroll: true });
    };
    try {
      show(await search(q, 1, show)); // cached results at once, redrawn if the site's answer changed
    } catch (e) {
      if (my === token) results.replaceChildren(h('p', { class: 'jf-empty' }, 'Search failed. Try again.'));
    }
  }
  // Like Jellyfin's search page: a list of titles you know (here: recently cached shows/movies and favourites).
  function suggestions() {
    const meta = metaCache.all();
    const picks = Object.entries(meta).filter(([, m]) => m.title).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0)).slice(0, 14);
    results.replaceChildren(h('h2', { class: 'jf-section__title jf-center' }, 'Suggestions'),
      h('div', { class: 'jf-suggestions' }, picks.map(([pid, m]) => h('a', { class: 'jf-suggestion', href: hrefOf(m.type, pid, m) }, m.title))));
  }
  input.addEventListener('input', changed);
  if (initial) run(); else suggestions();
  setTimeout(() => input.focus(), 0);
}
