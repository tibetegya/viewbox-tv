// Data for the Jellyfin-style shell, all from the site itself (PRD Appendix A.2). Same-origin only: the site's CSP
// blocks everything else from injected code.

export const IMG = 'https://img.xcdn.to/t/p';
export const unescape = (s) => String(s || '').replace(/\\(['"])/g, '$1'); // the site escapes quotes in alt text
export const img = (file, size = 'w342') => (file ? `${IMG}/${size}/${String(file).replace(/^\//, '')}` : '');

// ---- pure helpers (unit-tested) -------------------------------------------------------------------------------

// localStorage["pos:{pid}:{s}:{e}"] (episode) or ["pos:{pid}"] (movie) = "{pos}:{dur}:{unixTs}"
export function parsePos(key, value) {
  const k = key.split(':');
  const v = String(value || '').split(':').map(Number);
  if (k[0] !== 'pos' || !k[1] || v.length < 3 || !(v[1] > 0)) return null;
  const e = { pid: k[1], pos: v[0], dur: v[1], ts: v[2] * 1000, pct: v[0] / v[1] };
  if (k.length >= 4) Object.assign(e, { type: 'tv', season: +k[2], episode: +k[3] });
  else e.type = 'movie';
  return e;
}

const STARTED = 0.05; // Jellyfin's default min resume percentage
const FINISHED = 0.9; // Jellyfin's default max resume percentage: beyond this counts as played

// In progress, newest first; one entry per show (its latest episode).
export function continueWatching(entries) {
  const seen = new Set();
  return entries
    .filter((e) => e.pct > STARTED && e.pct < FINISHED)
    .sort((a, b) => b.ts - a.ts)
    .filter((e) => (seen.has(e.pid) ? false : seen.add(e.pid)));
}

// For each show whose most recent episode was finished, the episode after it (eps: [{season, episode, ...}]).
export function nextUp(entries, epsByPid) {
  const latest = new Map();
  for (const e of entries.filter((x) => x.type === 'tv').sort((a, b) => b.ts - a.ts)) if (!latest.has(e.pid)) latest.set(e.pid, e);
  const out = [];
  for (const e of latest.values()) {
    if (e.pct < FINISHED) continue;
    const eps = (epsByPid[e.pid] || []).filter((x) => x.season > 0).sort((a, b) => a.season - b.season || a.episode - b.episode);
    const i = eps.findIndex((x) => x.season === e.season && x.episode === e.episode);
    if (i >= 0 && eps[i + 1]) out.push({ ...eps[i + 1], pid: e.pid, ts: e.ts });
  }
  return out;
}

export const backdropFromHtml = (html) => (/url\("?https:\/\/img\.xcdn\.to\/t\/p\/w1280\/([A-Za-z0-9_-]+\.jpg)/.exec(html) || [])[1] || null;

// ---- DOM parsers --------------------------------------------------------------------------------------------

export function parseCards(root) {
  return [...root.querySelectorAll('.cflip[data-href]')].map((c) => {
    const href = c.dataset.href;
    const [, , type, pid, slug, , season, , episode] = href.split('/');
    const poster = (c.querySelector('img.card-img-top')?.getAttribute('src') || c.querySelector('img[data-src]')?.dataset.src || '').split('/').pop();
    const badge = c.querySelector('.card-badge.top .badge')?.textContent.trim() || '';
    return {
      href, pid, slug, type: type === 'movie' ? 'movie' : 'tv',
      title: unescape(c.querySelector('img')?.alt?.trim() || c.querySelector('.card-footer')?.textContent.trim() || ''),
      year: /^\d{4}$/.test(badge) ? badge : c.querySelector('.card-text.t12')?.textContent.trim() || '',
      poster, season: season ? +season : null, episode: episode ? +episode : null,
      rating: c.querySelector('.card-badge.bottom .badge')?.textContent.trim() || '',
    };
  });
}

export function parseHero(root) {
  return [...root.querySelectorAll('.carousel-item')].map((s) => {
    const cap = s.querySelector('.carousel-caption-container[data-href]');
    const bg = /\/t\/p\/original\/([A-Za-z0-9_-]+\.jpg)/.exec(s.getAttribute('style') || '');
    return cap && {
      href: cap.dataset.href,
      title: cap.querySelector('.font-weight-normal')?.textContent.trim() || '',
      overview: cap.querySelector('.t16')?.textContent.trim() || '',
      backdrop: bg ? bg[1] : null,
    };
  }).filter(Boolean);
}

export function parseHome(root) {
  const row = (k) => parseCards(root.querySelector(`.contentList${k}`) || root.createElement('div'));
  return { hero: parseHero(root), popular: row('R'), latest: row('E'), tv: row('T'), movies: row('M') };
}

const lastPage = (root) => Math.max(1, ...[...root.querySelectorAll('.searchnav[data-p]')].map((a) => +a.dataset.p || 1));

export function parseDetails(doc, html) {
  const ov = doc.querySelector('.section-watch-overview');
  const badge = (title) => [...(ov?.querySelectorAll('.badge[title]') || [])].find((b) => b.title === title)?.textContent.trim() || '';
  const header = ov?.querySelector('.watch-header');
  const links = (type) => [...(ov?.querySelectorAll(`.show.link[data-type="${type}"]`) || [])].map((a) => a.textContent.trim());
  const seasons = [...doc.querySelectorAll('.section-watch-season')].map((sec) => {
    const rows = [...sec.querySelectorAll('tr.eplist')].map((r) => ({
      season: +r.dataset.pes, episode: +r.dataset.pep, epid: +r.dataset.epid,
      title: r.querySelector('.epTitle')?.textContent.trim() || '',
      thumb: (r.querySelector('img.watch-episode-thumb')?.dataset.img || '').replace(/^\//, ''),
      airDate: r.querySelector('.hidden-md-up')?.textContent.trim() || '',
    })).sort((a, b) => a.episode - b.episode);
    const poster = (sec.querySelector('img.watch-season-thumb')?.dataset.img || '').replace(/^\//, '');
    return { season: rows[0]?.season ?? null, poster, episodes: rows };
  }).filter((s) => s.season !== null).sort((a, b) => a.season - b.season);
  return {
    slug: (doc.querySelector('meta[property="og:url"]')?.content || '').split('/').pop(),
    title: header?.childNodes[0]?.textContent.trim() || '',
    year: (/\((\d{4})\)/.exec(header?.textContent || '') || [])[1] || '',
    poster: (ov?.querySelector('img[data-img]')?.dataset.img || '').replace(/^\//, ''),
    backdrop: backdropFromHtml(html),
    overview: ov?.querySelector('.moreless-content')?.textContent.trim() || '',
    rating: ov?.querySelector('.badge[title^="Rated"]')?.textContent.trim() || '',
    contentRating: badge('US Content Rating'),
    genres: links('genre'),
    network: links('network')[0] || '',
    seasons,
    similar: parseCards(doc.querySelector('.section-watch-recomm') || doc.createElement('div')),
  };
}

// ---- fetchers ------------------------------------------------------------------------------------------------

const toDoc = (html) => new DOMParser().parseFromString(html, 'text/html');
async function get(url) {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

export async function library(kind, page = 1, sort = 'latest') {
  const doc = toDoc(await get(`/show/${kind === 'movies' ? 'movies' : 'tvshows'}?page=${page}&sort=${sort}&ajax=1`));
  return { cards: parseCards(doc), lastPage: lastPage(doc) };
}

export async function search(query, page = 1) {
  const doc = toDoc(await get(`/search/${encodeURIComponent(query)}?ajax=1&tab=movies,tvshows${page > 1 ? `&page=${page}` : ''}`));
  return { cards: parseCards(doc), lastPage: lastPage(doc) };
}

export async function details(type, pid) {
  const html = await get(`/watch/${type === 'movie' ? 'movie' : 'tv'}/${pid}`);
  return parseDetails(toDoc(html), html);
}

// ---- watch history from the site's own localStorage -------------------------------------------------------------

export function watchEntries(storage = localStorage) {
  const out = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith('pos:')) { const e = parsePos(k, storage.getItem(k)); if (e) out.push(e); }
  }
  return out;
}

// Cached show/movie metadata (title, poster, backdrop, slug) so rows built from pos:* keys can show artwork.
const META_KEY = 'fc-tv-meta';
export const metaCache = {
  all() { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; } },
  put(pid, m) { const all = this.all(); all[pid] = { ...all[pid], ...m, ts: Date.now() }; try { localStorage.setItem(META_KEY, JSON.stringify(all)); } catch {} },
};
