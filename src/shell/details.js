// Series / movie details and season view (Jellyfin TV layout). Built from the page we're on; playback uses the site's own player.
import { h, icon, iconButton, card, section, header, epLabel, toast } from './ui.js';
import { parseDetails, watchEntries, img, metaCache } from './data.js';

export function detailsView(app, type, pid) {
  const d = parseDetails(document, document.head.innerHTML);
  metaCache.put(pid, {
    type, title: d.title, year: d.year, slug: d.slug, poster: d.poster, backdrop: d.backdrop,
    eps: d.seasons.flatMap((s) => s.episodes.map((e) => [e.season, e.episode, e.title, e.thumb])),
  });
  const hist = () => watchEntries().filter((e) => e.pid === pid);
  const pctOf = (s, e) => (hist().find((x) => x.season === s && x.episode === e) || {}).pct || 0;
  const allEps = d.seasons.filter((s) => s.season > 0).flatMap((s) => s.episodes);

  // Resume the latest in-progress episode, else the one after the latest finished, else the first.
  function playTarget() {
    const h2 = hist().filter((x) => x.type === 'tv').sort((a, b) => b.ts - a.ts);
    const last = h2[0];
    if (last && last.pct < 0.9) return last;
    if (last) { const i = allEps.findIndex((x) => x.season === last.season && x.episode === last.episode); if (allEps[i + 1]) return allEps[i + 1]; }
    return allEps[0];
  }
  function playEpisode(s, e) {
    const row = document.querySelector(`tr.eplist[data-pes="${s}"][data-pep="${e}"]`);
    if (row) row.click(); else toast('Episode not available');
  }
  function playMovie() {
    window.__fcAllowAutostart = true;
    try { window.jwplayer('player').play(); } catch (err) { location.hash = 'play'; location.reload(); }
  }
  const favEl = () => document.querySelector(`.favorite[data-pid="${pid}"]`);
  const isFav = () => !!favEl() && !favEl().classList.contains('fa-heart-o');

  const main = h('main', { class: 'jf-main' });
  app.append(header({ title: d.title }), main);

  function overview() {
    const favBtn = iconButton('heart', 'Add to favourites', () => { favEl()?.click(); setTimeout(syncFav, 600); }, { class: 'jf-detailbtn' });
    const syncFav = () => favBtn.classList.toggle('jf-iconbtn--on', isFav());
    syncFav();
    const target = type === 'tv' && playTarget();
    const play = iconButton('play', type === 'tv' && target && pctOf(target.season, target.episode) > 0.05 ? 'Resume' : 'Play',
      () => (type === 'tv' ? target && playEpisode(target.season, target.episode) : playMovie()), { class: 'jf-detailbtn jf-detailbtn--play' });
    const body = h('div', { class: 'jf-details__body' },
      h('h1', { class: 'jf-details__title' }, d.title),
      h('div', { class: 'jf-details__meta' },
        d.year && h('span', {}, d.year),
        d.contentRating && d.contentRating !== 'NR' && h('span', { class: 'jf-rating' }, d.contentRating),
        d.rating && h('span', { class: 'jf-star' }, icon('star'), d.rating)),
      h('div', { class: 'jf-details__buttons' }, play, favBtn),
      d.overview && h('p', { class: 'jf-details__overview' }, d.overview),
      h('table', { class: 'jf-details__info' },
        d.genres.length && h('tr', {}, h('th', {}, d.genres.length > 1 ? 'Genres' : 'Genre'), h('td', {}, d.genres.join(', '))),
        d.network && h('tr', {}, h('th', {}, 'Studio'), h('td', {}, d.network))));
    if (type === 'tv') {
      if (target) {
        const ep = allEps.find((x) => x.season === target.season && x.episode === target.episode) || target;
        body.append(section('Next Up', [card({ onclick: () => playEpisode(target.season, target.episode), shape: 'landscape', image: ep.thumb || d.backdrop, imageSize: ep.thumb ? 'w300' : 'w780', title: epLabel(target.season, target.episode, ep.title), progress: pctOf(target.season, target.episode) })]));
      }
      body.append(section('Seasons', d.seasons.map((s) => card({
        onclick: () => { location.hash = `season-${s.season}`; },
        image: s.poster || d.poster, title: s.season === 0 ? 'Specials' : `Season ${s.season}`,
        badge: unwatched(s) || null,
      }))));
    }
    main.replaceChildren(h('div', { class: 'jf-details' }, h('div', { class: 'jf-details__poster', style: d.poster ? { backgroundImage: `url("${img(d.poster, 'w500')}")` } : null }), body));
    setTimeout(() => play.focus({ preventScroll: true }), 0);
  }

  const unwatched = (s) => s.episodes.filter((e) => pctOf(e.season, e.episode) < 0.9).length;

  function season(n) {
    const s = d.seasons.find((x) => x.season === n);
    if (!s) return overview();
    const first = s.episodes.find((e) => pctOf(e.season, e.episode) < 0.9) || s.episodes[0];
    const play = iconButton('play', 'Play', () => playEpisode(first.season, first.episode), { class: 'jf-detailbtn jf-detailbtn--play' });
    const list = s.episodes.map((e) => {
      const pct = pctOf(e.season, e.episode);
      return h('button', { class: 'jf-episode', onclick: () => playEpisode(e.season, e.episode), 'aria-label': `${e.episode}. ${e.title}` },
        h('div', { class: 'jf-episode__thumb', style: e.thumb ? { backgroundImage: `url("${img(e.thumb, 'w300')}")` } : null },
          pct >= 0.9 && h('div', { class: 'jf-badge jf-badge--check' }, icon('check')),
          pct > 0.05 && pct < 0.9 && h('div', { class: 'jf-progress' }, h('div', { class: 'jf-progress__fill', style: { width: `${Math.round(pct * 100)}%` } }))),
        h('div', { class: 'jf-episode__text' },
          h('div', { class: 'jf-episode__title' }, `${e.episode}. ${e.title}`),
          e.airDate && h('div', { class: 'jf-episode__meta' }, e.airDate)));
    });
    main.replaceChildren(h('div', { class: 'jf-details' },
      h('div', { class: 'jf-details__poster', style: { backgroundImage: `url("${img(s.poster || d.poster, 'w500')}")` } }),
      h('div', { class: 'jf-details__body' },
        h('h1', { class: 'jf-details__title' }, d.title),
        h('div', { class: 'jf-details__subtitle' }, n === 0 ? 'Specials' : `Season ${n}`),
        h('div', { class: 'jf-details__buttons' }, play),
        h('div', { class: 'jf-episodes' }, list))));
    setTimeout(() => play.focus({ preventScroll: true }), 0);
  }

  const render = () => { app.scrollTop = 0; const m = /^#season-(\d+)$/.exec(location.hash); if (m) season(+m[1]); else overview(); };
  window.addEventListener('hashchange', render);
  render();
}
