// Stale-while-revalidate: the last data seen for each screen / fetched page, kept in localStorage so a screen can draw
// instantly from it (even at document start, before the site's page has loaded) and refresh when fresh data arrives.
const KEY = 'fc-tv-swr';
const MAX_ITEMS = 40;
const MAX_CHARS = 1000000; // leave the site plenty of localStorage

export function createCache(storage) {
  const st = () => storage || globalThis.localStorage;
  const read = () => { try { return JSON.parse(st().getItem(KEY)) || {}; } catch { return {}; } };
  return {
    get(key) { const e = read()[key]; return e ? e.v : undefined; },
    set(key, v) {
      const all = read();
      all[key] = { t: Date.now(), v };
      const byAge = () => Object.keys(all).sort((a, b) => all[a].t - all[b].t); // oldest first
      for (const k of byAge().slice(0, Math.max(0, Object.keys(all).length - MAX_ITEMS))) delete all[k];
      let json = JSON.stringify(all);
      while (json.length > MAX_CHARS && Object.keys(all).length > 1) { delete all[byAge()[0]]; json = JSON.stringify(all); }
      try { st().setItem(KEY, json); } catch { try { st().removeItem(KEY); } catch {} }
    },
  };
}

export const cache = createCache();
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Cached value right away (and revalidate in the background, calling onFresh if it changed); fetch if there's none.
export function swr(key, load, onFresh, store = cache) {
  const stale = store.get(key);
  const fresh = load().then((v) => {
    store.set(key, v);
    if (stale !== undefined && onFresh && !same(v, stale)) onFresh(v);
    return v;
  });
  if (stale === undefined) return fresh;
  fresh.catch(() => {}); // keep serving the cached copy if revalidation fails
  return Promise.resolve(stale);
}
