(() => {
  // src/tv.css
  var tv_default = '/* 10-foot UI for the site on a 1920\xD71080 TV. Selectors: PRD Appendix A. */\nhtml.fc-tv { font-size: 20px; }\nhtml.fc-tv body { cursor: none; }\nhtml.fc-tv footer, html.fc-tv .back-to-top { display: none !important; }\n\n/* Focus is the only pointer on a TV: make it unmistakable. */\nhtml.fc-tv :focus { outline: 4px solid #18a2b8 !important; outline-offset: 3px; }\nhtml.fc-tv .cflip, html.fc-tv .fc-card { transition: transform .15s ease; }\nhtml.fc-tv .cflip:focus, html.fc-tv .fc-card:focus { transform: scale(1.08); z-index: 5; position: relative; }\nhtml.fc-tv tr.eplist:focus { background: rgba(24, 162, 184, .35) !important; outline-offset: -4px; }\nhtml.fc-tv tr.eplist td, html.fc-tv tr.eplist th { padding: .6rem .5rem; }\n\n/* Player fills the screen while open. */\nhtml.fc-tv .player:not(.hide) { position: fixed !important; inset: 0; z-index: 10000; margin: 0 !important; padding: 0 !important; border-radius: 0 !important; background: #000; }\nhtml.fc-tv .player:not(.hide) #player { width: 100vw !important; height: 100vh !important; }\n\n#fc-new-row { margin: 1rem 2rem 2rem; }\n#fc-new-row h2 { font-size: 1.6rem; margin: 0 0 .5rem; color: inherit; } /* site has light and dark themes */\n#fc-new-row .fc-row { display: flex; gap: 1.25rem; overflow-x: auto; padding: 1.25rem 1rem; } /* room for the focus zoom + ring, which the scroller clips */\n.fc-card { flex: 0 0 180px; display: grid; gap: .35rem; color: inherit; text-decoration: none; position: relative; }\n.fc-card img { width: 180px; aspect-ratio: 2 / 3; object-fit: cover; border-radius: 6px; background: #333; }\n.fc-card .fc-count { position: absolute; top: .4rem; right: .4rem; background: #d9534f; color: #fff; border-radius: 10px; padding: 2px 8px; font-size: .75rem; }\n.fc-card .fc-title { font-size: .9rem; line-height: 1.2; }\n\n.fc-toast { position: fixed; left: 50%; bottom: 3rem; transform: translateX(-50%); z-index: 2147483647; background: rgba(20, 20, 20, .92); color: #fff; padding: .75rem 1.5rem; border-radius: 8px; font: 600 1.1rem system-ui, sans-serif; }\n\n/* Our overlays (content/player.js): bigger for the sofa; the button inside shows focus, not the whole card. */\nhtml.fc-tv #player > div[style*="2147483647"] { zoom: 1.5; }\nhtml.fc-tv #player > div[style*="2147483647"]:focus { outline: none !important; }\n\n/* Launcher (docs/index.html): choose the site address. */\nhtml.fc-launcher, html.fc-launcher body { margin: 0; height: 100%; background: #111; color: #eee; }\n.fc-launch { height: 100%; display: grid; place-content: center; gap: 1.5rem; text-align: center; font: 1.4rem/1.4 system-ui, sans-serif; }\n.fc-launch h1 { font-size: 3rem; margin: 0; }\n.fc-launch .fc-opening { font-size: 2rem; margin: 0; }\n.fc-launch .fc-hint { color: #aaa; margin: 0; }\n.fc-launch .fc-red { color: #fff; background: #d9534f; border-radius: 6px; padding: 0 .4em; }\n.fc-form { display: grid; gap: .75rem; width: 36rem; margin: 0 auto; text-align: left; }\n.fc-form label { font-weight: 600; }\n.fc-form input { font: inherit; font-size: 1.6rem; padding: .6rem .8rem; border-radius: 8px; border: 2px solid #555; background: #222; color: #fff; }\n.fc-form button { font: inherit; font-weight: 600; padding: .7rem; border-radius: 8px; border: 0; background: #18a2b8; color: #fff; }\n.fc-form .fc-error { color: #ff8a80; min-height: 1.4em; margin: 0; }\n';

  // src/nav.js
  var DIRS = {
    left: { axis: "x", sign: -1 },
    right: { axis: "x", sign: 1 },
    up: { axis: "y", sign: -1 },
    down: { axis: "y", sign: 1 }
  };
  var center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  function pickNext(from, candidates2, dir) {
    const { axis, sign } = DIRS[dir];
    const other = axis === "x" ? "y" : "x";
    const lo = other === "x" ? "left" : "top";
    const size = other === "x" ? "width" : "height";
    const a = center(from);
    const scored = [];
    for (const c of candidates2) {
      const b = center(c.rect);
      const along = (b[axis] - a[axis]) * sign;
      if (along <= 1) continue;
      const gap = Math.max(0, c.rect[lo] - (from[lo] + from[size]), from[lo] - (c.rect[lo] + c.rect[size]));
      scored.push({ c, along, gap, off: Math.abs(b[other] - a[other]) });
    }
    const inLine = scored.filter((s) => s.gap === 0);
    const pool = inLine.length ? inLine : scored;
    let best = null;
    let bestScore = Infinity;
    for (const s of pool) {
      const score = s.along + s.gap * 2 + s.off * 0.1;
      if (score < bestScore) {
        bestScore = score;
        best = s.c;
      }
    }
    return best;
  }
  var FOCUSABLE = 'a[href], button, input, select, textarea, [role="button"], .cflip, tr.eplist, .watch-season';
  var NEVER = ".resetwatchedep, .resetwatchedall";
  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && !el.closest(".hide, [hidden]");
  }
  function overlayRoots() {
    return [...document.querySelectorAll("#player > div")].map((h2) => h2.shadowRoot).filter(Boolean);
  }
  function candidates() {
    const roots = overlayRoots();
    const modal = roots.find((r) => r.querySelector('[aria-modal="true"]'));
    const inside = roots.find((r) => {
      var _a;
      return r === ((_a = activeEl()) == null ? void 0 : _a.getRootNode());
    });
    const scope = modal ? [modal] : inside ? [inside] : [document, ...roots];
    const els = scope.flatMap((root) => [...root.querySelectorAll(FOCUSABLE)]).filter((el) => !el.matches(NEVER) && visible(el));
    const set = new Set(els);
    const nested = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return true;
      return false;
    };
    return els.filter((el) => !nested(el)).map((el) => ({ el, rect: el.getBoundingClientRect() }));
  }
  function focusEl(el) {
    if (!el.matches("a[href], button, input, select, textarea") && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }
  function activeEl() {
    var _a;
    let el = document.activeElement;
    while ((_a = el == null ? void 0 : el.shadowRoot) == null ? void 0 : _a.activeElement) el = el.shadowRoot.activeElement;
    return el && el !== document.body ? el : null;
  }
  function move(dir) {
    var _a;
    const list = candidates();
    if (!list.length) return false;
    const cur = activeEl();
    const from = cur && list.some((c) => c.el === cur) ? cur.getBoundingClientRect() : { left: 0, top: -1, width: 0, height: 0 };
    const next = (_a = pickNext(from, list, cur ? dir : "down")) != null ? _a : cur ? null : list[0];
    if (next) focusEl(next.el);
    return !!next;
  }

  // ../scan.js
  var WEEK = 7 * 864e5;
  var day = (ms) => new Date(ms).toISOString().slice(0, 10);
  var countNew = (episodes, lastSeenAt, now = Date.now()) => episodes.filter((e) => e.airDate && e.airDate > day(lastSeenAt) && e.airDate <= day(now)).length;
  var queue = Promise.resolve();

  // src/episodes.js
  function parseAirDate(text) {
    const m = /(\d{2})\/(\d{2})\/(\d{2})\b/.exec(text || "");
    return m ? `20${m[3]}-${m[1]}-${m[2]}` : null;
  }
  function parseShowPage(doc) {
    var _a, _b;
    const og = (p) => {
      var _a2, _b2;
      return (_b2 = (_a2 = doc.querySelector(`meta[property="og:${p}"]`)) == null ? void 0 : _a2.content) != null ? _b2 : "";
    };
    const m = /^Watch all Episodes of (.+) \((\d{4})\)/.exec(og("title"));
    const eps = [...doc.querySelectorAll("tr.eplist")].map((r) => {
      var _a2;
      return {
        season: +r.dataset.pes,
        episode: +r.dataset.pep,
        airDate: parseAirDate((_a2 = r.querySelector(".hidden-md-up")) == null ? void 0 : _a2.textContent)
      };
    });
    return { title: (_a = m == null ? void 0 : m[1]) != null ? _a : null, year: (_b = m == null ? void 0 : m[2]) != null ? _b : null, slug: og("url").split("/").pop(), poster: og("image").split("/").pop(), eps };
  }
  var KEY = "fc-tv-shows";
  var load = () => {
    var _a;
    try {
      return (_a = JSON.parse(localStorage.getItem(KEY))) != null ? _a : {};
    } catch {
      return {};
    }
  };
  var save = (shows) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(shows));
    } catch {
    }
  };
  var favoritePids = () => Object.keys(localStorage).filter((k) => k.startsWith("bm:t:")).map((k) => k.slice(5));
  var SCAN_EVERY = 6 * 36e5;
  var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function scan(force) {
    var _a;
    const pids = favoritePids();
    const shows = load();
    if (pids.length) {
      for (const pid of Object.keys(shows)) if (!pids.includes(pid)) delete shows[pid];
    }
    for (const pid of pids) {
      const s = (_a = shows[pid]) != null ? _a : shows[pid] = { lastSeenAt: Date.now() };
      if (!force && s.scannedAt && Date.now() - s.scannedAt < SCAN_EVERY) continue;
      try {
        const html = await (await fetch(`/watch/tv/${pid}`)).text();
        Object.assign(s, parseShowPage(new DOMParser().parseFromString(html, "text/html")), { scannedAt: Date.now() });
        save(shows);
      } catch (e) {
        console.warn("[viewbox-tv] scan failed", pid, e);
      }
      await sleep(300);
    }
    save(shows);
    return counts(shows);
  }
  function counts(shows = load()) {
    const out = {};
    for (const [pid, s] of Object.entries(shows)) out[pid] = s.eps ? countNew(s.eps, s.lastSeenAt) : 0;
    return out;
  }
  function markSeen(pid) {
    const shows = load();
    if (!shows[pid]) return;
    shows[pid].lastSeenAt = Date.now();
    save(shows);
  }

  // src/launcher.js
  var SITE_KEY = "fc-site";
  var RED = 403;
  var SPLASH_MS = 3e3;
  var isLauncher = () => !!document.querySelector('meta[name="fc-launcher"]');
  function normalizeSite(input) {
    const raw = (input || "").trim();
    if (!raw) return null;
    try {
      const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
      return `${u.origin}/home`;
    } catch {
      return null;
    }
  }
  var saved = () => {
    try {
      return localStorage.getItem(SITE_KEY);
    } catch {
      return null;
    }
  };
  function runLauncher() {
    document.documentElement.classList.add("fc-tv", "fc-launcher");
    document.body.innerHTML = '<main class="fc-launch" aria-live="polite"></main>';
    const main = document.querySelector(".fc-launch");
    const site = saved();
    if (site) splash(main, site);
    else form(main);
  }
  function splash(main, site) {
    main.innerHTML = '<h1>Viewbox TV</h1><p class="fc-opening"></p><p class="fc-hint">Press the <span class="fc-red">Red</span> button to change the address</p>';
    main.querySelector(".fc-opening").textContent = `Opening ${new URL(site).host}\u2026`;
    const go = setTimeout(() => location.replace(site), SPLASH_MS);
    const onKey = (e) => {
      if (e.keyCode !== RED && e.key !== "r") return;
      e.preventDefault();
      clearTimeout(go);
      window.removeEventListener("keydown", onKey, true);
      form(main);
    };
    window.addEventListener("keydown", onKey, true);
  }
  function form(main) {
    main.innerHTML = `
    <h1>Viewbox TV</h1>
    <form class="fc-form" novalidate>
      <label for="fc-site">Site address</label>
      <input id="fc-site" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="example.com">
      <p class="fc-error" role="alert"></p>
      <button type="submit">Open</button>
    </form>
    <p class="fc-hint">Select the box and press Enter to type. You can change this later with the <span class="fc-red">Red</span> button on the start screen.</p>`;
    const input = main.querySelector("input");
    const button = main.querySelector("button");
    const error = main.querySelector(".fc-error");
    input.value = saved() ? new URL(saved()).host : "";
    input.focus();
    main.addEventListener("keydown", (e) => {
      if (e.keyCode === 40 && document.activeElement === input) {
        e.preventDefault();
        button.focus();
      } else if (e.keyCode === 38 && document.activeElement === button) {
        e.preventDefault();
        input.focus();
      }
    });
    main.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const site = normalizeSite(input.value);
      if (!site) {
        error.textContent = "That doesn't look like a web address. Try something like example.com.";
        input.focus();
        return;
      }
      try {
        localStorage.setItem(SITE_KEY, site);
      } catch {
      }
      location.replace(site);
    });
  }

  // src/shell/jellyfin.css
  var jellyfin_default = `/* Jellyfin TV-layout look, written from measurements in tv/JELLYFIN_STYLE.md (no jellyfin-web code copied). */
:root {
  --jf-bg: #101010;
  --jf-header: #202020;
  --jf-accent: #00a4dc;
  --jf-focus: #7fdcd4; /* light teal ring on the focused card (user request; not in Jellyfin) */
  --jf-text: rgba(255, 255, 255, .8);
  --jf-text-2: rgba(255, 255, 255, .5);
  --jf-font: "Noto Sans", "SamsungOne", "Samsung Sans", Roboto, "Segoe UI", sans-serif;
  --jf-pad: 63px;
}

/* The site's page stays in the DOM (data + player) but is invisible; only our app, OSD and toasts show. */
html.fc-shell, html.fc-shell body { background: var(--jf-bg) !important; overflow: hidden !important; }
html.fc-shell body > *:not(#fc-app):not(#fc-osd):not(.fc-toast) { visibility: hidden !important; }
html.fc-shell body { background-image: none !important; }
#fc-app { position: fixed; inset: 0; z-index: 9000; overflow-y: auto; overflow-x: hidden; background: var(--jf-bg); color: var(--jf-text); font: 400 20px/27px var(--jf-font); scrollbar-width: none; }
#fc-app::-webkit-scrollbar { display: none; }
#fc-app *, #fc-osd * { box-sizing: border-box; }
#fc-app a { color: inherit; text-decoration: none; }
#fc-app button, #fc-osd button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
#fc-app :focus, #fc-osd :focus { outline: none !important; }

/* Player on top while something plays. */
html.fc-playing #fc-app { visibility: hidden; }
html.fc-shell .player { visibility: hidden !important; }
html.fc-playing .player:not(.hide) { visibility: visible !important; position: fixed !important; inset: 0; z-index: 10000; margin: 0 !important; padding: 0 !important; border-radius: 0 !important; background: #000; }
html.fc-playing .player:not(.hide) #player { width: 100vw !important; height: 100vh !important; }

/* Header */
.jf-header { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; height: 87px; padding: 0 32px; background: var(--jf-header); }
.jf-header__left, .jf-header__right { flex: 1; display: flex; align-items: center; gap: 8px; }
.jf-header__right { justify-content: flex-end; gap: 12px; }
.jf-logo { font-weight: 700; font-size: 26px; color: #fff; letter-spacing: .02em; background: linear-gradient(135deg, #aa5cc3, #00a4dc); -webkit-background-clip: text; background-clip: text; color: transparent; padding-left: 8px; }
.jf-header__title { font-size: 22px; color: var(--jf-text); margin-left: 16px; }
.jf-tabs { display: flex; }
.jf-tab { font-weight: 600; font-size: 20px; line-height: 25px; padding: 30px; color: #999; }
.jf-tab--active { color: #fff; }
.jf-tab:focus { color: #fff; background: var(--jf-accent); }
.jf-clock { font-size: 20px; color: var(--jf-text); margin-left: 12px; }
.jf-iconbtn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 56px; height: 56px; padding: 0 14px !important; border-radius: 4.3px; color: #fff !important; }
.jf-iconbtn:focus { background: var(--jf-accent) !important; }
.jf-icon { width: 30px; height: 30px; fill: currentColor; flex: none; }

/* Sections, rows, grids */
.jf-main { padding-bottom: 60px; }
.jf-section { margin: 0; }
.jf-section__title { font: 400 30px/40.5px var(--jf-font); color: var(--jf-text); margin: 0; padding: 15px 0 6px var(--jf-pad); }
.jf-center { text-align: center; padding-left: 0; }
.jf-row { display: flex; overflow-x: auto; overflow-y: visible; padding: 12px var(--jf-pad) 36px; scrollbar-width: none; scroll-padding: 0 var(--jf-pad); }
.jf-row::-webkit-scrollbar { display: none; }
.jf-grid { display: flex; flex-wrap: wrap; padding: 12px var(--jf-pad) 24px; }
.jf-empty { padding: 24px var(--jf-pad); color: var(--jf-text-2); }

/* Cards: focus = the box zooms 1.07, no outline (Jellyfin TV). */
.jf-card { flex: none; display: block; margin: 0 24px 0 0; text-align: center; scroll-margin: 140px 0 60px; } /* keep focused items clear of the sticky header */
.jf-card__box { transition: transform .2s ease-out; }
.jf-card:focus { position: relative; z-index: 10; }
.jf-card:focus .jf-card__box { transform: scale(1.07); }
.jf-card:focus .jf-card__img { box-shadow: 0 0 0 4px var(--jf-focus); }
.jf-card__img { position: relative; border-radius: 4px; background: #242424 center / cover no-repeat; overflow: hidden; }
.jf-card--portrait { width: 262px; }
.jf-card--portrait .jf-card__img { height: 393px; }
.jf-card--landscape { width: 427px; }
.jf-card--landscape .jf-card__img { height: 240px; }
.jf-grid .jf-card { margin-bottom: 36px; }
.jf-card__fallback { position: absolute; inset: 0; display: grid; place-items: center; padding: 12px; font-size: 28px; font-weight: 600; color: #fff; }
.jf-card__title { font-size: 20px; padding: 4.8px 10px 1.2px; color: var(--jf-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jf-card__sub { font-size: 17.2px; color: var(--jf-text-2); padding: 0 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jf-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 5.6px; background: rgba(51, 51, 51, .8); }
.jf-progress__fill { height: 100%; background: var(--jf-accent); }
.jf-badge { position: absolute; top: 8px; right: 8px; min-width: 34px; height: 34px; padding: 0 6px; border-radius: 17px; background: var(--jf-accent); color: #fff; font-size: 18px; line-height: 34px; text-align: center; }
.jf-badge--check { display: grid; place-items: center; padding: 0; }
.jf-badge--check .jf-icon { width: 24px; height: 24px; }

/* Details */
.jf-details { display: flex; gap: 47px; padding: 0 60px 0 96px; }
.jf-details__poster { flex: none; width: 480px; height: 720px; margin-top: -3px; border-radius: 4px; background: #242424 center / cover no-repeat; position: sticky; top: 0; }
.jf-details__body { flex: 1; min-width: 0; padding-top: 0; }
.jf-details__title { font: 600 36px/48.6px var(--jf-font); color: var(--jf-text); margin: 0; }
.jf-details__subtitle { font-size: 22px; font-weight: 600; margin-top: 4px; }
.jf-details__meta { display: flex; align-items: center; gap: 20px; font-size: 20px; margin: 4px 0 14px; }
.jf-rating { font-size: 18.4px; color: #ddd; background: rgba(170, 170, 190, .2); border-radius: 4.6px; padding: 4px 9px; }
.jf-star { display: inline-flex; align-items: center; gap: 4px; }
.jf-star .jf-icon { width: 24px; height: 24px; fill: #f2b01e; }
.jf-details__buttons { display: flex; gap: 0; margin: 0 0 40px -8px; }
.jf-detailbtn { width: 71px; height: 65px; padding: 0 !important; }
.jf-iconbtn--on .jf-icon { fill: #e53935; }
.jf-details__overview { margin: 60px 0 30px; max-width: 1240px; font-size: 20px; line-height: 27px; }
.jf-details__info { border-collapse: collapse; margin-bottom: 20px; }
.jf-details__info th { text-align: left; font-weight: 400; padding: 5px 80px 5px 0; }
.jf-details__info td { font-weight: 600; padding: 5px 0; }
.jf-details .jf-section__title, .jf-details .jf-row { padding-left: 0; }
.jf-episodes { display: grid; gap: 10px; }
.jf-episode { scroll-margin: 140px 0 60px; display: flex; gap: 30px; align-items: center; text-align: left; padding: 0; border-radius: 4px; }
.jf-episode:focus { background: rgba(255, 255, 255, .08); }
.jf-episode:focus .jf-episode__thumb { box-shadow: 0 0 0 4px var(--jf-focus); }
.jf-episode__thumb { position: relative; flex: none; width: 576px; height: 324px; border-radius: 4px; background: #242424 center / cover no-repeat; overflow: hidden; }
.jf-episode__title { font-size: 30px; color: var(--jf-text); }
.jf-episode__meta { font-size: 20px; color: rgba(255, 255, 255, .6); margin-top: 6px; }

/* Library toolbar */
.jf-toolbar { display: flex; justify-content: center; align-items: center; gap: 24px; padding: 60px 0 12px; font-size: 20px; }
.jf-toolbar__sort span { font-size: 18px; }

/* Search */
.jf-search__bar { display: flex; align-items: center; gap: 12px; width: 1150px; margin: 80px auto 8px; }
.jf-search__icon { width: 36px; height: 36px; fill: var(--jf-text); }
.jf-search__input { flex: 1; height: 52px; font: 400 22px var(--jf-font); color: #fff; background: #1c1c1c; border: 3px solid #333; border-radius: 4px; padding: 0 8px; }
.jf-search__input:focus { border-color: var(--jf-accent); outline: none; }
.jf-keys { display: grid; justify-content: center; gap: 2px; margin-bottom: 30px; }
.jf-keys__row { display: flex; justify-content: center; gap: 4px; }
.jf-key { min-width: 28px; height: 32px; padding: 0 5px !important; font-size: 20px; color: rgba(255, 255, 255, .6) !important; border-radius: 3px; }
.jf-key .jf-icon { width: 22px; height: 22px; }
.jf-key:focus { background: var(--jf-accent) !important; color: #fff !important; }
.jf-suggestions { display: grid; justify-items: center; gap: 4px; }
.jf-suggestion { color: var(--jf-accent) !important; font-weight: 600; font-size: 20px; padding: 10px 12px; border-radius: 4px; }
.jf-suggestion:focus { background: var(--jf-accent); color: #fff !important; }

/* Player OSD */
#fc-osd { position: fixed; inset: 0; z-index: 10001; pointer-events: none; color: #fff; font: 400 20px var(--jf-font); opacity: 0; transition: opacity .2s; }
#fc-osd.jf-osd--on { opacity: 1; }
#fc-osd:not(.jf-osd--on) * { visibility: hidden; }
.jf-osd__top { position: absolute; top: 0; left: 0; right: 0; height: 150px; display: flex; align-items: flex-start; gap: 16px; padding: 22px 32px; background: linear-gradient(rgba(15, 15, 15, .75), rgba(15, 15, 15, 0)); pointer-events: auto; }
.jf-osd__title { font-size: 23.4px; line-height: 56px; }
.jf-osd__top .jf-clock { line-height: 56px; }
.jf-osd__spacer { flex: 1; }
.jf-osd__bottom { position: absolute; left: 0; right: 0; bottom: 0; padding: 60px 16px 24px; background: linear-gradient(rgba(10, 10, 10, 0), rgba(10, 10, 10, .85)); pointer-events: auto; }
.jf-osd__timeline { display: flex; align-items: center; gap: 12px; padding: 0 10px; }
.jf-osd__time { font-size: 20px; min-width: 60px; }
.jf-slider { flex: 1; height: 38px; display: flex; align-items: center; padding: 0 10px !important; border-radius: 19px; }
.jf-slider__track { position: relative; flex: 1; height: 4px; background: rgba(255, 255, 255, .25); }
.jf-slider__fill { height: 100%; background: var(--jf-accent); }
.jf-slider__thumb { position: absolute; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; background: var(--jf-accent); }
.jf-slider:focus .jf-slider__thumb { transform: scale(1.4); box-shadow: 0 0 0 4px rgba(0, 164, 220, .35); }
.jf-osd__buttons { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
.jf-osd__ends { margin-left: 50px; }

/* Up Next card + "Are you still watching?" (content/player.js shadow parts) in the Jellyfin look. */
html.fc-shell #player > div::part(box) { background: rgba(16, 16, 16, .95); border-radius: 4px; font-family: var(--jf-font); box-shadow: none; }
html.fc-shell #player > div::part(play) { background: var(--jf-accent); color: #fff; border-radius: 4.3px; }
html.fc-shell #player > div::part(cancel) { background: rgba(255, 255, 255, .12); border-radius: 4.3px; }
html.fc-shell #player > div::part(title) { font-weight: 600; }

.fc-toast { position: fixed; left: 50%; bottom: 3rem; transform: translateX(-50%); z-index: 2147483647; background: rgba(20, 20, 20, .92); color: #fff; padding: .75rem 1.5rem; border-radius: 8px; font: 600 1.1rem system-ui, sans-serif; }

/* Header sign-in link (shown when signed out) */
.jf-signin { font-weight: 600; font-size: 20px; color: #fff !important; background: var(--jf-accent); border-radius: 4.3px; padding: 8px 18px; margin-right: 8px; }
.jf-signin:focus { box-shadow: 0 0 0 4px var(--jf-focus); }

/* Settings */
.jf-settings { max-width: 1100px; margin: 0 auto; padding-top: 30px; }
.jf-settings__section { padding: 10px 0 30px; border-bottom: 1px solid rgba(255, 255, 255, .08); }
.jf-settings .jf-section__title { padding-left: 0; }
.jf-settings__status { margin: 6px 0 16px; }
.jf-settings__form { display: grid; gap: 14px; max-width: 640px; }
.jf-settings__msg { min-height: 27px; margin: 0; color: var(--jf-accent); }
.jf-settings__about { color: var(--jf-text-2); font-size: 17px; margin: 4px 0; word-break: break-all; }
.jf-field { display: grid; gap: 6px; }
.jf-field__label { font-size: 18px; color: var(--jf-text-2); }
.jf-input { height: 56px; font: 400 22px var(--jf-font); color: #fff; background: #1c1c1c; border: 3px solid #333; border-radius: 4px; padding: 0 12px; }
.jf-input:focus { border-color: var(--jf-accent); outline: none; }
.jf-input--code { letter-spacing: .12em; text-transform: uppercase; max-width: 320px; }
.jf-button { justify-self: start; min-width: 160px; height: 56px; padding: 0 28px !important; border-radius: 4.3px; background: rgba(255, 255, 255, .12) !important; color: #fff !important; font-weight: 600 !important; display: inline-flex; align-items: center; justify-content: center; }
.jf-button:focus { background: var(--jf-accent) !important; }
.jf-button--inline { margin-left: 12px; height: 48px; }
.jf-toggle { display: inline-flex; align-items: center; gap: 16px; padding: 10px 12px !important; border-radius: 4.3px; font-size: 20px; }
.jf-toggle::before { content: ''; width: 52px; height: 28px; border-radius: 14px; background: #444; box-shadow: inset 0 0 0 2px #555; transition: background .15s; }
.jf-toggle--on::before { background: var(--jf-accent); }
.jf-toggle:focus { background: rgba(255, 255, 255, .1) !important; box-shadow: 0 0 0 3px var(--jf-focus); }
`;

  // src/shell/data.js
  var IMG = "https://img.xcdn.to/t/p";
  var unescape = (s) => String(s || "").replace(/\\(['"])/g, "$1");
  var img = (file, size = "w342") => file ? `${IMG}/${size}/${String(file).replace(/^\//, "")}` : "";
  function parsePos(key, value) {
    const k = key.split(":");
    const v = String(value || "").split(":").map(Number);
    if (k[0] !== "pos" || !k[1] || v.length < 3 || !(v[1] > 0)) return null;
    const e = { pid: k[1], pos: v[0], dur: v[1], ts: v[2] * 1e3, pct: v[0] / v[1] };
    if (k.length >= 4) Object.assign(e, { type: "tv", season: +k[2], episode: +k[3] });
    else e.type = "movie";
    return e;
  }
  var STARTED = 0.05;
  var FINISHED = 0.9;
  function continueWatching(entries) {
    const seen = /* @__PURE__ */ new Set();
    return entries.filter((e) => e.pct > STARTED && e.pct < FINISHED).sort((a, b) => b.ts - a.ts).filter((e) => seen.has(e.pid) ? false : seen.add(e.pid));
  }
  function nextUp(entries, epsByPid) {
    const latest = /* @__PURE__ */ new Map();
    for (const e of entries.filter((x) => x.type === "tv").sort((a, b) => b.ts - a.ts)) if (!latest.has(e.pid)) latest.set(e.pid, e);
    const out = [];
    for (const e of latest.values()) {
      if (e.pct < FINISHED) continue;
      const eps = (epsByPid[e.pid] || []).filter((x) => x.season > 0).sort((a, b) => a.season - b.season || a.episode - b.episode);
      const i = eps.findIndex((x) => x.season === e.season && x.episode === e.episode);
      if (i >= 0 && eps[i + 1]) out.push({ ...eps[i + 1], pid: e.pid, ts: e.ts });
    }
    return out;
  }
  function progressIndex(entries) {
    const idx = { movie: {}, show: {}, episode: {} };
    const inProgress = (pct) => pct > STARTED && pct < FINISHED;
    const latest = {};
    for (const e of entries) {
      if (e.type === "movie") {
        if (inProgress(e.pct)) idx.movie[e.pid] = e.pct;
        continue;
      }
      if (inProgress(e.pct)) idx.episode[`${e.pid}:${e.season}:${e.episode}`] = e.pct;
      if (!latest[e.pid] || e.ts > latest[e.pid].ts) latest[e.pid] = e;
    }
    for (const [pid, e] of Object.entries(latest)) if (inProgress(e.pct)) idx.show[pid] = e.pct;
    return idx;
  }
  var progressOf = (idx, c) => (c.type === "movie" ? idx.movie[c.pid] : c.season ? idx.episode[`${c.pid}:${c.season}:${c.episode}`] : idx.show[c.pid]) || 0;
  var backdropFromHtml = (html) => (/url\("?https:\/\/img\.xcdn\.to\/t\/p\/w1280\/([A-Za-z0-9_-]+\.jpg)/.exec(html) || [])[1] || null;
  function parseCards(root) {
    return [...root.querySelectorAll(".cflip[data-href]")].map((c) => {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      const href = c.dataset.href;
      const [, , type, pid, slug, , season, , episode] = href.split("/");
      const poster = (((_a = c.querySelector("img.card-img-top")) == null ? void 0 : _a.getAttribute("src")) || ((_b = c.querySelector("img[data-src]")) == null ? void 0 : _b.dataset.src) || "").split("/").pop();
      const badge = ((_c = c.querySelector(".card-badge.top .badge")) == null ? void 0 : _c.textContent.trim()) || "";
      return {
        href,
        pid,
        slug,
        type: type === "movie" ? "movie" : "tv",
        title: unescape(((_e = (_d = c.querySelector("img")) == null ? void 0 : _d.alt) == null ? void 0 : _e.trim()) || ((_f = c.querySelector(".card-footer")) == null ? void 0 : _f.textContent.trim()) || ""),
        year: /^\d{4}$/.test(badge) ? badge : ((_g = c.querySelector(".card-text.t12")) == null ? void 0 : _g.textContent.trim()) || "",
        poster,
        season: season ? +season : null,
        episode: episode ? +episode : null,
        rating: ((_h = c.querySelector(".card-badge.bottom .badge")) == null ? void 0 : _h.textContent.trim()) || ""
      };
    });
  }
  function parseHero(root) {
    return [...root.querySelectorAll(".carousel-item")].map((s) => {
      var _a, _b;
      const cap = s.querySelector(".carousel-caption-container[data-href]");
      const bg = /\/t\/p\/original\/([A-Za-z0-9_-]+\.jpg)/.exec(s.getAttribute("style") || "");
      return cap && {
        href: cap.dataset.href,
        title: ((_a = cap.querySelector(".font-weight-normal")) == null ? void 0 : _a.textContent.trim()) || "",
        overview: ((_b = cap.querySelector(".t16")) == null ? void 0 : _b.textContent.trim()) || "",
        backdrop: bg ? bg[1] : null
      };
    }).filter(Boolean);
  }
  function parseHome(root) {
    const row = (k) => parseCards(root.querySelector(`.contentList${k}`) || root.createElement("div"));
    return { hero: parseHero(root), popular: row("R"), latest: row("E"), tv: row("T"), movies: row("M") };
  }
  var lastPage = (root) => Math.max(1, ...[...root.querySelectorAll(".searchnav[data-p]")].map((a) => +a.dataset.p || 1));
  function parseDetails(doc, html) {
    var _a, _b, _c, _d, _e;
    const ov = doc.querySelector(".section-watch-overview");
    const badge = (title) => {
      var _a2;
      return ((_a2 = [...(ov == null ? void 0 : ov.querySelectorAll(".badge[title]")) || []].find((b) => b.title === title)) == null ? void 0 : _a2.textContent.trim()) || "";
    };
    const header2 = ov == null ? void 0 : ov.querySelector(".watch-header");
    const links = (type) => [...(ov == null ? void 0 : ov.querySelectorAll(`.show.link[data-type="${type}"]`)) || []].map((a) => a.textContent.trim());
    const seasons = [...doc.querySelectorAll(".section-watch-season")].map((sec) => {
      var _a2, _b2, _c2;
      const rows = [...sec.querySelectorAll("tr.eplist")].map((r) => {
        var _a3, _b3, _c3;
        return {
          season: +r.dataset.pes,
          episode: +r.dataset.pep,
          epid: +r.dataset.epid,
          title: ((_a3 = r.querySelector(".epTitle")) == null ? void 0 : _a3.textContent.trim()) || "",
          thumb: (((_b3 = r.querySelector("img.watch-episode-thumb")) == null ? void 0 : _b3.dataset.img) || "").replace(/^\//, ""),
          airDate: ((_c3 = r.querySelector(".hidden-md-up")) == null ? void 0 : _c3.textContent.trim()) || ""
        };
      }).sort((a, b) => a.episode - b.episode);
      const poster = (((_a2 = sec.querySelector("img.watch-season-thumb")) == null ? void 0 : _a2.dataset.img) || "").replace(/^\//, "");
      return { season: (_c2 = (_b2 = rows[0]) == null ? void 0 : _b2.season) != null ? _c2 : null, poster, episodes: rows };
    }).filter((s) => s.season !== null).sort((a, b) => a.season - b.season);
    return {
      slug: (((_a = doc.querySelector('meta[property="og:url"]')) == null ? void 0 : _a.content) || "").split("/").pop(),
      title: ((_b = header2 == null ? void 0 : header2.childNodes[0]) == null ? void 0 : _b.textContent.trim()) || "",
      year: (/\((\d{4})\)/.exec((header2 == null ? void 0 : header2.textContent) || "") || [])[1] || "",
      poster: (((_c = ov == null ? void 0 : ov.querySelector("img[data-img]")) == null ? void 0 : _c.dataset.img) || "").replace(/^\//, ""),
      backdrop: backdropFromHtml(html),
      overview: ((_d = ov == null ? void 0 : ov.querySelector(".moreless-content")) == null ? void 0 : _d.textContent.trim()) || "",
      rating: ((_e = ov == null ? void 0 : ov.querySelector('.badge[title^="Rated"]')) == null ? void 0 : _e.textContent.trim()) || "",
      contentRating: badge("US Content Rating"),
      genres: links("genre"),
      network: links("network")[0] || "",
      seasons,
      similar: parseCards(doc.querySelector(".section-watch-recomm") || doc.createElement("div"))
    };
  }
  var toDoc = (html) => new DOMParser().parseFromString(html, "text/html");
  async function get(url) {
    const r = await fetch(url, { credentials: "same-origin" });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.text();
  }
  async function library(kind, page = 1, sort = "latest") {
    const doc = toDoc(await get(`/show/${kind === "movies" ? "movies" : "tvshows"}?page=${page}&sort=${sort}&ajax=1`));
    return { cards: parseCards(doc), lastPage: lastPage(doc) };
  }
  async function search(query, page = 1) {
    const doc = toDoc(await get(`/search/${encodeURIComponent(query)}?ajax=1&tab=movies,tvshows${page > 1 ? `&page=${page}` : ""}`));
    return { cards: parseCards(doc), lastPage: lastPage(doc) };
  }
  async function details(type, pid) {
    const html = await get(`/watch/${type === "movie" ? "movie" : "tv"}/${pid}`);
    return parseDetails(toDoc(html), html);
  }
  function watchEntries(storage = localStorage) {
    const out = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith("pos:")) {
        const e = parsePos(k, storage.getItem(k));
        if (e) out.push(e);
      }
    }
    return out;
  }
  var META_KEY = "fc-tv-meta";
  var metaCache = {
    all() {
      try {
        return JSON.parse(localStorage.getItem(META_KEY)) || {};
      } catch {
        return {};
      }
    },
    put(pid, m) {
      const all = this.all();
      all[pid] = { ...all[pid], ...m, ts: Date.now() };
      try {
        localStorage.setItem(META_KEY, JSON.stringify(all));
      } catch {
      }
    }
  };

  // src/shell/ui.js
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return el;
  }
  var ICONS = {
    play: "M8 5v14l11-7z",
    pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
    rewind: "M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z",
    forward: "M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z",
    back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
    home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
    heart: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
    next: "M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z",
    prev: "M6 6h2v12H6zm3.5 6l8.5 6V6z",
    volume: "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
    mute: "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z",
    cc: "M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z",
    hd: "M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-8 12H9.5v-2h-2v2H6V9h1.5v2.5h2V9H11v6zm2-6h4c.55 0 1 .45 1 1v4c0 .55-.45 1-1 1h-4V9zm1.5 4.5h2v-3h-2v3z",
    backspace: "M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15a2 2 0 002-2V5a2 2 0 00-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z",
    sort: "M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z",
    tv: "M21 3H3a2 2 0 00-2 2v12a2 2 0 002 2h5v2h8v-2h5a2 2 0 001.99-2L23 5a2 2 0 00-2-2zm0 14H3V5h18v12z",
    movie: "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4a2 2 0 00-1.99 2L2 18a2 2 0 002 2h16a2 2 0 002-2V4h-4z",
    person: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
    star: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
  };
  function icon(name, cls = "") {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", `jf-icon ${cls}`);
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", ICONS[name] || "");
    svg.appendChild(p);
    return svg;
  }
  var iconButton = (name, label, onclick, extra = {}) => h("button", { class: `jf-iconbtn ${extra.class || ""}`, "aria-label": label, title: label, onclick, ...extra.attrs }, icon(name));
  var clock = () => {
    const el = h("span", { class: "jf-clock" });
    const tick = () => {
      const d = /* @__PURE__ */ new Date();
      el.textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    tick();
    setInterval(tick, 15e3);
    return el;
  };
  var fmtTime = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
    return hh ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`;
  };
  var endsAt = (secondsLeft) => {
    const d = new Date(Date.now() + secondsLeft * 1e3);
    return `Ends at ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  var epLabel = (s, e, title) => `S${s}:E${e}${title ? ` - ${title}` : ""}`;
  function card({ href, onclick, image, imageSize = "w342", title, sub, progress: progress2, badge, shape = "portrait", label }) {
    const bg = image ? { backgroundImage: `url("${image.startsWith("http") ? image : img(image, imageSize)}")` } : null;
    const inner = h(
      "div",
      { class: "jf-card__box" },
      h(
        "div",
        { class: "jf-card__img", style: bg },
        !image && h("div", { class: "jf-card__fallback" }, title),
        progress2 > 0 && h("div", { class: "jf-progress" }, h("div", { class: "jf-progress__fill", style: { width: `${Math.round(progress2 * 100)}%` } })),
        badge && h("div", { class: "jf-badge" }, badge)
      ),
      h("div", { class: "jf-card__title" }, title),
      sub && h("div", { class: "jf-card__sub" }, sub)
    );
    const attrs = { class: `jf-card jf-card--${shape}`, "aria-label": label || [title, sub].filter(Boolean).join(", ") };
    return href ? h("a", { ...attrs, href }, inner) : h("button", { ...attrs, onclick }, inner);
  }
  var section = (title, kids, cls = "jf-row") => h("section", { class: "jf-section" }, h("h2", { class: "jf-section__title" }, title), h("div", { class: cls }, kids));
  function header({ tabs, active, title } = {}) {
    const left = !title ? h("div", { class: "jf-header__left" }, h("span", { class: "jf-logo", "aria-label": "Viewbox" }, "Viewbox")) : h(
      "div",
      { class: "jf-header__left" },
      iconButton("back", "Back", () => history.back()),
      h("a", { class: "jf-iconbtn", href: "/home", "aria-label": "Home" }, icon("home")),
      title && h("span", { class: "jf-header__title" }, title)
    );
    const mid = h("nav", { class: "jf-tabs" }, (tabs || []).map((t) => h("a", { class: `jf-tab${t.id === active ? " jf-tab--active" : ""}`, href: t.href }, t.label)));
    const signedIn = isSignedIn();
    const right = h(
      "div",
      { class: "jf-header__right" },
      !signedIn && h("a", { class: "jf-signin", href: "/home#settings" }, "Sign in"),
      h("a", { class: "jf-iconbtn", href: "/search/", "aria-label": "Search" }, icon("search")),
      h("a", { class: "jf-iconbtn", href: "/home#settings", "aria-label": "Settings" }, icon("person")),
      clock()
    );
    return h("header", { class: "jf-header" }, left, mid, right);
  }
  var isSignedIn = () => !!document.querySelector('a[href="/account"]');
  var toast = (text) => {
    const t = document.body.appendChild(h("div", { class: "fc-toast", role: "status" }, text));
    setTimeout(() => t.remove(), 2e3);
  };

  // src/shell/settings.js
  var SYNC_KEY = "hqs.code";
  var PENDING_SYNC = "fc-pending-sync";
  var SETTINGS_KEY = "fc-tv-settings";
  var formatCode = (raw) => {
    const c = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9);
    return c.length > 8 ? `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}` : c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
  };
  var validCode = (code) => /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]$/.test(code);
  var activeCode = () => {
    try {
      return localStorage.getItem(SYNC_KEY);
    } catch (e) {
      return null;
    }
  };
  async function signIn(email, password) {
    var _a;
    const r = await fetch("/ajax/viplogin", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRF-Token": ((_a = document.querySelector('meta[name="csrf-token"]')) == null ? void 0 : _a.content) || ""
      },
      body: JSON.stringify({ uname: email, passw: password })
    });
    const body = await r.text();
    if (r.status === 401) throw new Error(body.slice(0, 120) || "Wrong email or password.");
    if (!r.ok) throw new Error(`Sign-in failed (HTTP ${r.status}).`);
    if (/"status"\s*:\s*"expired"/.test(body)) throw new Error("Your VIP membership has expired.");
  }
  var field = (label, input) => h("label", { class: "jf-field" }, h("span", { class: "jf-field__label" }, label), input);
  function settingsView(app) {
    const main = h("main", { class: "jf-main jf-settings" });
    app.append(header({ title: "Settings" }), main);
    const signedIn = isSignedIn();
    const email = h("input", { class: "jf-input", type: "email", autocomplete: "username", placeholder: "VIP email" });
    const password = h("input", { class: "jf-input", type: "password", autocomplete: "current-password", placeholder: "Password" });
    const accountMsg = h("p", { class: "jf-settings__msg", role: "status" });
    const signInBtn = h("button", { class: "jf-button", onclick: async () => {
      if (!email.value.trim() || !password.value) {
        accountMsg.textContent = "Enter your VIP email and password.";
        return;
      }
      accountMsg.textContent = "Signing in\u2026";
      try {
        await signIn(email.value.trim(), password.value);
        accountMsg.textContent = "Signed in.";
        setTimeout(() => location.reload(), 600);
      } catch (e) {
        accountMsg.textContent = e.message;
      }
    } }, "Sign in");
    const account = h(
      "section",
      { class: "jf-settings__section" },
      h("h2", { class: "jf-section__title" }, "Account"),
      signedIn ? h("p", { class: "jf-settings__status" }, "\u2713 Signed in to your VIP account.") : h("div", { class: "jf-settings__form" }, h("p", { class: "jf-settings__status" }, "Not signed in. Your lists need a VIP sign-in."), field("Email", email), field("Password", password), signInBtn, accountMsg)
    );
    const current = activeCode();
    const codeInput = h("input", { class: "jf-input jf-input--code", type: "text", autocomplete: "off", spellcheck: "false", placeholder: "XXXX-XXXX-X", maxlength: "11" });
    codeInput.addEventListener("input", () => {
      const v = formatCode(codeInput.value);
      if (v !== codeInput.value) codeInput.value = v;
    });
    const syncMsg = h("p", { class: "jf-settings__msg", role: "status" });
    const applyBtn = h("button", { class: "jf-button", onclick: () => {
      const code = formatCode(codeInput.value);
      if (!validCode(code)) {
        syncMsg.textContent = "A sync code looks like ABCD-1234-X (9 letters/digits).";
        return;
      }
      if (!isSignedIn()) {
        syncMsg.textContent = "Sign in first \u2014 the site only loads lists for a signed-in VIP account.";
        return;
      }
      try {
        localStorage.setItem(PENDING_SYNC, code);
      } catch (e) {
      }
      syncMsg.textContent = "Applying\u2026";
      location.assign("/mylists/favorites");
    } }, "Apply");
    const sync = h(
      "section",
      { class: "jf-settings__section" },
      h("h2", { class: "jf-section__title" }, "Your lists (Sync Code)"),
      h("p", { class: "jf-settings__status" }, current ? `Active sync code: ${formatCode(current)}` : "No sync code on this TV yet \u2014 your Favourites stay empty until you add one."),
      h("div", { class: "jf-settings__form" }, field(current ? "Change sync code" : "Sync code", codeInput), applyBtn, syncMsg)
    );
    const prefs = (() => {
      try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
      } catch (e) {
        return {};
      }
    })();
    const autoplayOn = prefs.autoplayEnabled !== false;
    const autoplayBtn = h("button", { class: `jf-toggle${autoplayOn ? " jf-toggle--on" : ""}`, role: "switch", "aria-checked": String(autoplayOn), onclick: () => {
      const p = (() => {
        try {
          return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
        } catch (e) {
          return {};
        }
      })();
      p.autoplayEnabled = p.autoplayEnabled === false;
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(p));
      } catch (e) {
      }
      autoplayBtn.classList.toggle("jf-toggle--on", p.autoplayEnabled);
      autoplayBtn.setAttribute("aria-checked", String(p.autoplayEnabled));
      toast(`Autoplay ${p.autoplayEnabled ? "on" : "off"}`);
    } }, "Play the next episode automatically");
    const playback = h("section", { class: "jf-settings__section" }, h("h2", { class: "jf-section__title" }, "Playback"), autoplayBtn);
    const about = h(
      "section",
      { class: "jf-settings__section" },
      h("h2", { class: "jf-section__title" }, "About"),
      h("p", { class: "jf-settings__about" }, `Viewbox TV ${true ? "0.3.2" : ""} \xB7 screen ${innerWidth}\xD7${innerHeight} @${devicePixelRatio}x \xB7 ${location.host}`),
      h("p", { class: "jf-settings__about" }, navigator.userAgent)
    );
    main.append(account, sync, playback, about);
    setTimeout(() => (signedIn ? codeInput : email).focus({ preventScroll: true }), 0);
  }
  function applyPendingSync() {
    let code = null;
    try {
      code = localStorage.getItem(PENDING_SYNC);
    } catch (e) {
    }
    const input = document.querySelector("#syncCodeInput");
    if (!code || !input) return null;
    try {
      localStorage.removeItem(PENDING_SYNC);
    } catch (e) {
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        input.value = code;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        let tries = 0;
        const t = setInterval(() => {
          const now = activeCode();
          const ok = now && formatCode(now) === code;
          if (ok || ++tries > 30) {
            clearInterval(t);
            resolve(!!ok);
          }
        }, 500);
      }, 500);
    });
  }

  // src/shell/meta.js
  var TTL = 24 * 36e5;
  var queue2 = Promise.resolve();
  function ensureMeta(items, max = 12, onEach) {
    queue2 = queue2.catch(() => {
    }).then(async () => {
      const cache = metaCache.all();
      const todo = items.filter((it) => !cache[it.pid] || Date.now() - (cache[it.pid].ts || 0) > TTL).slice(0, max);
      for (const it of todo) {
        try {
          const d = await details(it.type, it.pid);
          metaCache.put(it.pid, {
            type: it.type,
            title: d.title,
            year: d.year,
            slug: d.slug,
            poster: d.poster,
            backdrop: d.backdrop,
            eps: d.seasons.flatMap((s) => s.episodes.map((e) => [e.season, e.episode, e.title, e.thumb]))
          });
          if (onEach) onEach();
        } catch (e) {
          console.warn("[viewbox-tv] meta failed", it.pid, e);
        }
      }
      return metaCache.all();
    });
    return queue2;
  }
  var epsOf = (m) => ((m == null ? void 0 : m.eps) || []).map(([season, episode, title, thumb]) => ({ season, episode, title, thumb }));
  var findEp = (m, s, e) => epsOf(m).find((x) => x.season === s && x.episode === e);
  var hrefOf = (type, pid, m, s, e) => `/watch/${type === "movie" ? "movie" : "tv"}/${pid}/${(m == null ? void 0 : m.slug) || "x"}${s ? `/season/${s}/episode/${e}` : ""}`;

  // src/shell/views.js
  var HOME_TABS = [{ id: "home", label: "Home", href: "/home" }, { id: "favourites", label: "Favourites", href: "/mylists/favorites" }];
  var favoritePids2 = (t) => Object.keys(localStorage).filter((k) => k.startsWith(`bm:${t}:`)).map((k) => k.split(":")[2]);
  var progress = null;
  var prog = () => progress || (progress = progressIndex(watchEntries()));
  var posterCard = (c) => card({ href: c.href, image: c.poster, title: c.title, sub: c.season ? epLabel(c.season, c.episode) : c.year, progress: progressOf(prog(), c) });
  var focusFirst = (root) => setTimeout(() => {
    var _a;
    if (!document.activeElement || document.activeElement === document.body) (_a = root.querySelector(".jf-card, button, a")) == null ? void 0 : _a.focus({ preventScroll: true });
  }, 0);
  function homeView(app) {
    const site = parseHome(document);
    const main = h("main", { class: "jf-main" });
    app.append(header({ tabs: HOME_TABS, active: "home" }), main);
    const backdropOf = (type) => {
      var _a;
      return (_a = site.hero.find((x) => x.href.includes(`/${type}/`) && x.backdrop)) == null ? void 0 : _a.backdrop;
    };
    const media = section("My Media", [
      card({ href: "/show/tvshows", image: backdropOf("tv"), imageSize: "w780", title: "Shows", shape: "landscape" }),
      card({ href: "/show/movies", image: backdropOf("movie"), imageSize: "w780", title: "Movies", shape: "landscape" }),
      card({ href: "/mylists/favorites", image: site.hero.map((x) => x.backdrop).filter((b) => b && b !== backdropOf("tv") && b !== backdropOf("movie"))[0], imageSize: "w780", title: "Favourites", shape: "landscape" })
    ]);
    const personal = h("div", { class: "jf-personal" });
    main.append(
      media,
      personal,
      site.latest.length ? section("Latest Episodes & Movies", site.latest.map(posterCard)) : "",
      site.popular.length ? section("Popular", site.popular.map(posterCard)) : "",
      site.tv.length ? section("Shows", site.tv.map(posterCard)) : "",
      site.movies.length ? section("Movies", site.movies.map(posterCard)) : ""
    );
    focusFirst(main);
    const history2 = watchEntries();
    const cw = continueWatching(history2).slice(0, 12);
    const scanned = load();
    const epsByPid = Object.fromEntries(Object.entries(metaCache.all()).map(([pid, m]) => [pid, epsOf(m)]));
    for (const [pid, s] of Object.entries(scanned)) if (!epsByPid[pid] && s.eps) epsByPid[pid] = s.eps;
    const drawPersonal = () => {
      var _a;
      const meta = metaCache.all();
      const cwCards = cw.filter((e) => meta[e.pid]).map((e) => {
        const m = meta[e.pid];
        const ep = e.type === "tv" && findEp(m, e.season, e.episode);
        return card({
          href: hrefOf(e.type, e.pid, m, e.season, e.episode),
          shape: "landscape",
          image: ep && ep.thumb || m.backdrop,
          imageSize: ep && ep.thumb ? "w300" : "w780",
          title: m.title,
          sub: e.type === "tv" ? epLabel(e.season, e.episode, ep && ep.title) : m.year,
          progress: e.pct
        });
      });
      const eps = { ...epsByPid };
      for (const [pid, m] of Object.entries(meta)) if (m.eps) eps[pid] = epsOf(m);
      const up = nextUp(history2, eps).slice(0, 12);
      const upCards = up.filter((x) => meta[x.pid]).map((x) => {
        const m = meta[x.pid];
        const ep = findEp(m, x.season, x.episode);
        return card({ href: hrefOf("tv", x.pid, m, x.season, x.episode), shape: "landscape", image: ep && ep.thumb || m.backdrop, imageSize: ep && ep.thumb ? "w300" : "w780", title: m.title, sub: epLabel(x.season, x.episode, ep && ep.title) });
      });
      const nc = counts(scanned);
      const newCards = Object.entries(nc).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).map(([pid, n]) => {
        const s = scanned[pid];
        return card({ href: `/watch/tv/${pid}/${s.slug}`, image: s.poster, title: s.title, sub: `${n} new episode${n > 1 ? "s" : ""}`, badge: n });
      });
      const hadFocus = personal.contains(document.activeElement);
      personal.replaceChildren(
        cwCards.length ? section("Continue Watching", cwCards) : "",
        upCards.length ? section("Next Up", upCards) : "",
        newCards.length ? section("New Episodes", newCards) : ""
      );
      if (hadFocus) (_a = personal.querySelector(".jf-card")) == null ? void 0 : _a.focus({ preventScroll: true });
    };
    drawPersonal();
    document.addEventListener("fc-scanned", drawPersonal);
    const need = [...cw.map((e) => ({ pid: e.pid, type: e.type })), ...history2.filter((e) => e.type === "tv" && e.pct >= 0.9).sort((a, b) => b.ts - a.ts).map((e) => ({ pid: e.pid, type: "tv" }))];
    const uniq = [...new Map(need.map((x) => [x.pid, x])).values()].slice(0, 16);
    ensureMeta(uniq).then(drawPersonal);
  }
  function favouritesView(app) {
    const main = h("main", { class: "jf-main" });
    app.append(header({ tabs: HOME_TABS, active: "favourites" }), main);
    const settingsLink = (text) => h("p", { class: "jf-empty" }, text, " ", h("a", { class: "jf-button jf-button--inline", href: "/home#settings" }, "Open Settings"));
    let loading = true;
    let note = null;
    const itemsNow = () => [...favoritePids2("t").map((pid) => ({ pid, type: "tv" })), ...favoritePids2("m").map((pid) => ({ pid, type: "movie" }))];
    const draw = () => {
      const items = itemsNow();
      const meta = metaCache.all();
      const scanned = load();
      const cardFor = (it) => {
        const m = meta[it.pid] || scanned[it.pid];
        return m && m.title ? card({ href: hrefOf(it.type, it.pid, m), image: m.poster, title: m.title, sub: m.year, progress: progressOf(prog(), it) }) : null;
      };
      const shows = items.filter((i) => i.type === "tv").map(cardFor).filter(Boolean);
      const movies = items.filter((i) => i.type === "movie").map(cardFor).filter(Boolean);
      let empty = "";
      if (!shows.length && !movies.length) {
        if (!isSignedIn()) empty = settingsLink("Sign in to your VIP account to see your favourites.");
        else if (!items.length && !localStorage.getItem("hqs.code")) empty = settingsLink("No favourites yet \u2014 add your list's Sync Code in Settings to load them.");
        else if (!items.length) empty = h("p", { class: "jf-empty" }, "No favourites in this list yet.");
        else empty = h("p", { class: "jf-empty" }, loading ? "Loading favourites\u2026" : "Couldn't load your favourites. Try again later.");
      }
      const had = main.contains(document.activeElement);
      main.replaceChildren(note || "", shows.length ? section("Shows", shows, "jf-grid") : "", movies.length ? section("Movies", movies, "jf-grid") : "", empty);
      if (!had) focusFirst(main);
    };
    const load2 = () => {
      loading = true;
      const scanned = load();
      ensureMeta(itemsNow().filter((i) => {
        var _a;
        return !((_a = scanned[i.pid]) == null ? void 0 : _a.title);
      }), 60, draw).then(() => {
        loading = false;
        draw();
      });
    };
    draw();
    const pending = applyPendingSync();
    if (pending) {
      note = h("p", { class: "jf-empty", role: "status" }, "Applying your sync code\u2026");
      draw();
      pending.then((ok) => {
        note = h("p", { class: "jf-empty", role: "status" }, ok ? "Sync code applied." : "That sync code wasn't accepted \u2014 check it in Settings.");
        toast(ok ? "Sync code applied" : "Sync code not accepted");
        setTimeout(load2, 1500);
      });
    } else load2();
  }
  var SORTS = [["latest", "Latest"], ["best", "Best Rated"], ["name", "Name"]];
  function libraryView(app, kind) {
    const params = new URLSearchParams(location.search);
    let sort = params.get("sort") || "latest";
    let page = 1;
    let lastPage2 = Math.max(1, ...[...document.querySelectorAll(".searchnav[data-p]")].map((a) => +a.dataset.p || 1));
    let loading = false;
    const tabs = [{ id: "tv", label: "Shows", href: "/show/tvshows" }, { id: "movies", label: "Movies", href: "/show/movies" }];
    const grid = h("div", { class: "jf-grid" });
    const count = h("span", { class: "jf-toolbar__count" });
    const sortBtn = h("button", { class: "jf-iconbtn jf-toolbar__sort", "aria-label": "Sort", onclick: () => {
      const i = SORTS.findIndex(([k]) => k === sort);
      sort = SORTS[(i + 1) % SORTS.length][0];
      history.replaceState(null, "", `?sort=${sort}`);
      reload();
    } }, icon("sort"), h("span", {}, ""));
    const main = h("main", { class: "jf-main" }, h("div", { class: "jf-toolbar" }, count, sortBtn), grid);
    app.append(header({ tabs, active: kind, title: kind === "movies" ? "Movies" : "Shows" }), main);
    const add = (cards) => grid.append(...cards.map(posterCard));
    const label = () => {
      count.textContent = `1-${grid.children.length} of ${lastPage2 > page ? `${lastPage2 * 24}+` : grid.children.length}`;
      sortBtn.lastChild.textContent = SORTS.find(([k]) => k === sort)[1];
    };
    async function more() {
      if (loading || page >= lastPage2) return;
      loading = true;
      try {
        const r = await library(kind, page + 1, sort);
        page += 1;
        lastPage2 = r.lastPage;
        add(r.cards);
        label();
      } finally {
        loading = false;
      }
    }
    async function reload() {
      var _a;
      loading = true;
      try {
        const r = await library(kind, 1, sort);
        page = 1;
        lastPage2 = r.lastPage;
        grid.replaceChildren();
        add(r.cards);
        label();
        (_a = grid.querySelector(".jf-card")) == null ? void 0 : _a.focus();
      } finally {
        loading = false;
      }
    }
    if (sort === "latest" && !params.get("page")) {
      add(parseCards(document.querySelector("#content") || document).filter((c) => c.type === (kind === "movies" ? "movie" : "tv")));
      label();
      focusFirst(grid);
    } else reload();
    grid.addEventListener("focusin", (e) => {
      const i = [...grid.children].indexOf(e.target.closest(".jf-card"));
      if (i >= grid.children.length - 14) more();
    });
  }
  var LETTERS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  function searchView(app) {
    const initial = decodeURIComponent(location.pathname.replace(/^\/search\/?/, "")).replace(/^\*$/, "");
    const input = h("input", { class: "jf-search__input", type: "text", placeholder: "Search", value: initial, "aria-label": "Search", autocomplete: "off", spellcheck: "false" });
    const results = h("div", { class: "jf-search__results" });
    const keys = h(
      "div",
      { class: "jf-keys" },
      h(
        "div",
        { class: "jf-keys__row" },
        LETTERS.map((l) => h("button", { class: "jf-key", "aria-label": l === " " ? "Space" : l, onclick: () => type(l) }, l === " " ? "\u2423" : l)),
        h("button", { class: "jf-key", "aria-label": "Delete", onclick: () => {
          input.value = input.value.slice(0, -1);
          changed();
        } }, icon("backspace"))
      ),
      h("div", { class: "jf-keys__row" }, "0123456789".split("").map((d) => h("button", { class: "jf-key", onclick: () => type(d) }, d)))
    );
    const main = h("main", { class: "jf-main jf-search" }, h("div", { class: "jf-search__bar" }, icon("search", "jf-search__icon"), input), keys, results);
    app.append(header({ title: "Search" }), main);
    function type(ch) {
      input.value += ch.toLowerCase();
      changed();
    }
    let timer;
    let token = 0;
    function changed() {
      clearTimeout(timer);
      timer = setTimeout(run, 450);
    }
    async function run() {
      const q = input.value.trim();
      history.replaceState(null, "", `/search/${encodeURIComponent(q)}`);
      const my = ++token;
      if (!q) return suggestions();
      results.replaceChildren(h("p", { class: "jf-empty" }, "Searching\u2026"));
      try {
        const r = await search(q);
        if (my !== token) return;
        const shows = r.cards.filter((c) => c.type === "tv").map(posterCard);
        const movies = r.cards.filter((c) => c.type === "movie").map(posterCard);
        results.replaceChildren(
          shows.length ? section("Shows", shows) : "",
          movies.length ? section("Movies", movies) : "",
          !shows.length && !movies.length ? h("p", { class: "jf-empty" }, "No results.") : ""
        );
      } catch (e) {
        if (my === token) results.replaceChildren(h("p", { class: "jf-empty" }, "Search failed. Try again."));
      }
    }
    function suggestions() {
      const meta = metaCache.all();
      const picks = Object.entries(meta).filter(([, m]) => m.title).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0)).slice(0, 14);
      results.replaceChildren(
        h("h2", { class: "jf-section__title jf-center" }, "Suggestions"),
        h("div", { class: "jf-suggestions" }, picks.map(([pid, m]) => h("a", { class: "jf-suggestion", href: hrefOf(m.type, pid, m) }, m.title)))
      );
    }
    input.addEventListener("input", changed);
    if (initial) run();
    else suggestions();
    setTimeout(() => input.focus(), 0);
  }

  // src/shell/details.js
  function detailsView(app, type, pid) {
    const d = parseDetails(document, document.head.innerHTML);
    metaCache.put(pid, {
      type,
      title: d.title,
      year: d.year,
      slug: d.slug,
      poster: d.poster,
      backdrop: d.backdrop,
      eps: d.seasons.flatMap((s) => s.episodes.map((e) => [e.season, e.episode, e.title, e.thumb]))
    });
    const hist = () => watchEntries().filter((e) => e.pid === pid);
    const pctOf = (s, e) => (hist().find((x) => x.season === s && x.episode === e) || {}).pct || 0;
    const allEps = d.seasons.filter((s) => s.season > 0).flatMap((s) => s.episodes);
    function playTarget() {
      const h2 = hist().filter((x) => x.type === "tv").sort((a, b) => b.ts - a.ts);
      const last = h2[0];
      if (last && last.pct < 0.9) return last;
      if (last) {
        const i = allEps.findIndex((x) => x.season === last.season && x.episode === last.episode);
        if (allEps[i + 1]) return allEps[i + 1];
      }
      return allEps[0];
    }
    function playEpisode(s, e) {
      if (!document.querySelector(`tr.eplist[data-pes="${s}"][data-pep="${e}"]`)) return toast("Episode not available");
      location.assign(`/watch/tv/${pid}/${d.slug || "x"}/season/${s}/episode/${e}`);
    }
    function playMovie() {
      location.hash = "play";
      location.reload();
    }
    const favEl = () => document.querySelector(`.favorite[data-pid="${pid}"]`);
    const isFav = () => !!favEl() && !favEl().classList.contains("fa-heart-o");
    const main = h("main", { class: "jf-main" });
    app.append(header({ title: d.title }), main);
    function overview() {
      const favBtn = iconButton("heart", "Add to favourites", () => {
        var _a;
        (_a = favEl()) == null ? void 0 : _a.click();
        setTimeout(syncFav, 600);
      }, { class: "jf-detailbtn" });
      const syncFav = () => favBtn.classList.toggle("jf-iconbtn--on", isFav());
      syncFav();
      const target = type === "tv" && playTarget();
      const play = iconButton(
        "play",
        type === "tv" && target && pctOf(target.season, target.episode) > 0.05 ? "Resume" : "Play",
        () => type === "tv" ? target && playEpisode(target.season, target.episode) : playMovie(),
        { class: "jf-detailbtn jf-detailbtn--play" }
      );
      const body = h(
        "div",
        { class: "jf-details__body" },
        h("h1", { class: "jf-details__title" }, d.title),
        h(
          "div",
          { class: "jf-details__meta" },
          d.year && h("span", {}, d.year),
          d.contentRating && d.contentRating !== "NR" && h("span", { class: "jf-rating" }, d.contentRating),
          d.rating && h("span", { class: "jf-star" }, icon("star"), d.rating)
        ),
        h("div", { class: "jf-details__buttons" }, play, favBtn),
        d.overview && h("p", { class: "jf-details__overview" }, d.overview),
        h(
          "table",
          { class: "jf-details__info" },
          d.genres.length && h("tr", {}, h("th", {}, d.genres.length > 1 ? "Genres" : "Genre"), h("td", {}, d.genres.join(", "))),
          d.network && h("tr", {}, h("th", {}, "Studio"), h("td", {}, d.network))
        )
      );
      if (type === "tv") {
        if (target) {
          const ep = allEps.find((x) => x.season === target.season && x.episode === target.episode) || target;
          body.append(section("Next Up", [card({ onclick: () => playEpisode(target.season, target.episode), shape: "landscape", image: ep.thumb || d.backdrop, imageSize: ep.thumb ? "w300" : "w780", title: epLabel(target.season, target.episode, ep.title), progress: pctOf(target.season, target.episode) })]));
        }
        body.append(section("Seasons", d.seasons.map((s) => card({
          onclick: () => {
            location.hash = `season-${s.season}`;
          },
          image: s.poster || d.poster,
          title: s.season === 0 ? "Specials" : `Season ${s.season}`,
          badge: unwatched(s) || null
        }))));
      }
      main.replaceChildren(h("div", { class: "jf-details" }, h("div", { class: "jf-details__poster", style: d.poster ? { backgroundImage: `url("${img(d.poster, "w500")}")` } : null }), body));
      setTimeout(() => play.focus({ preventScroll: true }), 0);
    }
    const unwatched = (s) => s.episodes.filter((e) => pctOf(e.season, e.episode) < 0.9).length;
    function season(n) {
      const s = d.seasons.find((x) => x.season === n);
      if (!s) return overview();
      const first = s.episodes.find((e) => pctOf(e.season, e.episode) < 0.9) || s.episodes[0];
      const play = iconButton("play", "Play", () => playEpisode(first.season, first.episode), { class: "jf-detailbtn jf-detailbtn--play" });
      const list = s.episodes.map((e) => {
        const pct = pctOf(e.season, e.episode);
        return h(
          "button",
          { class: "jf-episode", onclick: () => playEpisode(e.season, e.episode), "aria-label": `${e.episode}. ${e.title}` },
          h(
            "div",
            { class: "jf-episode__thumb", style: e.thumb ? { backgroundImage: `url("${img(e.thumb, "w300")}")` } : null },
            pct >= 0.9 && h("div", { class: "jf-badge jf-badge--check" }, icon("check")),
            pct > 0.05 && pct < 0.9 && h("div", { class: "jf-progress" }, h("div", { class: "jf-progress__fill", style: { width: `${Math.round(pct * 100)}%` } }))
          ),
          h(
            "div",
            { class: "jf-episode__text" },
            h("div", { class: "jf-episode__title" }, `${e.episode}. ${e.title}`),
            e.airDate && h("div", { class: "jf-episode__meta" }, e.airDate)
          )
        );
      });
      main.replaceChildren(h(
        "div",
        { class: "jf-details" },
        h("div", { class: "jf-details__poster", style: { backgroundImage: `url("${img(s.poster || d.poster, "w500")}")` } }),
        h(
          "div",
          { class: "jf-details__body" },
          h("h1", { class: "jf-details__title" }, d.title),
          h("div", { class: "jf-details__subtitle" }, n === 0 ? "Specials" : `Season ${n}`),
          h("div", { class: "jf-details__buttons" }, play),
          h("div", { class: "jf-episodes" }, list)
        )
      ));
      setTimeout(() => play.focus({ preventScroll: true }), 0);
    }
    const render = () => {
      app.scrollTop = 0;
      const m = /^#season-(\d+)$/.exec(location.hash);
      if (m) season(+m[1]);
      else overview();
    };
    window.addEventListener("hashchange", render);
    render();
  }

  // src/shell/osd.js
  var HIDE_AFTER = 4e3;
  var jw = () => {
    try {
      return window.jwplayer("player");
    } catch (e) {
      return null;
    }
  };
  function currentTitle() {
    var _a, _b, _c;
    const show = (((_b = (_a = document.querySelector(".section-watch-overview .watch-header")) == null ? void 0 : _a.childNodes[0]) == null ? void 0 : _b.textContent) || document.title).trim();
    const key = String(window.key || "");
    const [, s, e] = key.split(":");
    if (!s) {
      const y = (/\((\d{4})\)/.exec(document.title) || [])[1];
      return y ? `${show} (${y})` : show;
    }
    const row = document.querySelector(`tr.eplist[data-pes="${s}"][data-pep="${e}"]`);
    return `${show} \u2014 ${epLabel(s, e, (_c = row == null ? void 0 : row.querySelector(".epTitle")) == null ? void 0 : _c.textContent.trim())}`;
  }
  function createOsd() {
    let root = null;
    let timer = null;
    let loop = null;
    let els = {};
    function build() {
      const title = h("div", { class: "jf-osd__title" });
      const cur = h("span", { class: "jf-osd__time" });
      const left = h("span", { class: "jf-osd__time" });
      const fill = h("div", { class: "jf-slider__fill" });
      const thumb = h("div", { class: "jf-slider__thumb" });
      const slider = h("button", { class: "jf-slider", role: "slider", "aria-label": "Position", "aria-valuemin": "0" }, h("div", { class: "jf-slider__track" }, fill, thumb));
      const playBtn = iconButton("pause", "Pause", () => {
        const p = jw();
        if (!p) return;
        p.getState() === "playing" ? p.pause() : p.play();
        refresh();
      });
      const muteBtn = iconButton("volume", "Mute", () => {
        const p = jw();
        if (p) {
          p.setMute(!p.getMute());
          refresh();
        }
      });
      const ends = h("span", { class: "jf-osd__ends" });
      const isTv = /^\/watch\/tv\//.test(location.pathname);
      root = h(
        "div",
        { id: "fc-osd" },
        h(
          "div",
          { class: "jf-osd__top" },
          iconButton("back", "Back", () => document.dispatchEvent(new Event("fc-close-player"))),
          // leaves playback, like Jellyfin
          title,
          h("span", { class: "jf-osd__spacer" }),
          clock()
        ),
        h(
          "div",
          { class: "jf-osd__bottom" },
          h("div", { class: "jf-osd__timeline" }, cur, slider, left),
          h(
            "div",
            { class: "jf-osd__buttons" },
            iconButton("rewind", "Rewind", () => seekBy(-10)),
            playBtn,
            iconButton("forward", "Fast-forward", () => seekBy(30)),
            isTv && iconButton("next", "Next episode", () => {
              if (typeof window.playNext === "function") window.playNext();
            }),
            ends,
            h("span", { class: "jf-osd__spacer" }),
            iconButton("cc", "Subtitles", cycleCaptions),
            iconButton("hd", "Quality", cycleQuality),
            muteBtn
          )
        )
      );
      els = { title, cur, left, fill, thumb, slider, playBtn, muteBtn, ends };
      document.body.appendChild(root);
    }
    function seekBy(s) {
      const p = jw();
      if (p) {
        p.seek(Math.max(0, Math.min(p.getDuration() - 1, p.getPosition() + s)));
        refresh();
      }
    }
    function cycleCaptions() {
      const p = jw();
      if (!p) return;
      const list = p.getCaptionsList() || [];
      if (list.length < 2) return toast("No subtitles");
      const next = (p.getCurrentCaptions() + 1) % list.length;
      p.setCurrentCaptions(next);
      toast(`Subtitles: ${list[next].label || "Off"}`);
    }
    function cycleQuality() {
      const p = jw();
      if (!p) return;
      const list = p.getQualityLevels() || [];
      if (list.length < 2) return toast("Only one quality");
      const next = (p.getCurrentQuality() + 1) % list.length;
      p.setCurrentQuality(next);
      toast(`Quality: ${list[next].label}`);
    }
    function refresh() {
      const p = jw();
      const v = document.querySelector("video");
      const pos = p ? p.getPosition() : (v == null ? void 0 : v.currentTime) || 0;
      const dur = p ? p.getDuration() : (v == null ? void 0 : v.duration) || 0;
      const pct = dur > 0 ? Math.min(1, pos / dur) : 0;
      els.title.textContent = currentTitle();
      els.cur.textContent = fmtTime(pos);
      els.left.textContent = `-${fmtTime(dur - pos)}`;
      els.fill.style.width = `${pct * 100}%`;
      els.thumb.style.left = `${pct * 100}%`;
      els.slider.setAttribute("aria-valuenow", String(Math.round(pos)));
      els.slider.setAttribute("aria-valuemax", String(Math.round(dur)));
      els.ends.textContent = dur > 0 ? endsAt(dur - pos) : "";
      const playing = p ? p.getState() === "playing" : v && !v.paused;
      els.playBtn.replaceChildren(icon(playing ? "pause" : "play"));
      els.playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
      const muted = p ? p.getMute() : v == null ? void 0 : v.muted;
      els.muteBtn.replaceChildren(icon(muted ? "mute" : "volume"));
      try {
        if (p && p.getControls()) p.setControls(false);
      } catch (e) {
      }
    }
    const visible2 = () => !!root && root.classList.contains("jf-osd--on");
    function show(focusPlay) {
      if (!root) return;
      root.classList.add("jf-osd--on");
      refresh();
      if (focusPlay || !root.contains(document.activeElement)) els.playBtn.focus({ preventScroll: true });
      clearTimeout(timer);
      timer = setTimeout(() => {
        const p = jw();
        if (!p || p.getState() === "playing") hide();
      }, HIDE_AFTER);
    }
    function hide() {
      if (root) {
        root.classList.remove("jf-osd--on");
        if (root.contains(document.activeElement)) document.activeElement.blur();
      }
    }
    function handleKey(e) {
      if (!root) return false;
      const k = e.keyCode;
      if (!visible2()) {
        if ([13, 37, 38, 39, 40].includes(k)) {
          show(true);
          return true;
        }
        return false;
      }
      show(false);
      if ((k === 37 || k === 39) && document.activeElement === els.slider) {
        seekBy(k === 39 ? 10 : -10);
        return true;
      }
      return false;
    }
    return {
      attach() {
        if (!root) build();
        loop = loop || setInterval(() => visible2() && refresh(), 500);
        show(true);
      },
      detach() {
        hide();
        clearInterval(loop);
        loop = null;
        root == null ? void 0 : root.remove();
        root = null;
      },
      visible: visible2,
      hide,
      show,
      handleKey
    };
  }

  // src/shell/shell.js
  function route(path) {
    if (path === "/" || path === "/home") return (app) => location.hash === "#settings" ? settingsView(app) : homeView(app);
    if (/^\/mylists\//.test(path)) return (app) => favouritesView(app);
    const lib = /^\/show\/(tvshows|movies)/.exec(path);
    if (lib) return (app) => libraryView(app, lib[1] === "movies" ? "movies" : "tv");
    const det = /^\/watch\/(tv|movie)\/(\d+)/.exec(path);
    if (det) return (app) => detailsView(app, det[1], det[2]);
    if (/^\/search/.test(path)) return (app) => searchView(app);
    return null;
  }
  function startShell() {
    const view = route(location.pathname);
    if (!view) return null;
    document.documentElement.classList.add("fc-shell");
    document.head.appendChild(document.createElement("style")).textContent = jellyfin_default;
    const app = document.body.appendChild(h("div", { id: "fc-app" }));
    view(app);
    if (location.pathname === "/" || location.pathname === "/home") {
      window.addEventListener("hashchange", () => {
        app.replaceChildren();
        app.scrollTop = 0;
        view(app);
      });
    }
    const osd = createOsd();
    const setPlaying = (on) => {
      document.documentElement.classList.toggle("fc-playing", on);
      if (on) osd.attach();
      else osd.detach();
    };
    const onPlay = (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement) || v.paused || document.documentElement.classList.contains("fc-playing")) return;
      if (document.querySelector(".player.hide") || v.duration <= 120) return;
      if (/^\/watch\/movie\//.test(location.pathname) && !window.__fcAllowAutostart) return;
      setPlaying(true);
    };
    document.addEventListener("playing", onPlay, true);
    document.addEventListener("timeupdate", onPlay, true);
    const player = document.querySelector(".player");
    if (player) new MutationObserver(() => {
      if (player.classList.contains("hide")) setPlaying(false);
    }).observe(player, { attributes: true, attributeFilter: ["class"] });
    return { osd, stop: () => setPlaying(false), playing: () => document.documentElement.classList.contains("fc-playing") };
  }

  // src/shell/autostart.js
  function holdMovieAutostart() {
    if (!/^\/watch\/movie\//.test(location.pathname)) return;
    if (location.hash === "#play") {
      window.__fcAllowAutostart = true;
      return;
    }
    let jw2;
    const wrap = (fn) => typeof fn !== "function" ? fn : new Proxy(fn, {
      apply(t, self, args) {
        const inst = Reflect.apply(t, self, args);
        if (inst && inst.setup && !inst.__fcHeld) {
          inst.__fcHeld = true;
          const setup = inst.setup;
          inst.setup = function(cfg) {
            return setup.call(this, !window.__fcAllowAutostart && cfg ? Object.assign({}, cfg, { autostart: false }) : cfg);
          };
        }
        return inst;
      }
    });
    try {
      Object.defineProperty(window, "jwplayer", { configurable: true, get: () => jw2, set: (v) => {
        jw2 = wrap(v);
      } });
    } catch (e) {
    }
    document.addEventListener("play", (e) => {
      if (window.__fcAllowAutostart || !(e.target instanceof HTMLVideoElement)) return;
      e.target.pause();
      try {
        window.jwplayer("player").pause();
      } catch (err) {
      }
    }, true);
  }

  // src/main.js
  (() => {
    window.__fcTvInjected = Date.now();
    if (window.__fcTv) return;
    window.__fcTv = true;
    holdMovieAutostart();
    const DEFAULTS = { autoplayEnabled: true, creditsOffset: 20, countdownSecs: 10, autoplayOff: [], stillWatching: true, swEpisodes: 3, swMinutes: 90 };
    const SETTINGS_KEY2 = "fc-tv-settings";
    const settings = () => {
      try {
        return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY2)) };
      } catch {
        return { ...DEFAULTS };
      }
    };
    function pushSettings() {
      document.documentElement.dataset.fcSettings = JSON.stringify(settings());
      document.dispatchEvent(new Event("fc-settings"));
    }
    const KEYS = { 37: "left", 38: "up", 39: "right", 40: "down" };
    const BACK = [10009, 27, 8];
    const PLAY_PAUSE = [10252, 415, 19];
    const RED2 = 403;
    try {
      ["MediaPlayPause", "MediaPlay", "MediaPause", "MediaFastForward", "MediaRewind", "ColorF0Red"].forEach((k) => tizen.tvinputdevice.registerKey(k));
    } catch {
    }
    const onReady = (fn) => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn, { once: true }) : fn();
    const looksLikeSite = () => !!document.querySelector('a[href="/mylists/favorites"]') && !!document.querySelector('meta[name="csrf-token"]');
    let siteActive = false;
    let shell = null;
    onReady(() => {
      var _a;
      if (isLauncher()) {
        try {
          document.head.appendChild(document.createElement("style")).textContent = tv_default;
          return runLauncher();
        } catch (e) {
          window.__fcTvError = String(e && e.stack || e);
          throw e;
        }
      }
      if (!looksLikeSite()) return;
      siteActive = true;
      document.documentElement.classList.add("fc-tv");
      document.head.appendChild(document.createElement("style")).textContent = tv_default;
      pushSettings();
      const pid = (_a = location.pathname.match(/^\/watch\/tv\/(\d+)/)) == null ? void 0 : _a[1];
      if (pid) markSeen(pid);
      if (/^\/watch\/tv\//.test(location.pathname)) loadPlayer();
      shell = startShell();
      scan(false).then(() => document.dispatchEvent(new Event("fc-scanned")));
      setTimeout(() => activeEl() || move("down"), 800);
    });
    function loadPlayer() {
      let tries = 0;
      const t = setInterval(() => {
        if (typeof window.playNext !== "function" && ++tries < 40) return;
        clearInterval(t);
        const s = document.createElement("script");
        s.textContent = '(()=>{const y={playerBox:"#player",siteNextUp:".nextUp",episodeRow:t=>`tr.eplist[data-epid="${t}"]`,epTitle:".epTitle",epThumb:"img.watch-episode-thumb",thumbBase:"https://img.xcdn.to/t/p/w300"};if(typeof window.playNext!="function")return;const H=window.playNext;let h=null,a=null;const J=()=>{var t,e;return(e=String((t=window.key)!=null?t:location.pathname).match(/\\d+/))==null?void 0:e[0]},b=()=>!!a&&a.autoplayEnabled&&!a.autoplayOff.includes(J()),k=document.head.appendChild(document.createElement("style"));k.textContent=`${y.siteNextUp} { display: none !important; }`,k.disabled=!0;function q(){try{a=JSON.parse(document.documentElement.dataset.fcSettings)}catch{a=null}a&&(!b()&&h===null?(h=window.autoplay,window.autoplay=!1):b()&&h!==null&&(window.autoplay=h,h=null),k.disabled=!b(),b()||f())}document.addEventListener("fc-settings",q),q();let A="",T="",v=!1,c=null,$=null,S=!1,s=null;const L="fc-still-watching",m=()=>({auto:0,lastInteraction:Date.now(),pending:!1}),g={get:()=>{var t;try{return(t=JSON.parse(sessionStorage.getItem(L)))!=null?t:m()}catch{return m()}},set:t=>{try{sessionStorage.setItem(L,JSON.stringify(t))}catch{}}};function M(t){!t.isTrusted||s&&t.composedPath().includes(s)||(g.set(m()),s&&P())}document.addEventListener("pointerdown",M,!0),document.addEventListener("keydown",M,!0),window.playNext=function(...t){if(!v){if(f(),!S&&(a!=null&&a.stillWatching)&&window.autoplay&&!window.playNextGuard){const e=g.get();e.auto+=1,e.pending=e.auto>=a.swEpisodes||Date.now()-e.lastInteraction>=a.swMinutes*6e4,g.set(e)}return S=!1,H.apply(this,t)}},document.addEventListener("timeupdate",t=>{var n;const e=t.target;if(!(e instanceof HTMLVideoElement))return;if(s){e.paused||e.pause();return}if(!b()||!(e.duration>120))return;const o=String((n=window.key)!=null?n:location.pathname);if(o!==A){if(e.currentSrc===T)return;if(A=o,T=e.currentSrc,v=!1,f(),a.stillWatching&&g.get().pending)return z(e)}if(!window.autoplay||e.duration-e.currentTime>a.creditsOffset+1)return f();!c&&!v&&K(e)},!0);function K(t){const e=document.querySelector(y.episodeRow(window.activeID-1)),o=a.countdownSecs;let n=o;c=Y(e,o),e&&($=setInterval(()=>{t.paused||(n=Math.max(0,n-.25),c.tick(n),n===0&&N(!1))},250))}function N(t){f(),S=t===!0,window.playNext()}function E(){v=!0,f()}function f(){clearInterval($),c==null||c.remove(),c=null}function R(t){if(c){if(t.key==="Escape")E();else if(t.key==="Enter"&&c.hasNext&&!t.composedPath().includes(c))N(!0);else return;t.preventDefault(),t.stopPropagation()}}document.addEventListener("keydown",R,!0);const U=`\n    .box { font: 14px/1.3 system-ui, sans-serif; color: #fff; background: rgba(20,20,20,.92); border-radius: 8px;\n           padding: 12px; width: 300px; box-shadow: 0 4px 24px rgba(0,0,0,.5); display: grid; gap: 10px; }\n    .head { display: flex; gap: 10px; align-items: center; }\n    img { width: 96px; aspect-ratio: 16/9; object-fit: cover; border-radius: 4px; background: #333; }\n    .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #aaa; }\n    .title { font-weight: 600; }\n    .actions { display: flex; gap: 8px; }\n    button { font: inherit; border: 0; border-radius: 4px; padding: 7px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; }\n    button:focus-visible { outline: 2px solid #18a2b8; outline-offset: 2px; }\n    .play { background: #fff; color: #111; font-weight: 600; flex: 1; justify-content: center; }\n    .cancel { background: rgba(255,255,255,.15); color: #fff; }\n    svg { transform: rotate(-90deg); }\n    circle { fill: none; stroke-width: 3; }\n    .track { stroke: rgba(0,0,0,.15); }\n    .ring { stroke: #111; stroke-linecap: round; }\n  `,C=8,I=2*Math.PI*C;function B(t){var d;const e=document.createElement("div");e.style.cssText=`position:absolute;z-index:2147483647;${t}`;const o=e.attachShadow({mode:"open"});o.innerHTML=`<style>${U}</style>`,((d=document.querySelector(y.playerBox))!=null?d:document.body).append(e);const n=i(o,"div","box");return n.addEventListener("keydown",r=>{var u,p;const l=(p=(u=r.target).closest)==null?void 0:p.call(u,"button");!l||r.key!=="Enter"&&r.key!==" "||(r.preventDefault(),r.stopPropagation(),l.click())}),{host:e,box:n}}function z(t){var p;t.pause(),s==null||s.remove();const e=(p=/Episodes of (.+?) \\(\\d{4}\\)/.exec(document.title))==null?void 0:p[1],{host:o,box:n}=B("left:50%;top:50%;transform:translate(-50%,-50%)");n.setAttribute("role","alertdialog"),n.setAttribute("aria-labelledby","q"),n.setAttribute("aria-modal","true");const d=i(n,"div","title");d.id="q",d.textContent=e?`Are you still watching ${e}?`:"Are you still watching?";const r=i(n,"div","actions"),l=i(r,"button","play");l.textContent="Continue watching",l.onclick=P;const u=i(r,"button","cancel");u.textContent="Back to browse",u.onclick=()=>{g.set(m()),location.assign(location.pathname.split("/").slice(0,5).join("/"))},n.addEventListener("keydown",x=>{x.key==="Tab"&&(x.preventDefault(),x.stopPropagation(),(x.target===l?u:l).focus())}),s=o,queueMicrotask(()=>l.focus({preventScroll:!0}))}function P(){var t;g.set(m()),s==null||s.remove(),s=null,(t=document.querySelector("video"))==null||t.play().catch(()=>{})}function Y(t,e){var d,r,l;const{host:o,box:n}=B("right:24px;bottom:72px");if(n.setAttribute("role","dialog"),!t)n.setAttribute("aria-label","All caught up"),i(n,"div","title").textContent="You\'re all caught up",i(n,"div","label").textContent="No more episodes of this show yet.",i(i(n,"div","actions"),"button","cancel").textContent="Close",n.querySelector("button").onclick=E;else{n.setAttribute("aria-label","Next episode");const u=i(n,"div","head"),p=(d=t.querySelector(y.epThumb))==null?void 0:d.dataset.img;p&&Object.assign(i(u,"img"),{src:y.thumbBase+p,alt:""});const x=i(u,"div");i(x,"div","label").textContent=`Next \\xB7 S${t.dataset.pes} E${t.dataset.pep}`,i(x,"div","title").textContent=(l=(r=t.querySelector(y.epTitle))==null?void 0:r.textContent.trim())!=null?l:"";const D=i(n,"div","actions"),w=i(D,"button","play");w.innerHTML=`<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle class="track" cx="10" cy="10" r="${C}"/><circle class="ring" cx="10" cy="10" r="${C}" stroke-dasharray="${I}" stroke-dashoffset="0"/></svg><span></span>`;const G=w.querySelector(".ring"),O=w.querySelector("span");O.textContent=`Next episode in ${e}`,w.onclick=()=>N(!0);const j=i(D,"button","cancel");j.textContent="Not now",j.onclick=E,o.tick=W=>{G.setAttribute("stroke-dashoffset",String(I*(1-W/e))),O.textContent=`Next episode in ${Math.ceil(W)}`},queueMicrotask(()=>w.focus({preventScroll:!0}))}return o.hasNext=!!t,o}function i(t,e,o){const n=t.appendChild(document.createElement(e));return o&&(n.className=o,n.setAttribute("part",o)),n}})();\n';
        document.documentElement.appendChild(s);
      }, 250);
    }
    const playerOpen = () => shell ? shell.playing() : !!document.querySelector(".player:not(.hide) video");
    const overlayRoot = () => {
      var _a, _b;
      const r = (_b = (_a = activeEl()) == null ? void 0 : _a.getRootNode) == null ? void 0 : _b.call(_a);
      return r && r.host ? r : null;
    };
    const inOverlay = () => !!overlayRoot();
    const handled = /* @__PURE__ */ new Set();
    window.addEventListener("keyup", (e) => {
      if (siteActive && handled.delete(e.keyCode)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    window.addEventListener("keydown", (e) => {
      var _a, _b, _c;
      if (!siteActive) return;
      const code = e.keyCode;
      if (playerOpen() && !inOverlay() && (KEYS[code] || code === 13)) {
        if (!shell) return;
        if (shell.osd.handleKey(e)) {
          e.preventDefault();
          e.stopPropagation();
          handled.add(code);
          return;
        }
      }
      if (KEYS[code]) {
        if (move(KEYS[code])) e.preventDefault();
        e.stopPropagation();
        handled.add(code);
      } else if (code === 13) {
        const el = activeEl();
        if (!el || el.matches("input, select, textarea")) return;
        if (el.closest("#fc-app, #fc-osd") || !el.matches("a[href], button")) {
          e.preventDefault();
          e.stopPropagation();
          el.click();
        }
      } else if (BACK.includes(code)) {
        if (((_b = (_a = e.target).matches) == null ? void 0 : _b.call(_a, "input, textarea")) && code === 8) return;
        e.preventDefault();
        e.stopPropagation();
        if (inOverlay()) {
          (_c = overlayRoot().querySelector(".cancel")) == null ? void 0 : _c.click();
          return;
        }
        if (shell && shell.osd.visible()) shell.osd.hide();
        else if (playerOpen()) closePlayer();
        else history.back();
      } else if (PLAY_PAUSE.includes(code)) {
        e.preventDefault();
        try {
          const p = jwplayer("player");
          p.getState() === "playing" ? p.pause() : p.play();
        } catch {
        }
      } else if (code === 417 || code === 412) {
        e.preventDefault();
        try {
          const p = jwplayer("player");
          p.seek(Math.max(0, p.getPosition() + (code === 417 ? 10 : -10)));
        } catch {
        }
      } else if (code === RED2) {
        const s = settings();
        s.autoplayEnabled = !s.autoplayEnabled;
        localStorage.setItem(SETTINGS_KEY2, JSON.stringify(s));
        pushSettings();
        toast2(`Autoplay ${s.autoplayEnabled ? "on" : "off"}`);
      }
    }, true);
    function closePlayer() {
      var _a;
      try {
        jwplayer("player").pause();
      } catch {
      }
      (_a = document.querySelector(".player")) == null ? void 0 : _a.classList.add("hide");
      history.replaceState(null, "", location.pathname.split("/").slice(0, 5).join("/") + (location.hash.startsWith("#season-") ? location.hash : ""));
      window.__fcAllowAutostart = false;
      shell == null ? void 0 : shell.stop();
      setTimeout(() => {
        var _a2;
        return (_a2 = [".jf-detailbtn--play", ".jf-main .jf-card", ".jf-main button"].map((s) => document.querySelector(`#fc-app ${s}`)).find(Boolean)) == null ? void 0 : _a2.focus({ preventScroll: true });
      }, 0);
    }
    document.addEventListener("fc-close-player", closePlayer);
    function toast2(text) {
      const t = document.body.appendChild(document.createElement("div"));
      t.className = "fc-toast";
      t.setAttribute("role", "status");
      t.textContent = text;
      setTimeout(() => t.remove(), 2e3);
    }
  })();
})();
