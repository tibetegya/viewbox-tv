// Launcher page (docs/index.html, the module's websiteURL): lets the viewer choose the site address on the TV.
// TizenBrew has no setting for a module's URL, but it injects this module into every page of its window,
// so the launcher can save an address here and navigate there.

const SITE_KEY = 'fc-site';
const RED = 403;
const SPLASH_MS = 3000;

export const isLauncher = () => !!document.querySelector('meta[name="fc-launcher"]');

// "example.com", "https://example.com/anything" → "https://example.com/home". Null if it isn't a usable address.
export function normalizeSite(input) {
  const raw = (input || '').trim();
  if (!raw) return null;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    return `${u.origin}/home`;
  } catch {
    return null;
  }
}

const saved = () => { try { return localStorage.getItem(SITE_KEY); } catch { return null; } };

export function runLauncher() {
  document.documentElement.classList.add('fc-tv', 'fc-launcher');
  document.body.innerHTML = '<main class="fc-launch" aria-live="polite"></main>';
  const main = document.querySelector('.fc-launch');
  const site = saved();
  if (site) splash(main, site); else form(main);
}

// Saved address: open it after a short pause; Red during the pause changes it.
function splash(main, site) {
  main.innerHTML = '<h1>Viewbox TV</h1><p class="fc-opening"></p><p class="fc-hint">Press the <span class="fc-red">Red</span> button to change the address</p>';
  main.querySelector('.fc-opening').textContent = `Opening ${new URL(site).host}…`;
  const go = setTimeout(() => location.replace(site), SPLASH_MS); // replace: Back never returns to the launcher
  const onKey = (e) => {
    if (e.keyCode !== RED && e.key !== 'r') return;
    e.preventDefault();
    clearTimeout(go);
    window.removeEventListener('keydown', onKey, true);
    form(main);
  };
  window.addEventListener('keydown', onKey, true);
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
  const input = main.querySelector('input');
  const button = main.querySelector('button');
  const error = main.querySelector('.fc-error');
  input.value = saved() ? new URL(saved()).host : '';
  input.focus();

  // Only Up/Down between the two controls; everything else (typing, Enter for the TV keyboard) stays native.
  main.addEventListener('keydown', (e) => {
    if (e.keyCode === 40 && document.activeElement === input) { e.preventDefault(); button.focus(); }
    else if (e.keyCode === 38 && document.activeElement === button) { e.preventDefault(); input.focus(); }
  });

  main.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const site = normalizeSite(input.value);
    if (!site) {
      error.textContent = 'That doesn\'t look like a web address. Try something like example.com.';
      input.focus();
      return;
    }
    try { localStorage.setItem(SITE_KEY, site); } catch {}
    location.replace(site);
  });
}
