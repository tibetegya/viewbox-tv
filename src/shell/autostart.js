// Movie pages start playing as soon as they load. A Jellyfin-style details page must not: that would record and
// sync a watch position just for browsing. Runs at injection time, before the site's scripts where possible.
export function holdMovieAutostart() {
  if (!/^\/watch\/movie\//.test(location.pathname) || location.hash === '#play') return;
  // 1) Intercept JW Player's setup() and force autostart off (works when we're injected before jwplayer.js).
  let jw;
  const wrap = (fn) => (typeof fn !== 'function' ? fn : new Proxy(fn, {
    apply(t, self, args) {
      const inst = Reflect.apply(t, self, args);
      if (inst && inst.setup && !inst.__fcHeld) {
        inst.__fcHeld = true;
        const setup = inst.setup;
        inst.setup = function (cfg) { return setup.call(this, !window.__fcAllowAutostart && cfg ? Object.assign({}, cfg, { autostart: false }) : cfg); };
      }
      return inst;
    },
  }));
  try { Object.defineProperty(window, 'jwplayer', { configurable: true, get: () => jw, set: (v) => { jw = wrap(v); } }); } catch (e) {}
  // 2) Fallback if we were injected too late: pause the moment it starts, unless Play was pressed.
  document.addEventListener('play', (e) => {
    if (window.__fcAllowAutostart || !(e.target instanceof HTMLVideoElement)) return;
    e.target.pause();
    try { window.jwplayer('player').pause(); } catch (err) {}
  }, true);
}
