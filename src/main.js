// Viewbox TV — TizenBrew site-modification module: a Jellyfin-style TV shell over the site (src/shell/), D-pad
// navigation, and the extension's next-episode card + "Are you still watching?" (content/player.js, reused as-is).
// TizenBrew injects this into every page of its window: the launcher page (pick the site) and the site itself.
import css from './tv.css';
import { move, activeEl } from './nav.js';
import { scan, markSeen } from './episodes.js';
import { isLauncher, runLauncher } from './launcher.js';
import { startShell, isShellPath } from './shell/shell.js';
import { holdMovieAutostart } from './shell/autostart.js';

/* global PLAYER_SRC, tizen, jwplayer */
(() => {
  window.__fcTvInjected = Date.now(); // read by the launcher page's diagnostics (docs/index.html)
  if (window.__fcTv) return; // TizenBrew evaluates the module in every new execution context
  window.__fcTv = true;
  holdMovieAutostart(); // must run before the site's scripts: movie pages autoplay otherwise

  // No flash of the site's own UI: from injection (document start on TizenBrew) until the shell is up, show only the
  // shell's dark background. Lifted when the shell mounts, at once if the page isn't the site (e.g. a Cloudflare
  // challenge must stay visible), and after 8 s whatever happens.
  const booting = window.top === window && isShellPath(location.pathname);
  const unboot = () => document.documentElement && document.documentElement.classList.remove('fc-boot');
  const boot = () => {
    document.documentElement.classList.add('fc-boot');
    const s = document.createElement('style');
    s.textContent = 'html.fc-boot,html.fc-boot body{background:#101010!important}html.fc-boot body{visibility:hidden!important}';
    (document.head || document.documentElement).appendChild(s);
    setTimeout(unboot, 8000);
  };
  // At document start <html> may not exist yet: apply the moment it's inserted, before anything paints.
  if (booting) {
    if (document.documentElement) boot();
    else new MutationObserver((_, mo) => { if (document.documentElement) { mo.disconnect(); boot(); } }).observe(document, { childList: true });
  }

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
  let shell = null;

  onReady(() => {
    if (isLauncher()) {
      // Errors from TizenBrew's Runtime.evaluate never reach window.onerror, so keep them for the page's diagnostics.
      try {
        document.head.appendChild(document.createElement('style')).textContent = css;
        return runLauncher();
      } catch (e) {
        window.__fcTvError = String((e && e.stack) || e);
        throw e;
      }
    }
    if (!looksLikeSite()) return unboot();
    siteActive = true;
    document.documentElement.classList.add('fc-tv');
    document.head.appendChild(document.createElement('style')).textContent = css;
    pushSettings();
    const pid = location.pathname.match(/^\/watch\/tv\/(\d+)/)?.[1];
    if (pid) markSeen(pid);
    if (/^\/watch\/tv\//.test(location.pathname)) loadPlayer();
    shell = startShell();
    unboot();
    scan(false).then(() => document.dispatchEvent(new Event('fc-scanned')));
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

  const playerOpen = () => (shell ? shell.playing() : !!document.querySelector('.player:not(.hide) video'));
  const overlayRoot = () => { const r = activeEl()?.getRootNode?.(); return r && r.host ? r : null; };
  const inOverlay = () => !!overlayRoot();

  // The site acts on keyup too (←/→ seek ±5 s on the watch page), so a key we handle must not reach it on keyup either.
  const handled = new Set();
  window.addEventListener('keyup', (e) => {
    if (siteActive && handled.delete(e.keyCode)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  window.addEventListener('keydown', (e) => {
    if (!siteActive) return;
    const code = e.keyCode;
    // While playing: the Jellyfin-style OSD owns the keys (first press shows it); without the shell, the site's keys.
    if (playerOpen() && !inOverlay() && (KEYS[code] || code === 13)) {
      if (!shell) return; // site: ←/→ seek, ↑/↓ volume
      if (shell.osd.handleKey(e)) { e.preventDefault(); e.stopPropagation(); handled.add(code); return; }
    }
    if (KEYS[code]) {
      if (move(KEYS[code])) e.preventDefault();
      e.stopPropagation();
      handled.add(code);
    } else if (code === 13) {
      const el = activeEl();
      if (!el || el.matches('input, select, textarea')) return;
      // Our own controls are activated here: the site's document handler treats Enter as play/pause and cancels it.
      // (Up Next / still-watching overlays live in shadow roots and handle Enter themselves.)
      if (el.closest('#fc-app, #fc-osd') || !el.matches('a[href], button')) { e.preventDefault(); e.stopPropagation(); el.click(); }
    } else if (BACK.includes(code)) {
      if (e.target.matches?.('input, textarea') && code === 8) return;
      e.preventDefault();
      e.stopPropagation();
      if (inOverlay()) { overlayRoot().querySelector('.cancel')?.click(); return; } // Up Next card: "Not now" / "Close"
      if (shell && shell.osd.visible()) shell.osd.hide();
      else if (playerOpen()) closePlayer();
      else history.back();
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
    history.replaceState(null, '', location.pathname.split('/').slice(0, 5).join('/') + (location.hash.startsWith('#season-') ? location.hash : ''));
    window.__fcAllowAutostart = false;
    shell?.stop();
    setTimeout(() => ['.jf-detailbtn--play', '.jf-main .jf-card', '.jf-main button'].map((s) => document.querySelector(`#fc-app ${s}`)).find(Boolean)?.focus({ preventScroll: true }), 0);
  }
  document.addEventListener('fc-close-player', closePlayer);

  function toast(text) {
    const t = document.body.appendChild(document.createElement('div'));
    t.className = 'fc-toast';
    t.setAttribute('role', 'status');
    t.textContent = text;
    setTimeout(() => t.remove(), 2000);
  }

})();
