# Viewbox TV (TizenBrew module)

A TV front end for a streaming site on a Samsung Tizen TV: remote (D-pad) navigation, a full-screen player, a "New episodes" row on the home page, "N new" badges, the next-episode countdown card, and "Are you still watching?".

It is a [TizenBrew](https://github.com/reisxd/TizenBrew) *site modification* module. TizenBrew opens the module's launcher page, where you enter the site address once; the module is then injected into every page of that site. The site itself still handles login, lists and playback. The site must use the same page markup this module was built for (see PRD Appendix A in the parent repo) — on any other site the module stays inactive.

## Remote
| Key | Action |
|---|---|
| Arrows | Move focus (inside the countdown card / prompt while it's open). With the player open: ←/→ seek, ↑/↓ volume (the site's own keys) |
| Enter | Open / play the focused item |
| Return (Back) | Close the player, otherwise go back |
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
1. On the TV: Apps → press 1-2-3-4-5 on the remote → Developer mode **On**, enter your computer's IP → restart the TV.
2. Install TizenBrew with the TizenBrew installer (see the TizenBrew README).
3. In TizenBrew, add the module `gh/tibetegya/viewbox-tv` and launch "Viewbox TV".
4. First launch: select the address box, press Enter, type the site address (e.g. `example.com`), then **Open**. It's remembered; later launches open it after a 3-second start screen (press **Red** there to change it).
5. Sign in once with the site's own form and enter your list sync code if the site uses one — the TV's browser remembers both.

## Notes
- **New episodes come from the site's own show pages, not TMDB.** The site's CSP blocks outside APIs from injected page code, and TizenBrew doesn't bypass CSP. So "new" means actually playable on the site.
- Scans run when the app opens (and when data is over 6 h old), not in the background; no notifications.
- No auto-login: the TV's browser keeps the session.
