// Jellyfin-style shell: hides the site's own UI (it stays in the DOM for data and the player) and draws our screens.
// Screens draw as early as possible: at document start from the last data seen (cache.js), or as a skeleton the first
// time, then refresh in place when the site's page has loaded (stale-while-revalidate).
import css from './jellyfin.css';
import { h, header, epLabel, toast } from './ui.js';
import { homeView, favouritesView, libraryView, searchView } from './views.js';
import { sidebar } from './sidebar.js';
import { detailsView } from './details.js';
import { settingsView } from './settings.js';
import { profilesView } from './profileScreen.js';
import { loadProfiles, wasChosen, markChosen } from './profiles.js';
import { createOsd } from './osd.js';
import { parseHome, parseDetails, parseLibraryPage, metaCache, img } from './data.js';
import { findEp } from './meta.js';
import { cache, same } from './cache.js';

// Each screen: render(app, data), and for screens built from the site's page, the cache key + fresh() parser.
function route(path) {
  if (path === '/' || path === '/home') {
    if (location.hash === '#settings') return { render: (app) => settingsView(app), skeleton: 'plain', side: 'settings' };
    if (location.hash === '#profiles' || location.hash === '#profiles-manage') return { id: 'profiles', render: (app) => profilesView(app, { manage: location.hash === '#profiles-manage' }) };
    // "Who's watching?" first when the app opens with 2+ profiles (Nuvio-style); drawn in place of Home.
    if (!location.hash && !wasChosen()) {
      if (loadProfiles().length >= 2) return { id: 'picker', render: (app) => profilesView(app, { onDone: () => redraw() }) };
      markChosen(); // one profile (or none): nothing to pick this session
    }
    // The site's carousel is a different pick on every load: a changed hero alone doesn't redraw Home (it's saved for next time).
    return { key: 'home', fresh: () => parseHome(document), render: homeView, skeleton: 'home', side: 'home', same: (a, b) => same({ ...a, hero: null }, { ...b, hero: null }) };
  }
  if (/^\/mylists\//.test(path)) return { render: (app) => favouritesView(app), skeleton: 'grid', side: 'favourites' };
  const lib = /^\/show\/(tvshows|movies)/.exec(path);
  if (lib) {
    const kind = lib[1] === 'movies' ? 'movies' : 'tv';
    const params = new URLSearchParams(location.search);
    if ((params.get('sort') || 'latest') !== 'latest' || params.get('page')) return { render: (app) => libraryView(app, kind, null), skeleton: 'grid', side: kind };
    return { key: `page:${kind}`, fresh: () => parseLibraryPage(document, kind), render: (app, data) => libraryView(app, kind, data), skeleton: 'grid', side: kind };
  }
  const det = /^\/watch\/(tv|movie)\/(\d+)/.exec(path);
  if (det) return { key: `details:${det[2]}`, fresh: () => parseDetails(document, document.head.innerHTML), render: (app, d) => detailsView(app, det[1], det[2], d), skeleton: 'details' };
  if (/^\/search/.test(path)) return { render: (app) => searchView(app), skeleton: 'plain', side: 'search' };
  return null; // login, account, … keep the site's own page
}

export const isShellPath = (path) => !!route(path);

// ---- skeletons (first visit): the shape of the screen while the site's page loads -------------------------------
function skeleton(kind, side) {
  const bar = (width) => h('div', { class: 'jf-skel jf-skel--text', style: { width } });
  const skelCard = (shape) => h('div', { class: `jf-card jf-card--${shape} jf-skel-card` }, h('div', { class: 'jf-card__img jf-skel' }), bar('60%'));
  const row = (n, shape) => h('section', { class: 'jf-section' }, h('div', { class: 'jf-section__title' }, bar('240px')),
    h('div', { class: 'jf-row jf-row--skel' }, Array.from({ length: n }, () => skelCard(shape))));
  const rail = (...kids) => [sidebar(side), h('main', { class: 'jf-main jf-main--rail' }, ...kids)];
  if (kind === 'home') {
    const hero = h('section', { class: 'ah-hero' }, h('div', { class: 'ah-track' },
      h('div', { class: 'ah-item ah-item--active' }, h('div', { class: 'ah-media jf-skel' })),
      h('div', { class: 'ah-item' }, h('div', { class: 'ah-media jf-skel' })), h('div', { class: 'ah-item' }, h('div', { class: 'ah-media jf-skel' }))));
    return rail(hero, row(4, 'landscape'), row(8, 'portrait'));
  }
  if (kind === 'grid') return rail(h('div', { class: 'jf-pagetitle' }, bar('220px')), h('div', { class: 'jf-grid' }, Array.from({ length: 14 }, () => skelCard('portrait'))));
  if (kind === 'details') {
    return [header({ title: ' ' }), h('main', { class: 'jf-main' }, h('div', { class: 'jf-details' },
      h('div', { class: 'jf-details__poster jf-skel' }),
      h('div', { class: 'jf-details__body jf-skel-body' }, bar('40%'), bar('25%'), bar('180px'), bar('90%'), bar('85%'), bar('60%'))))];
  }
  return side ? rail() : [];
}

// ---- playback loading screen: an episode URL (or a movie with #play) plays on load; show this until it does -----
const playbackExpected = () => /^\/watch\/tv\/\d+\/[^/]+\/season\/\d+\/episode\/\d+/.test(location.pathname)
  || (/^\/watch\/movie\/\d+/.test(location.pathname) && location.hash === '#play');
let loading = null;
function showLoading() {
  if (loading) return;
  const [, type, pid, s, e] =/^\/watch\/(tv|movie)\/(\d+)(?:\/[^/]+\/season\/(\d+)\/episode\/(\d+))?/.exec(location.pathname) || [];
  const m = metaCache.all()[pid] || {};
  const ep = type === 'tv' && s ? findEp(m, +s, +e) : null;
  const sub = type === 'tv' && s ? epLabel(+s, +e, ep && ep.title) : m.year;
  loading = h('div', { id: 'fc-loading', role: 'status', 'aria-label': 'Loading', style: m.backdrop ? { backgroundImage: `url("${img(m.backdrop, 'w1280')}")` } : null },
    h('div', { class: 'jf-spinner' }),
    m.title && h('div', { class: 'jf-loading__title' }, m.title),
    sub && h('div', { class: 'jf-loading__sub' }, sub));
  document.documentElement.appendChild(loading);
  loading.timer = setTimeout(() => { hideLoading(); toast('Couldn’t start playback'); }, 45000);
}
function hideLoading() {
  if (!loading) return;
  clearTimeout(loading.timer);
  loading.remove();
  loading = null;
}
export const isLoadingPlayback = () => !!loading;

// ---- mounting -----------------------------------------------------------------------------------------------------
let app = null;
let drawn = null; // { data, signedIn } the screen was drawn with at document start (null: skeleton)

function mount(parent) {
  document.documentElement.classList.add('fc-shell');
  (document.head || document.documentElement).appendChild(document.createElement('style')).textContent = css;
  app = parent.appendChild(h('div', { id: 'fc-app' }));
}

// Document start (from main.js, before <body> exists): draw the cached screen, or its skeleton.
export function bootShell() {
  const r = route(location.pathname);
  if (!r || app) return;
  mount(document.documentElement);
  draw(r);
  if (playbackExpected()) showLoading();
}

// Draw a screen before the page has loaded: from the cache, a screen that needs no page data (the picker), or a skeleton.
function draw(r) {
  const stale = r.key ? cache.get(r.key) : undefined;
  app.replaceChildren();
  try {
    if (stale !== undefined) { r.render(app, stale); drawn = { id: r.id, data: stale, signedIn: localStorage.getItem('fc-tv-signed-in') }; return; }
    if (r.id) { r.render(app); drawn = { id: r.id }; return; }
  } catch (e) { app.replaceChildren(); }
  drawn = null;
  app.append(...skeleton(r.skeleton, r.side));
}

// After "Who's watching?" (same profile kept): show Home in place — from the page if it's loaded, else as at boot.
function redraw() {
  const r = route(location.pathname);
  if (document.readyState === 'loading') return draw(r);
  app.replaceChildren();
  app.scrollTop = 0;
  r.render(app, r.key ? r.fresh() : undefined);
}

// The page turned out not to be the site (e.g. a Cloudflare challenge): take everything down again.
export function unmountShell() {
  hideLoading();
  app?.remove();
  app = null;
  document.documentElement.classList.remove('fc-shell');
}

// Where focus is (section + card index), to put it back after a redraw.
const focusPath = () => {
  const el = document.activeElement;
  const sec = el && app.contains(el) && el.closest('.jf-section');
  return sec ? [[...app.querySelectorAll('.jf-section')].indexOf(sec), [...sec.querySelectorAll('.jf-card')].indexOf(el.closest('.jf-card'))] : null;
};
const restoreFocus = (p) => {
  const sec = p && app.querySelectorAll('.jf-section')[p[0]];
  const target = sec && (sec.querySelectorAll('.jf-card')[p[1]] || sec.querySelector('.jf-card'));
  if (target) { target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
};

// Page loaded: revalidate — redraw only if the site's data (or the sign-in state) differs from what's on screen.
export function startShell() {
  const r = route(location.pathname);
  if (!r) return null;
  if (!app) mount(document.body);
  const fresh = r.key ? r.fresh() : undefined;
  if (r.key) cache.set(r.key, fresh);
  const signedIn = document.querySelector('a[href="/account"]') ? '1' : '0';
  const upToDate = drawn && drawn.id === r.id && (r.key ? (r.same || same)(drawn.data, fresh) && drawn.signedIn === signedIn : true);
  if (!upToDate) {
    const where = focusPath();
    const top = app.scrollTop;
    app.replaceChildren();
    r.render(app, fresh);
    if (where) { app.scrollTop = top; restoreFocus(where); }
  }
  if (playbackExpected()) showLoading();
  // Home ⇄ Settings is a hash change on the same page: redraw instead of reloading.
  if (location.pathname === '/' || location.pathname === '/home') {
    window.addEventListener('hashchange', () => {
      const r2 = route(location.pathname);
      app.replaceChildren();
      app.scrollTop = 0;
      r2.render(app, r2.key ? r2.fresh() : undefined);
    });
  }
  const osd = createOsd();

  // The site's player becomes visible (full screen, above the shell) only while an episode/movie is on.
  const setPlaying = (on) => {
    document.documentElement.classList.toggle('fc-playing', on);
    if (on) { hideLoading(); osd.attach(); } else osd.detach();
  };
  // Shown on 'playing' or the first 'timeupdate' while playing: on the TV an HLS stream may not know its duration yet
  // when 'playing' fires, so an unknown duration counts as long (the > 2 min check only filters short ads).
  const onPlay = (e) => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement) || v.paused || document.documentElement.classList.contains('fc-playing')) return;
    if (document.querySelector('.player.hide') || v.duration <= 120) return;
    if (/^\/watch\/movie\//.test(location.pathname) && !window.__fcAllowAutostart) return; // held autostart (autostart.js)
    setPlaying(true);
  };
  document.addEventListener('playing', onPlay, true);
  document.addEventListener('timeupdate', onPlay, true);
  const player = document.querySelector('.player');
  if (player) new MutationObserver(() => { if (player.classList.contains('hide')) setPlaying(false); }).observe(player, { attributes: true, attributeFilter: ['class'] });
  return { osd, stop: () => { hideLoading(); setPlaying(false); }, playing: () => document.documentElement.classList.contains('fc-playing') };
}
