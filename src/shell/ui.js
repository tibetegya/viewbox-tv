// Small DOM helpers + Jellyfin-style building blocks (see tv/JELLYFIN_STYLE.md).
import { img } from './data.js';
import { currentProfile, initialOf } from './profiles.js';

// A screen can take keys before the default D-pad handling (main.js): fn(e) returns true when it handled the key.
export const keyHook = { fn: null };

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}

// Material Icons paths (Apache-2.0), 24×24.
const ICONS = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  rewind: 'M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z',
  forward: 'M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
  prev: 'M6 6h2v12H6zm3.5 6l8.5 6V6z',
  volume: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
  mute: 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',
  cc: 'M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z',
  hd: 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-8 12H9.5v-2h-2v2H6V9h1.5v2.5h2V9H11v6zm2-6h4c.55 0 1 .45 1 1v4c0 .55-.45 1-1 1h-4V9zm1.5 4.5h2v-3h-2v3z',
  backspace: 'M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15a2 2 0 002-2V5a2 2 0 00-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z',
  sort: 'M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z',
  tv: 'M21 3H3a2 2 0 00-2 2v12a2 2 0 002 2h5v2h8v-2h5a2 2 0 001.99-2L23 5a2 2 0 00-2-2zm0 14H3V5h18v12z',
  movie: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4a2 2 0 00-1.99 2L2 18a2 2 0 002 2h16a2 2 0 002-2V4h-4z',
  person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
};

export function icon(name, cls = '') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `jf-icon ${cls}`);
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICONS[name] || '');
  svg.appendChild(p);
  return svg;
}

export const iconButton = (name, label, onclick, extra = {}) => h('button', { class: `jf-iconbtn ${extra.class || ''}`, 'aria-label': label, title: label, onclick, ...extra.attrs }, icon(name));

export const clock = () => {
  const el = h('span', { class: 'jf-clock' });
  const tick = () => { const d = new Date(); el.textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  tick();
  setInterval(tick, 15000);
  return el;
};

export const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
};
export const endsAt = (secondsLeft) => { const d = new Date(Date.now() + secondsLeft * 1000); return `Ends at ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const epLabel = (s, e, title) => `S${s}:E${e}${title ? ` - ${title}` : ''}`;

// Jellyfin card: portrait poster (2:3) or landscape backdrop (16:9); focus zoom is pure CSS.
export function card({ href, onclick, image, imageSize = 'w342', title, sub, progress, badge, shape = 'portrait', label }) {
  const bg = image ? { backgroundImage: `url("${image.startsWith('http') ? image : img(image, imageSize)}")` } : null;
  const inner = h('div', { class: 'jf-card__box' },
    h('div', { class: 'jf-card__img', style: bg },
      !image && h('div', { class: 'jf-card__fallback' }, title),
      progress > 0 && h('div', { class: 'jf-progress' }, h('div', { class: 'jf-progress__fill', style: { width: `${Math.round(progress * 100)}%` } })),
      badge && h('div', { class: 'jf-badge' }, badge)),
    h('div', { class: 'jf-card__title' }, title),
    sub && h('div', { class: 'jf-card__sub' }, sub));
  const attrs = { class: `jf-card jf-card--${shape}`, 'aria-label': label || [title, sub].filter(Boolean).join(', ') };
  return href ? h('a', { ...attrs, href }, inner) : h('button', { ...attrs, onclick }, inner);
}

export const section = (title, kids, cls = 'jf-row') => h('section', { class: 'jf-section' }, h('h2', { class: 'jf-section__title' }, title), h('div', { class: cls }, kids));

// Header: home variant (logo + tabs) or inner pages (back / home + title), with search + clock on the right.
export function header({ tabs, active, title } = {}) {
  const left = !title
    ? h('div', { class: 'jf-header__left' }, h('span', { class: 'jf-logo', 'aria-label': 'Viewbox' }, 'Viewbox'))
    : h('div', { class: 'jf-header__left' },
      iconButton('back', 'Back', () => history.back()),
      h('a', { class: 'jf-iconbtn', href: '/home', 'aria-label': 'Home' }, icon('home')),
      title && h('span', { class: 'jf-header__title' }, title));
  const mid = h('nav', { class: 'jf-tabs' }, (tabs || []).map((t) => h('a', { class: `jf-tab${t.id === active ? ' jf-tab--active' : ''}`, href: t.href }, t.label)));
  const signedIn = isSignedIn();
  const right = h('div', { class: 'jf-header__right' },
    !signedIn && h('a', { class: 'jf-signin', href: '/home#settings' }, 'Sign in'),
    h('a', { class: 'jf-iconbtn', href: '/search/', 'aria-label': 'Search' }, icon('search')),
    h('a', { class: 'jf-iconbtn', href: '/home#settings', 'aria-label': 'Settings' }, icon('settings')),
    profileButton(),
    clock());
  return h('header', { class: 'jf-header' }, left, mid, right);
}

// Active profile's avatar (Nuvio-style): opens "Who's watching?" to switch; a plain person icon when there's none yet.
function profileButton() {
  const p = currentProfile();
  return h('a', { class: 'jf-iconbtn jf-profilebtn', href: '/home#profiles', 'aria-label': p ? `Profile: ${p.name}. Switch profile` : 'Profiles' },
    p ? h('span', { class: 'jf-profilebtn__avatar', style: { background: p.color } }, initialOf(p.name)) : icon('person'));
}

// The site shows a "My Account" link only when a VIP session is active (PRD Appendix A). While the page is still
// loading (screens drawn from the cache at document start) the last known state is used.
const SIGNED_KEY = 'fc-tv-signed-in';
export const isSignedIn = () => {
  if (document.readyState === 'loading') { try { return localStorage.getItem(SIGNED_KEY) === '1'; } catch { return false; } }
  const on = !!document.querySelector('a[href="/account"]');
  try { localStorage.setItem(SIGNED_KEY, on ? '1' : '0'); } catch {}
  return on;
};

export const toast = (text, ms = 2000) => {
  const t = (document.body || document.documentElement).appendChild(h('div', { class: 'fc-toast', role: 'status' }, text));
  setTimeout(() => t.remove(), ms);
};
