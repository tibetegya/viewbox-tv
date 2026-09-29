// Left sidebar (Nuvio TV style): a collapsed icon rail on Home and list pages. It expands with labels while focus is
// inside it (CSS :focus-within); ← from the leftmost item of any screen enters it at the current section (nav.js).
import { h, icon, clock, isSignedIn } from './ui.js';
import { currentProfile, initialOf } from './profiles.js';

const ITEMS = [
  { id: 'home', label: 'Home', icon: 'home', href: '/home' },
  { id: 'tv', label: 'Shows', icon: 'tv', href: '/show/tvshows' },
  { id: 'movies', label: 'Movies', icon: 'movie', href: '/show/movies' },
  { id: 'favourites', label: 'Favourites', icon: 'heart', href: '/mylists/favorites' },
  { id: 'search', label: 'Search', icon: 'search', href: '/search/' },
  { id: 'settings', label: 'Settings', icon: 'settings', href: '/home#settings' },
];

export function sidebar(active) {
  const p = currentProfile();
  const profile = h('a', { class: 'nv-side__item nv-side__profile', href: '/home#profiles', 'aria-label': p ? `${p.name} — switch profile` : 'Profiles' },
    h('span', { class: 'nv-side__icon' }, p ? h('span', { class: 'nv-side__avatar', style: { background: p.color } }, initialOf(p.name)) : icon('person')),
    h('span', { class: 'nv-side__label' }, p ? p.name : 'Profiles'));
  const items = ITEMS.map((it) => h('a', { class: `nv-side__item${it.id === active ? ' nv-side__item--active' : ''}`, href: it.href, 'aria-label': it.label, 'data-side': it.id },
    h('span', { class: 'nv-side__icon' }, icon(it.icon)),
    h('span', { class: 'nv-side__label' }, it.label)));
  return h('nav', { class: 'nv-sidebar', 'aria-label': 'Menu' }, profile, h('div', { class: 'nv-side__items' }, items));
}

// Screen layout with the rail: sidebar + top-right corner (sign-in link, clock) + the screen's <main>.
export function railLayout(app, active, main, title) {
  main.classList.add('jf-main--rail');
  // The title sits outside <main>: screens redraw their <main> contents.
  app.append(sidebar(active), h('div', { class: 'jf-corner' }, !isSignedIn() && h('a', { class: 'jf-signin', href: '/home#settings' }, 'Sign in'), clock()),
    title ? h('h1', { class: 'jf-pagetitle jf-pagetitle--rail' }, title) : '', main);
}
