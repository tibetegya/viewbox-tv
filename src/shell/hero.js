// Home hero: the site's own home carousel, laid out like the Apple TV home — a track where the active item is 16:9 and
// the others 4:3, the active one playing its YouTube trailer behind the title, Watch, trailer play/pause and
// mute buttons.
// Remote: ←/→ change item (← on the first opens the sidebar), OK toggles the trailer, ↓ to the buttons, ↓ again to
// the rows. While the trailer plays the info fades out; pausing (or focusing the buttons) brings it back.
import { h, icon, keyHook } from './ui.js';
import { img, metaCache } from './data.js';
import { ensureMeta } from './meta.js';
import { enterSidebar } from '../nav.js';

const DWELL_MS = 1200; // an item must stay active this long before its trailer loads (fast ← → doesn't load several)
const SOUND_CHECK_MS = 3500; // not playing by then: autoplay with sound was blocked → play muted, unmute on next key

const trailerOf = (it) => { const m = metaCache.all()[it.pid]; return m && 'trailer' in m ? m.trailer || null : undefined; };
const post = (frame, func, args = []) => { try { frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args, id: 1, channel: 'widget' }), '*'); } catch (e) {} };

export function heroView(all) {
  const items = all.filter((it) => it.pid); // (Home data cached by older versions has no ids)
  let idx = 0;
  let player = null; // { frame, state, userPaused, muted, userMuted, soundTimer }
  let dwell = null;

  const els = items.map((it) => {
    const media = h('div', { class: 'ah-media', 'aria-label': `${it.title}. OK to play or pause the trailer`, style: it.backdrop ? { backgroundImage: `url("${img(it.backdrop, 'w1280')}")` } : null });
    const pauseBtn = h('button', { class: 'ah-btn ah-pause', 'aria-label': 'Pause trailer', onclick: () => toggle() }, icon('pause'));
    const watch = h('button', { class: 'ah-btn ah-watch', onclick: () => watchItem(it) }, icon('play'), h('span', {}, 'Watch'));
    const meta = [it.year, it.rating && `★ ${it.rating}`, it.contentRating !== 'NR' && it.contentRating].filter(Boolean).join('  ·  ');
    const info = h('div', { class: 'ah-info' },
      h('div', { class: 'ah-title' }, it.title),
      meta && h('div', { class: 'ah-meta' }, meta),
      it.overview && h('div', { class: 'ah-overview' }, it.overview),
      h('div', { class: 'ah-buttons' }, watch, pauseBtn));
    media.addEventListener('focus', () => item.classList.add('ah-item--focus'));
    media.addEventListener('blur', () => item.classList.remove('ah-item--focus'));
    const mute = h('button', { class: 'ah-mute', 'aria-label': 'Unmute trailer', hidden: true, onclick: () => toggleMute() }, icon('mute'));
    const item = h('div', { class: 'ah-item' }, media, info, mute);
    return { it, item, media, info, watch, pauseBtn, mute };
  });
  const track = h('div', { class: 'ah-track' }, els.map((e) => e.item));
  const dots = h('div', { class: 'ah-dots' }, items.map(() => h('span', { class: 'ah-dot' })));
  const root = h('section', { class: 'ah-hero', 'aria-label': 'Featured' }, track, dots);
  const cur = () => els[idx];

  function watchItem(it) {
    stop();
    location.assign(it.type === 'movie' ? `${it.href}#play` : it.href);
  }

  // ---- trailer ----
  function stop() {
    clearTimeout(dwell);
    if (!player) return;
    clearTimeout(player.soundTimer);
    player.frame.remove();
    player = null;
  }
  function paint() {
    const e = cur();
    const playing = !!player && player.state === 1 && !player.userPaused;
    e.item.classList.toggle('ah-item--video', !!player && player.started); // once playing, a paused trailer keeps its frame
    e.item.classList.toggle('ah-item--playing', playing);
    e.pauseBtn.replaceChildren(icon(playing ? 'pause' : 'trailer'));
    e.pauseBtn.setAttribute('aria-label', playing ? 'Pause trailer' : 'Play trailer');
    e.mute.hidden = !(player && player.started);
    e.mute.replaceChildren(icon(player && player.muted ? 'mute' : 'volume'));
    e.mute.setAttribute('aria-label', player && player.muted ? 'Unmute trailer' : 'Mute trailer');
  }
  function load() {
    stop();
    const e = cur();
    const id = trailerOf(e.it);
    e.pauseBtn.hidden = id === null;
    paint();
    if (id === undefined) { // not known yet: fetch this title's page once (cached for a day, meta.js)
      ensureMeta([{ pid: e.it.pid, type: e.it.type }], 1).then(() => { if (cur() === e && !player) load(); });
      return;
    }
    if (!id) return;
    dwell = setTimeout(() => { dwell = null; if (root.contains(document.activeElement)) start(e, id); }, DWELL_MS); // not behind the sidebar
  }
  function start(e, id, muted = false) {
    const src = `https://www.youtube.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
    const frame = h('iframe', { class: 'ah-video', src, allow: 'autoplay; encrypted-media', frameborder: '0', tabindex: '-1', title: `${e.it.title} trailer` });
    frame.addEventListener('load', () => post(frame, 'addEventListener', ['onStateChange'])); // ask the player to report state
    frame.addEventListener('load', () => { try { frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (err) {} });
    e.media.append(frame);
    player = { frame, state: -1, userPaused: false, muted, id };
    // Sound: if it hasn't started, autoplay with sound was refused — play muted now and unmute on the next key press.
    if (!muted) player.soundTimer = setTimeout(() => { if (player && player.frame === frame && player.state !== 1) { post(frame, 'mute'); post(frame, 'playVideo'); player.muted = true; paint(); } }, SOUND_CHECK_MS);
  }
  const onMessage = (ev) => {
    if (!player || ev.source !== player.frame.contentWindow) return;
    let d;
    try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch (err) { return; }
    if (!d) return;
    const state = d.event === 'onStateChange' ? d.info : d.event === 'infoDelivery' && d.info && typeof d.info.playerState === 'number' ? d.info.playerState : null;
    if (d.event === 'onError') { cur().pauseBtn.hidden = true; stop(); paint(); return; } // e.g. embedding disabled
    if (state === null || state === player.state) return;
    player.state = state;
    if (state === 1) player.started = true;
    if (state === 1 && player.userPaused) post(player.frame, 'pauseVideo'); // paused while it was still loading
    if (state === 0) { post(player.frame, 'seekTo', [0, true]); post(player.frame, 'playVideo'); } // loop (YouTube's loop=1 adds playlist controls)
    paint();
  };
  window.addEventListener('message', onMessage);

  function toggle() {
    if (!player) { const id = trailerOf(cur().it); if (id) { clearTimeout(dwell); start(cur(), id); } return; }
    player.userPaused = !player.userPaused;
    post(player.frame, player.userPaused ? 'pauseVideo' : 'playVideo');
    paint();
  }
  function toggleMute() {
    if (!player) return;
    player.muted = !player.muted;
    player.userMuted = player.muted; // a mute the user chose isn't undone by the next key press
    post(player.frame, player.muted ? 'mute' : 'unMute');
    paint();
  }

  // ---- items ----
  // focus: 'card' | 'watch' | 'last' (the row's last button) | false
  function select(i, focus = 'card') {
    idx = Math.max(0, Math.min(els.length - 1, i));
    els.forEach((e, j) => {
      const on = j === idx;
      e.item.classList.toggle('ah-item--active', on);
      e.item.classList.remove('ah-item--playing', 'ah-item--video');
      if (on) { e.media.setAttribute('role', 'button'); e.media.setAttribute('tabindex', '0'); } else { e.media.removeAttribute('role'); e.media.removeAttribute('tabindex'); }
      dots.children[j].classList.toggle('ah-dot--on', on);
    });
    track.style.setProperty('--i', idx);
    load(); // (decides whether the Pause button shows)
    const e = cur();
    const target = focus === 'card' ? e.media : focus === 'watch' ? e.watch : focus === 'last' ? lastBtn(e) : null;
    if (target) target.focus({ preventScroll: true });
  }

  const rowBtns = (e) => [e.watch, e.pauseBtn, e.mute].filter((b) => !b.hidden);
  const lastBtn = (e) => rowBtns(e).pop();

  keyHook.fn = (e) => {
    if (!root.isConnected) { keyHook.fn = null; window.removeEventListener('message', onMessage); stop(); return false; }
    if (player && player.muted && !player.userMuted && player.state === 1) { post(player.frame, 'unMute'); player.muted = false; paint(); } // a key press is a user gesture
    const k = e.keyCode;
    const c = cur();
    const a = document.activeElement;
    // Button row (Watch, trailer, mute — mute sits at the far right, so spatial nav would pick the card): ←/→ step
    // along it; past its ends → the previous item's last button (or the sidebar) / the next item's Watch.
    const row = rowBtns(c);
    const at = row.indexOf(a);
    if (at >= 0) {
      if (k === 37) { if (at > 0) row[at - 1].focus({ preventScroll: true }); else if (idx > 0) select(idx - 1, 'last'); else enterSidebar(); return true; }
      if (k === 39) { if (at < row.length - 1) row[at + 1].focus({ preventScroll: true }); else if (idx < els.length - 1) select(idx + 1, 'watch'); return true; }
      return false;
    }
    if (a !== c.media) return false;
    if (k === 37) { if (idx > 0) select(idx - 1); else enterSidebar(); return true; } // (the buttons sit left of the card's centre)
    if (k === 39) { if (idx < els.length - 1) select(idx + 1); return true; }
    if (k === 13) { toggle(); return true; }
    if (k === 40) { cur().watch.focus({ preventScroll: true }); return true; }
    return false;
  };

  // Focus left the hero (← to the sidebar, ↓ to the rows): pause; back in: resume (unless the user paused it).
  root.addEventListener('focusout', () => setTimeout(() => { if (player && !root.contains(document.activeElement)) post(player.frame, 'pauseVideo'); }));
  root.addEventListener('focusin', (ev) => {
    if (ev.relatedTarget && root.contains(ev.relatedTarget)) return; // moving within the hero
    if (player) { if (!player.userPaused) post(player.frame, 'playVideo'); } else if (!dwell) load();
  });

  select(0, false);
  ensureMeta(items.map((it) => ({ pid: it.pid, type: it.type })), items.length); // trailer ids for the rest, in the background
  return root;
}
