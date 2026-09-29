// Jellyfin-style on-screen display over the site's JW Player (its own control bar is turned off).
import { h, icon, iconButton, clock, fmtTime, endsAt, epLabel, toast } from './ui.js';

const HIDE_AFTER = 4000;
const jw = () => { try { return window.jwplayer('player'); } catch (e) { return null; } };

function currentTitle() {
  const show = (document.querySelector('.section-watch-overview .watch-header')?.childNodes[0]?.textContent || document.title).trim();
  const key = String(window.key || '');
  const [, s, e] = key.split(':');
  if (!s) { const y = (/\((\d{4})\)/.exec(document.title) || [])[1]; return y ? `${show} (${y})` : show; }
  const row = document.querySelector(`tr.eplist[data-pes="${s}"][data-pep="${e}"]`);
  return `${show} — ${epLabel(s, e, row?.querySelector('.epTitle')?.textContent.trim())}`;
}

export function createOsd() {
  let root = null;
  let timer = null;
  let loop = null;
  let els = {};

  function build() {
    const title = h('div', { class: 'jf-osd__title' });
    const cur = h('span', { class: 'jf-osd__time' });
    const left = h('span', { class: 'jf-osd__time' });
    const fill = h('div', { class: 'jf-slider__fill' });
    const thumb = h('div', { class: 'jf-slider__thumb' });
    const slider = h('button', { class: 'jf-slider', role: 'slider', 'aria-label': 'Position', 'aria-valuemin': '0' }, h('div', { class: 'jf-slider__track' }, fill, thumb));
    const playBtn = iconButton('pause', 'Pause', () => { const p = jw(); if (!p) return; p.getState() === 'playing' ? p.pause() : p.play(); refresh(); });
    const muteBtn = iconButton('volume', 'Mute', () => { const p = jw(); if (p) { p.setMute(!p.getMute()); refresh(); } });
    const ends = h('span', { class: 'jf-osd__ends' });
    const isTv = /^\/watch\/tv\//.test(location.pathname);
    root = h('div', { id: 'fc-osd' },
      h('div', { class: 'jf-osd__top' },
        iconButton('back', 'Back', () => document.dispatchEvent(new Event('fc-close-player'))), // leaves playback, like Jellyfin
        title, h('span', { class: 'jf-osd__spacer' }), clock()),
      h('div', { class: 'jf-osd__bottom' },
        h('div', { class: 'jf-osd__timeline' }, cur, slider, left),
        h('div', { class: 'jf-osd__buttons' },
          iconButton('rewind', 'Rewind', () => seekBy(-10)),
          playBtn,
          iconButton('forward', 'Fast-forward', () => seekBy(30)),
          isTv && iconButton('next', 'Next episode', () => { if (typeof window.playNext === 'function') window.playNext(); }),
          ends,
          h('span', { class: 'jf-osd__spacer' }),
          iconButton('cc', 'Subtitles', cycleCaptions),
          iconButton('hd', 'Quality', cycleQuality),
          muteBtn)));
    els = { title, cur, left, fill, thumb, slider, playBtn, muteBtn, ends };
    document.body.appendChild(root);
  }

  function seekBy(s) { const p = jw(); if (p) { p.seek(Math.max(0, Math.min(p.getDuration() - 1, p.getPosition() + s))); refresh(); } }
  function cycleCaptions() {
    const p = jw(); if (!p) return;
    const list = p.getCaptionsList() || [];
    if (list.length < 2) return toast('No subtitles');
    const next = (p.getCurrentCaptions() + 1) % list.length;
    p.setCurrentCaptions(next);
    toast(`Subtitles: ${list[next].label || 'Off'}`);
  }
  function cycleQuality() {
    const p = jw(); if (!p) return;
    const list = p.getQualityLevels() || [];
    if (list.length < 2) return toast('Only one quality');
    const next = (p.getCurrentQuality() + 1) % list.length;
    p.setCurrentQuality(next);
    toast(`Quality: ${list[next].label}`);
  }

  function refresh() {
    const p = jw();
    const v = document.querySelector('video');
    const pos = p ? p.getPosition() : v?.currentTime || 0;
    const dur = p ? p.getDuration() : v?.duration || 0;
    const pct = dur > 0 ? Math.min(1, pos / dur) : 0;
    els.title.textContent = currentTitle();
    els.cur.textContent = fmtTime(pos);
    els.left.textContent = `-${fmtTime(dur - pos)}`;
    els.fill.style.width = `${pct * 100}%`;
    els.thumb.style.left = `${pct * 100}%`;
    els.slider.setAttribute('aria-valuenow', String(Math.round(pos)));
    els.slider.setAttribute('aria-valuemax', String(Math.round(dur)));
    els.ends.textContent = dur > 0 ? endsAt(dur - pos) : '';
    const playing = p ? p.getState() === 'playing' : v && !v.paused;
    els.playBtn.replaceChildren(icon(playing ? 'pause' : 'play'));
    els.playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    const muted = p ? p.getMute() : v?.muted;
    els.muteBtn.replaceChildren(icon(muted ? 'mute' : 'volume'));
    try { if (p && p.getControls()) p.setControls(false); } catch (e) {} // the site re-runs setup() per episode
  }

  const visible = () => !!root && root.classList.contains('jf-osd--on');
  function show(focusPlay) {
    if (!root) return;
    root.classList.add('jf-osd--on');
    refresh();
    if (focusPlay || !root.contains(document.activeElement)) els.playBtn.focus({ preventScroll: true });
    clearTimeout(timer);
    timer = setTimeout(() => { const p = jw(); if (!p || p.getState() === 'playing') hide(); }, HIDE_AFTER);
  }
  function hide() { if (root) { root.classList.remove('jf-osd--on'); if (root.contains(document.activeElement)) document.activeElement.blur(); } }

  // Remote keys while the player is open. Returns true when the key was used here.
  function handleKey(e) {
    if (!root) return false;
    const k = e.keyCode;
    if (!visible()) {
      if ([13, 37, 38, 39, 40].includes(k)) { show(true); return true; }
      return false;
    }
    show(false); // any key keeps it up
    if ((k === 37 || k === 39) && document.activeElement === els.slider) { seekBy(k === 39 ? 10 : -10); return true; } // timeline: ←/→ seek
    return false; // otherwise normal D-pad navigation among the OSD controls
  }

  return {
    attach() { if (!root) build(); loop = loop || setInterval(() => visible() && refresh(), 500); show(true); },
    detach() { hide(); clearInterval(loop); loop = null; root?.remove(); root = null; },
    visible, hide, show, handleKey,
  };
}
