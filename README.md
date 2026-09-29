# Viewbox TV (TizenBrew module)

A TV front end for a streaming site on a Samsung Tizen TV that looks and works like **Jellyfin's TV layout** (measurements in `JELLYFIN_STYLE.md`):
- **Home** — My Media tiles (Shows, Movies, Favourites), Continue Watching (from your watch history, 5–90 % watched), Next Up, New Episodes, then the site's latest / popular rows.
- **Favourites**, **Shows / Movies libraries** (poster grid, sort, endless scroll) and **Search** (on-screen letters, results by Shows / Movies).
- **Details** — poster, meta line, Play / Resume, Favourite, overview, genres; for series a Next Up card and season posters opening a season episode list.
- **Player** — Jellyfin-style on-screen controls (timeline, ⏪ ⏯ ⏩ ⏭, subtitles, quality, mute), the next-episode countdown card and "Are you still watching?".
Movie pages no longer start playing on their own; Play does.

It is a [TizenBrew](https://github.com/reisxd/TizenBrew) *site modification* module. TizenBrew opens the module's launcher page, where you enter the site address once; the module is then injected into every page of that site. The site itself still handles login, lists and playback. The site must use the same page markup this module was built for (see PRD Appendix A in the parent repo) — on any other site the module stays inactive.

## Remote
| Key | Action |
|---|---|
| Arrows | Move focus. While playing: the first press shows the controls; on the timeline ←/→ seek ±10 s |
| Enter | Open / play the focused item |
| Return (Back) | Hide the controls → leave playback → previous screen. On the countdown card: "Not now" |
| Play/Pause, ⏩ / ⏪ | Play/pause, ±10 s |
| Red | Autoplay on/off. On the start screen: change the site address |

## Build
`dist/main.js` is prebuilt and is what TizenBrew loads. It is built in the parent project, because `build.mjs` embeds `../content/player.js` (the countdown card / still-watching code shared with the Chrome extension):
```sh
cd tv && npm install && npm run build && npm test
```
Target: `chrome69`, for Tizen 5.5 (2020 TVs such as the TU8000).

## Publish (TizenBrew only loads public modules, via jsDelivr)
Published at **github.com/tibetegya/viewbox-tv** (contents of this folder at the repo root).
- **GitHub Pages** serves `docs/` (the launcher page) at `https://tibetegya.dev/viewbox-tv/` (the account's custom Pages domain), the `websiteURL` in `package.json`.
- Releases are tagged (`v0.2.0`, …); jsDelivr serves the module files from the repo.

## Install on the TV (one-time)
1. On the TV: Apps → press 1-2-3-4-5 on the remote → Developer mode **On**, Host PC IP = your computer's IP → restart the TV.
2. Install TizenBrew with the TizenBrew installer (see the TizenBrew README).
3. **Set Host PC IP back to `127.0.0.1`** (Apps → 1-2-3-4-5), then restart the TV. TizenBrew can only inject modules when Developer mode points at the TV itself — with any other IP the module never loads.
4. In TizenBrew, add the module `gh/tibetegya/viewbox-tv` (or pin a release, e.g. `gh/tibetegya/viewbox-tv@v0.2.3`) and launch "Viewbox TV".
5. First launch: select the address box, press Enter, type the site address (e.g. `example.com`), then **Open**. It's remembered; later launches open it after a 3-second start screen (press **Red** there to change it).
6. Sign in once with the site's own form and enter your list sync code if the site uses one — the TV's browser remembers both.

## Notes
- **New episodes come from the site's own show pages, not TMDB.** The site's CSP blocks outside APIs from injected page code, and TizenBrew doesn't bypass CSP. So "new" means actually playable on the site.
- Scans run when the app opens (and when data is over 6 h old), not in the background; no notifications.
- No auto-login: the TV's browser keeps the session.
