// New-episode tracking from the site's own show pages (same origin, so the site's CSP allows it — TMDB is blocked on the TV).
import { countNew } from '../../scan.js';

export { countNew };

// "09/24/26" (the site's small-screen date format) → "2026-09-24".
export function parseAirDate(text) {
  const m = /(\d{2})\/(\d{2})\/(\d{2})\b/.exec(text || '');
  return m ? `20${m[3]}-${m[1]}-${m[2]}` : null;
}

// Pure-ish: takes a parsed Document of /watch/tv/{pid}.
export function parseShowPage(doc) {
  const og = (p) => doc.querySelector(`meta[property="og:${p}"]`)?.content ?? '';
  const m = /^Watch all Episodes of (.+) \((\d{4})\)/.exec(og('title'));
  const eps = [...doc.querySelectorAll('tr.eplist')].map((r) => ({
    season: +r.dataset.pes,
    episode: +r.dataset.pep,
    airDate: parseAirDate(r.querySelector('.hidden-md-up')?.textContent),
  }));
  return { title: m?.[1] ?? null, year: m?.[2] ?? null, slug: og('url').split('/').pop(), poster: og('image').split('/').pop(), eps };
}

const KEY = 'fc-tv-shows';
export const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
export const save = (shows) => { try { localStorage.setItem(KEY, JSON.stringify(shows)); } catch {} };

// The site's own favorites: localStorage "bm:t:{pid}" (TV shows only).
export const favoritePids = () => Object.keys(localStorage).filter((k) => k.startsWith('bm:t:')).map((k) => k.slice(5));

const SCAN_EVERY = 6 * 3600e3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One show page per favorite, sequential and spaced out. Runs when the app opens and when it's stale.
export async function scan(force) {
  const pids = favoritePids();
  const shows = load();
  // ponytail: like the extension, an empty favorites list (no sync code yet) never untracks anything.
  if (pids.length) for (const pid of Object.keys(shows)) if (!pids.includes(pid)) delete shows[pid];
  for (const pid of pids) {
    const s = (shows[pid] ??= { lastSeenAt: Date.now() });
    if (!force && s.scannedAt && Date.now() - s.scannedAt < SCAN_EVERY) continue;
    try {
      const html = await (await fetch(`/watch/tv/${pid}`)).text();
      Object.assign(s, parseShowPage(new DOMParser().parseFromString(html, 'text/html')), { scannedAt: Date.now() });
      save(shows);
    } catch (e) {
      console.warn('[viewbox-tv] scan failed', pid, e);
    }
    await sleep(300);
  }
  save(shows);
  return counts(shows);
}

export function counts(shows = load()) {
  const out = {};
  for (const [pid, s] of Object.entries(shows)) out[pid] = s.eps ? countNew(s.eps, s.lastSeenAt) : 0;
  return out;
}

export function markSeen(pid) {
  const shows = load();
  if (!shows[pid]) return;
  shows[pid].lastSeenAt = Date.now();
  save(shows);
}
