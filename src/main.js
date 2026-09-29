// Viewbox TV — TizenBrew site-modification module: 10-foot UI, D-pad navigation, new-episode row, and the
// extension's next-episode card + "Are you still watching?" (content/player.js, reused as-is).
// TizenBrew injects this into every page of its window: the launcher page (pick the site) and the site itself.
import css from './tv.css';
import { move, activeEl, focusEl, candidates } from './nav.js';
import { scan, counts, load, markSeen } from './episodes.js';
import { isLauncher, runLauncher } from './launcher.js';

/* global PLAYER_SRC, tizen, jwplayer */
(() => {
  if (window.__fcTv) return; // TizenBrew evaluates the module in every new execution context
  window.__fcTv = true;

  const DEFAULTS = { autoplayEnabled: true, creditsOffset: 20, countdownSecs: 10, autoplayOff: [], stillWatching: true, swEpisodes: 3, swMinutes: 90 };
  const SETTINGS_KEY = 'fc-tv-settings';
  const settings = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; } catch { return { ...DEFAULTS }; } };

  // Same channel content/player-bridge.js uses in the extension.
  function pushSettings() {
    document.documentElement.dataset.fcSettings = JSON.stringify(settings());
    document.dispatchEvent(new Event('fc-settings'));
  }

  const KEYS = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };
  const BACK = [10009, 27, 8]; // TV Return; Escape/Backspace when testing on a desktop
  const PLAY_PAUSE = [10252, 415, 19];
  const RED = 403;

  try { ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaFastForward', 'MediaRewind', 'ColorF0Red'].forEach((k) => tizen.tvinputdevice.registerKey(k)); } catch {}

  const onReady = (fn) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, { once: true }) : fn());

  // Only pages with the markup this module was built for get the TV features; anything else is left alone.
  const looksLikeSite = () => !!document.querySelector('a[href="/mylists/favorites"]') && !!document.querySelector('meta[name="csrf-token"]');
  let siteActive = false;

  onReady(() => {
    if (isLauncher()) {
      document.head.appendChild(document.createElement('style')).textContent = css;
      return runLauncher();
    }
    if (!looksLikeSite()) return;
    siteActive = true;
    document.documentElement.classList.add('fc-tv');
    document.head.appendChild(document.createElement('style')).textContent = css;
    pushSettings();
    const pid = location.pathname.match(/^\/watch\/tv\/(\d+)/)?.[1];
    if (pid) { markSeen(pid); loadPlayer(); }
    refresh();
    scan(false).then(refresh);
    setTimeout(() => activeEl() || move('down'), 800);
  });

  // content/player.js needs the site's playNext(), defined by main.min.js; an inline <script> is allowed by the site's CSP.
  function loadPlayer() {
    let tries = 0;
    const t = setInterval(() => {
      if (typeof window.playNext !== 'function' && ++tries < 40) return;
      clearInterval(t);
      const s = document.createElement('script');
      s.textContent = PLAYER_SRC;
      document.documentElement.appendChild(s);
    }, 250);
  }

  const playerOpen = () => !!document.querySelector('.player:not(.hide) video');
  const inOverlay = () => !!activeEl()?.getRootNode?.().host;

  // The site acts on keyup too (←/→ seek ±5 s on the watch page), so a key we handle must not reach it on keyup either.
  const handled = new Set();
  window.addEventListener('keyup', (e) => {
    if (siteActive && handled.delete(e.keyCode)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  window.addEventListener('keydown', (e) => {
    if (!siteActive) return;
    const code = e.keyCode;
    if (KEYS[code]) {
      if (playerOpen() && !inOverlay()) return; // site: ←/→ seek, ↑/↓ volume
      if (move(KEYS[code])) e.preventDefault();
      e.stopPropagation();
      handled.add(code);
    } else if (code === 13) {
      const el = activeEl();
      if (el && !el.matches('a[href], button, input, select, textarea')) { e.preventDefault(); e.stopPropagation(); el.click(); }
    } else if (BACK.includes(code)) {
      if (e.target.matches?.('input, textarea') && code === 8) return;
      if (inOverlay()) return; // player.js: Esc = "Not now"
      e.preventDefault();
      if (playerOpen()) closePlayer(); else history.back();
    } else if (PLAY_PAUSE.includes(code)) {
      e.preventDefault();
      try { const p = jwplayer('player'); p.getState() === 'playing' ? p.pause() : p.play(); } catch {}
    } else if (code === 417 || code === 412) {
      e.preventDefault();
      try { const p = jwplayer('player'); p.seek(Math.max(0, p.getPosition() + (code === 417 ? 10 : -10))); } catch {}
    } else if (code === RED) {
      const s = settings();
      s.autoplayEnabled = !s.autoplayEnabled;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
      pushSettings();
      toast(`Autoplay ${s.autoplayEnabled ? 'on' : 'off'}`);
    }
  }, true);

  // Mirrors what the site does when the last episode ends: pause, hide the player, back to the show URL.
  function closePlayer() {
    try { jwplayer('player').pause(); } catch {}
    document.querySelector('.player')?.classList.add('hide');
    history.replaceState(null, '', location.pathname.split('/').slice(0, 5).join('/'));
    const row = document.querySelector('tr.eplist.active, tr.eplist');
    if (row) focusEl(row);
  }

  function toast(text) {
    const t = document.body.appendChild(document.createElement('div'));
    t.className = 'fc-toast';
    t.setAttribute('role', 'status');
    t.textContent = text;
    setTimeout(() => t.remove(), 2000);
  }

  // "N new" badges on favorite cards + a "New episodes" row on the home page.
  function refresh() {
    const c = counts();
    for (const card of document.querySelectorAll('.cflip[data-href^="/watch/tv/"]')) {
      const n = c[card.dataset.href.split('/')[3]] || 0;
      const want = n ? `${n} new` : '';
      const badge = card.querySelector('.fc-new');
      if ((badge?.textContent ?? '') === want) continue;
      badge?.remove();
      if (want) Object.assign(card.querySelector('.card-badge.top')?.appendChild(document.createElement('span')) ?? {}, { className: 'badge badge-danger fc-new', textContent: want });
    }
    if (location.pathname === '/home') renderNewRow(c);
  }

  function renderNewRow(c) {
    const shows = load();
    const withNew = Object.entries(c).filter(([, n]) => n).map(([pid, n]) => ({ pid, n, ...shows[pid] })).filter((s) => s.title);
    document.getElementById('fc-new-row')?.remove();
    if (!withNew.length) return;
    const row = document.createElement('section');
    row.id = 'fc-new-row';
    row.setAttribute('aria-label', 'New episodes');
    row.innerHTML = '<h2>New episodes</h2><div class="fc-row"></div>';
    for (const s of withNew.sort((a, b) => b.n - a.n)) {
      const a = row.querySelector('.fc-row').appendChild(document.createElement('a'));
      a.className = 'fc-card';
      a.href = `/watch/tv/${s.pid}/${s.slug}`;
      a.setAttribute('aria-label', `${s.title}, ${s.n} new episode${s.n > 1 ? 's' : ''}`);
      const img = a.appendChild(document.createElement('img'));
      img.src = `https://img.xcdn.to/t/p/w342/${s.poster}`;
      img.alt = '';
      a.appendChild(Object.assign(document.createElement('span'), { className: 'fc-count', textContent: `${s.n} new` }));
      a.appendChild(Object.assign(document.createElement('span'), { className: 'fc-title', textContent: s.title }));
    }
    const host = document.getElementById('content') ?? document.body;
    host.insertBefore(row, host.firstChild);
    if (!candidates().some((x) => x.el === activeEl())) focusEl(row.querySelector('a'));
  }
})();
