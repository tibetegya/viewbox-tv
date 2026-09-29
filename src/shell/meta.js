// Title / artwork / episode list per show or movie, cached in localStorage (fetched from the site's own pages).
import { details, metaCache } from './data.js';

const TTL = 24 * 3600e3;
let queue = Promise.resolve();

// Fetches missing (or stale) entries one at a time; returns the updated cache.
export function ensureMeta(items, max = 12, onEach) {
  queue = queue.catch(() => {}).then(async () => {
    const cache = metaCache.all();
    const todo = items.filter((it) => !cache[it.pid] || !('trailer' in cache[it.pid]) || Date.now() - (cache[it.pid].ts || 0) > TTL).slice(0, max);
    for (const it of todo) {
      try {
        const d = await details(it.type, it.pid);
        metaCache.put(it.pid, {
          type: it.type, title: d.title, year: d.year, slug: d.slug, poster: d.poster, backdrop: d.backdrop, trailer: d.trailer,
          eps: d.seasons.flatMap((s) => s.episodes.map((e) => [e.season, e.episode, e.title, e.thumb])),
        });
        if (onEach) onEach();
      } catch (e) {
        console.warn('[viewbox-tv] meta failed', it.pid, e);
      }
    }
    return metaCache.all();
  });
  return queue;
}

export const epsOf = (m) => (m?.eps || []).map(([season, episode, title, thumb]) => ({ season, episode, title, thumb }));
export const findEp = (m, s, e) => epsOf(m).find((x) => x.season === s && x.episode === e);
export const hrefOf = (type, pid, m, s, e) => `/watch/${type === 'movie' ? 'movie' : 'tv'}/${pid}/${m?.slug || 'x'}${s ? `/season/${s}/episode/${e}` : ''}`;
