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
    const a = center(from);
    let best = null;
    let bestScore = Infinity;
    for (const c of candidates2) {
      const b = center(c.rect);
      const along = (b[axis] - a[axis]) * sign;
      if (along <= 1) continue;
      const across = Math.abs(b[other] - a[other]);
      const score = along + across * 2;
      if (score < bestScore) {
        bestScore = score;
        best = c;
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
    return [...document.querySelectorAll("#player > div")].map((h) => h.shadowRoot).filter(Boolean);
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

  // src/main.js
  (() => {
    window.__fcTvInjected = Date.now();
    if (window.__fcTv) return;
    window.__fcTv = true;
    const DEFAULTS = { autoplayEnabled: true, creditsOffset: 20, countdownSecs: 10, autoplayOff: [], stillWatching: true, swEpisodes: 3, swMinutes: 90 };
    const SETTINGS_KEY = "fc-tv-settings";
    const settings = () => {
      try {
        return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
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
      if (pid) {
        markSeen(pid);
        loadPlayer();
      }
      refresh();
      scan(false).then(refresh);
      setTimeout(() => activeEl() || move("down"), 800);
    });
    function loadPlayer() {
      let tries = 0;
      const t = setInterval(() => {
        if (typeof window.playNext !== "function" && ++tries < 40) return;
        clearInterval(t);
        const s = document.createElement("script");
        s.textContent = '(()=>{const y={playerBox:"#player",siteNextUp:".nextUp",episodeRow:t=>`tr.eplist[data-epid="${t}"]`,epTitle:".epTitle",epThumb:"img.watch-episode-thumb",thumbBase:"https://img.xcdn.to/t/p/w300"};if(typeof window.playNext!="function")return;const H=window.playNext;let h=null,a=null;const J=()=>{var t,e;return(e=String((t=window.key)!=null?t:location.pathname).match(/\\d+/))==null?void 0:e[0]},b=()=>!!a&&a.autoplayEnabled&&!a.autoplayOff.includes(J()),k=document.head.appendChild(document.createElement("style"));k.textContent=`${y.siteNextUp} { display: none !important; }`,k.disabled=!0;function q(){try{a=JSON.parse(document.documentElement.dataset.fcSettings)}catch{a=null}a&&(!b()&&h===null?(h=window.autoplay,window.autoplay=!1):b()&&h!==null&&(window.autoplay=h,h=null),k.disabled=!b(),b()||f())}document.addEventListener("fc-settings",q),q();let T="",$="",v=!1,c=null,A=null,S=!1,s=null;const L="fc-still-watching",m=()=>({auto:0,lastInteraction:Date.now(),pending:!1}),g={get:()=>{var t;try{return(t=JSON.parse(sessionStorage.getItem(L)))!=null?t:m()}catch{return m()}},set:t=>{try{sessionStorage.setItem(L,JSON.stringify(t))}catch{}}};function M(t){!t.isTrusted||s&&t.composedPath().includes(s)||(g.set(m()),s&&P())}document.addEventListener("pointerdown",M,!0),document.addEventListener("keydown",M,!0),window.playNext=function(...t){if(!v){if(f(),!S&&(a!=null&&a.stillWatching)&&window.autoplay&&!window.playNextGuard){const e=g.get();e.auto+=1,e.pending=e.auto>=a.swEpisodes||Date.now()-e.lastInteraction>=a.swMinutes*6e4,g.set(e)}return S=!1,H.apply(this,t)}},document.addEventListener("timeupdate",t=>{var n;const e=t.target;if(!(e instanceof HTMLVideoElement))return;if(s){e.paused||e.pause();return}if(!b()||!(e.duration>120))return;const i=String((n=window.key)!=null?n:location.pathname);if(i!==T){if(e.currentSrc===$)return;if(T=i,$=e.currentSrc,v=!1,f(),a.stillWatching&&g.get().pending)return z(e)}if(!window.autoplay||e.duration-e.currentTime>a.creditsOffset+1)return f();!c&&!v&&K(e)},!0);function K(t){const e=document.querySelector(y.episodeRow(window.activeID-1)),i=a.countdownSecs;let n=i;c=Y(e,i),e&&(A=setInterval(()=>{t.paused||(n=Math.max(0,n-.25),c.tick(n),n===0&&N(!1))},250))}function N(t){f(),S=t===!0,window.playNext()}function E(){v=!0,f()}function f(){clearInterval(A),c==null||c.remove(),c=null}function R(t){if(c){if(t.key==="Escape")E();else if(t.key==="Enter"&&c.hasNext&&!t.composedPath().includes(c))N(!0);else return;t.preventDefault(),t.stopPropagation()}}document.addEventListener("keydown",R,!0);const U=`\n    .box { font: 14px/1.3 system-ui, sans-serif; color: #fff; background: rgba(20,20,20,.92); border-radius: 8px;\n           padding: 12px; width: 300px; box-shadow: 0 4px 24px rgba(0,0,0,.5); display: grid; gap: 10px; }\n    .head { display: flex; gap: 10px; align-items: center; }\n    img { width: 96px; aspect-ratio: 16/9; object-fit: cover; border-radius: 4px; background: #333; }\n    .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #aaa; }\n    .title { font-weight: 600; }\n    .actions { display: flex; gap: 8px; }\n    button { font: inherit; border: 0; border-radius: 4px; padding: 7px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; }\n    button:focus-visible { outline: 2px solid #18a2b8; outline-offset: 2px; }\n    .play { background: #fff; color: #111; font-weight: 600; flex: 1; justify-content: center; }\n    .cancel { background: rgba(255,255,255,.15); color: #fff; }\n    svg { transform: rotate(-90deg); }\n    circle { fill: none; stroke-width: 3; }\n    .track { stroke: rgba(0,0,0,.15); }\n    .ring { stroke: #111; stroke-linecap: round; }\n  `,C=8,I=2*Math.PI*C;function B(t){var d;const e=document.createElement("div");e.style.cssText=`position:absolute;z-index:2147483647;${t}`;const i=e.attachShadow({mode:"open"});i.innerHTML=`<style>${U}</style>`,((d=document.querySelector(y.playerBox))!=null?d:document.body).append(e);const n=o(i,"div","box");return n.addEventListener("keydown",r=>{var u,p;const l=(p=(u=r.target).closest)==null?void 0:p.call(u,"button");!l||r.key!=="Enter"&&r.key!==" "||(r.preventDefault(),r.stopPropagation(),l.click())}),{host:e,box:n}}function z(t){var p;t.pause(),s==null||s.remove();const e=(p=/Episodes of (.+?) \\(\\d{4}\\)/.exec(document.title))==null?void 0:p[1],{host:i,box:n}=B("left:50%;top:50%;transform:translate(-50%,-50%)");n.setAttribute("role","alertdialog"),n.setAttribute("aria-labelledby","q"),n.setAttribute("aria-modal","true");const d=o(n,"div","title");d.id="q",d.textContent=e?`Are you still watching ${e}?`:"Are you still watching?";const r=o(n,"div","actions"),l=o(r,"button","play");l.textContent="Continue watching",l.onclick=P;const u=o(r,"button","cancel");u.textContent="Back to browse",u.onclick=()=>{g.set(m()),location.assign(location.pathname.split("/").slice(0,5).join("/"))},n.addEventListener("keydown",x=>{x.key==="Tab"&&(x.preventDefault(),x.stopPropagation(),(x.target===l?u:l).focus())}),s=i,queueMicrotask(()=>l.focus({preventScroll:!0}))}function P(){var t;g.set(m()),s==null||s.remove(),s=null,(t=document.querySelector("video"))==null||t.play().catch(()=>{})}function Y(t,e){var d,r,l;const{host:i,box:n}=B("right:24px;bottom:72px");if(n.setAttribute("role","dialog"),!t)n.setAttribute("aria-label","All caught up"),o(n,"div","title").textContent="You\'re all caught up",o(n,"div","label").textContent="No more episodes of this show yet.",o(o(n,"div","actions"),"button","cancel").textContent="Close",n.querySelector("button").onclick=E;else{n.setAttribute("aria-label","Next episode");const u=o(n,"div","head"),p=(d=t.querySelector(y.epThumb))==null?void 0:d.dataset.img;p&&Object.assign(o(u,"img"),{src:y.thumbBase+p,alt:""});const x=o(u,"div");o(x,"div","label").textContent=`Next \\xB7 S${t.dataset.pes} E${t.dataset.pep}`,o(x,"div","title").textContent=(l=(r=t.querySelector(y.epTitle))==null?void 0:r.textContent.trim())!=null?l:"";const D=o(n,"div","actions"),w=o(D,"button","play");w.innerHTML=`<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle class="track" cx="10" cy="10" r="${C}"/><circle class="ring" cx="10" cy="10" r="${C}" stroke-dasharray="${I}" stroke-dashoffset="0"/></svg><span></span>`;const G=w.querySelector(".ring"),O=w.querySelector("span");O.textContent=`Next episode in ${e}`,w.onclick=()=>N(!0);const j=o(D,"button","cancel");j.textContent="Not now",j.onclick=E,i.tick=W=>{G.setAttribute("stroke-dashoffset",String(I*(1-W/e))),O.textContent=`Next episode in ${Math.ceil(W)}`},queueMicrotask(()=>w.focus({preventScroll:!0}))}return i.hasNext=!!t,i}function o(t,e,i){const n=t.appendChild(document.createElement(e));return i&&(n.className=i),n}})();\n';
        document.documentElement.appendChild(s);
      }, 250);
    }
    const playerOpen = () => !!document.querySelector(".player:not(.hide) video");
    const inOverlay = () => {
      var _a, _b;
      return !!((_b = (_a = activeEl()) == null ? void 0 : _a.getRootNode) == null ? void 0 : _b.call(_a).host);
    };
    const handled = /* @__PURE__ */ new Set();
    window.addEventListener("keyup", (e) => {
      if (siteActive && handled.delete(e.keyCode)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    window.addEventListener("keydown", (e) => {
      var _a, _b;
      if (!siteActive) return;
      const code = e.keyCode;
      if (KEYS[code]) {
        if (playerOpen() && !inOverlay()) return;
        if (move(KEYS[code])) e.preventDefault();
        e.stopPropagation();
        handled.add(code);
      } else if (code === 13) {
        const el = activeEl();
        if (el && !el.matches("a[href], button, input, select, textarea")) {
          e.preventDefault();
          e.stopPropagation();
          el.click();
        }
      } else if (BACK.includes(code)) {
        if (((_b = (_a = e.target).matches) == null ? void 0 : _b.call(_a, "input, textarea")) && code === 8) return;
        if (inOverlay()) return;
        e.preventDefault();
        if (playerOpen()) closePlayer();
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
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
        pushSettings();
        toast(`Autoplay ${s.autoplayEnabled ? "on" : "off"}`);
      }
    }, true);
    function closePlayer() {
      var _a;
      try {
        jwplayer("player").pause();
      } catch {
      }
      (_a = document.querySelector(".player")) == null ? void 0 : _a.classList.add("hide");
      history.replaceState(null, "", location.pathname.split("/").slice(0, 5).join("/"));
      const row = document.querySelector("tr.eplist.active, tr.eplist");
      if (row) focusEl(row);
    }
    function toast(text) {
      const t = document.body.appendChild(document.createElement("div"));
      t.className = "fc-toast";
      t.setAttribute("role", "status");
      t.textContent = text;
      setTimeout(() => t.remove(), 2e3);
    }
    function refresh() {
      var _a, _b, _c;
      const c = counts();
      for (const card of document.querySelectorAll('.cflip[data-href^="/watch/tv/"]')) {
        const n = c[card.dataset.href.split("/")[3]] || 0;
        const want = n ? `${n} new` : "";
        const badge = card.querySelector(".fc-new");
        if (((_a = badge == null ? void 0 : badge.textContent) != null ? _a : "") === want) continue;
        badge == null ? void 0 : badge.remove();
        if (want) Object.assign((_c = (_b = card.querySelector(".card-badge.top")) == null ? void 0 : _b.appendChild(document.createElement("span"))) != null ? _c : {}, { className: "badge badge-danger fc-new", textContent: want });
      }
      if (location.pathname === "/home") renderNewRow(c);
    }
    function renderNewRow(c) {
      var _a, _b;
      const shows = load();
      const withNew = Object.entries(c).filter(([, n]) => n).map(([pid, n]) => ({ pid, n, ...shows[pid] })).filter((s) => s.title);
      (_a = document.getElementById("fc-new-row")) == null ? void 0 : _a.remove();
      if (!withNew.length) return;
      const row = document.createElement("section");
      row.id = "fc-new-row";
      row.setAttribute("aria-label", "New episodes");
      row.innerHTML = '<h2>New episodes</h2><div class="fc-row"></div>';
      for (const s of withNew.sort((a, b) => b.n - a.n)) {
        const a = row.querySelector(".fc-row").appendChild(document.createElement("a"));
        a.className = "fc-card";
        a.href = `/watch/tv/${s.pid}/${s.slug}`;
        a.setAttribute("aria-label", `${s.title}, ${s.n} new episode${s.n > 1 ? "s" : ""}`);
        const img = a.appendChild(document.createElement("img"));
        img.src = `https://img.xcdn.to/t/p/w342/${s.poster}`;
        img.alt = "";
        a.appendChild(Object.assign(document.createElement("span"), { className: "fc-count", textContent: `${s.n} new` }));
        a.appendChild(Object.assign(document.createElement("span"), { className: "fc-title", textContent: s.title }));
      }
      const host = (_b = document.getElementById("content")) != null ? _b : document.body;
      host.insertBefore(row, host.firstChild);
      if (!candidates().some((x) => x.el === activeEl())) focusEl(row.querySelector("a"));
    }
  })();
})();
