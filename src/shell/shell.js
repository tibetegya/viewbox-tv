// Jellyfin-style shell: hides the site's own UI (it stays in the DOM for data and the player) and draws our screens.
import css from './jellyfin.css';
import { h } from './ui.js';
import { homeView, favouritesView, libraryView, searchView } from './views.js';
import { detailsView } from './details.js';
import { createOsd } from './osd.js';

function route(path) {
  if (path === '/' || path === '/home') return (app) => homeView(app);
  if (/^\/mylists\//.test(path)) return (app) => favouritesView(app);
  const lib = /^\/show\/(tvshows|movies)/.exec(path);
  if (lib) return (app) => libraryView(app, lib[1] === 'movies' ? 'movies' : 'tv');
  const det = /^\/watch\/(tv|movie)\/(\d+)/.exec(path);
  if (det) return (app) => detailsView(app, det[1], det[2]);
  if (/^\/search/.test(path)) return (app) => searchView(app);
  return null; // login, account, … keep the site's own page
}

export function startShell() {
  const view = route(location.pathname);
  if (!view) return null;
  document.documentElement.classList.add('fc-shell');
  document.head.appendChild(document.createElement('style')).textContent = css;
  const app = document.body.appendChild(h('div', { id: 'fc-app' }));
  view(app);
  const osd = createOsd();

  // The site's player becomes visible (full screen, above the shell) only while an episode/movie is on.
  const setPlaying = (on) => {
    document.documentElement.classList.toggle('fc-playing', on);
    if (on) osd.attach(); else osd.detach();
  };
  document.addEventListener('playing', (e) => {
    if (!(e.target instanceof HTMLVideoElement) || document.querySelector('.player.hide') || !(e.target.duration > 120)) return;
    if (/^\/watch\/movie\//.test(location.pathname) && !window.__fcAllowAutostart) return; // held autostart (autostart.js)
    setPlaying(true);
  }, true);
  const player = document.querySelector('.player');
  if (player) new MutationObserver(() => { if (player.classList.contains('hide')) setPlaying(false); }).observe(player, { attributes: true, attributeFilter: ['class'] });
  return { osd, stop: () => setPlaying(false), playing: () => document.documentElement.classList.contains('fc-playing') };
}
