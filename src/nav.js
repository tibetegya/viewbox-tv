// Spatial (D-pad) navigation: from the focused rect, pick the nearest candidate in the pressed direction.

const DIRS = {
  left: { axis: 'x', sign: -1 },
  right: { axis: 'x', sign: 1 },
  up: { axis: 'y', sign: -1 },
  down: { axis: 'y', sign: 1 },
};

const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

// Pure: `from` and `candidates[i].rect` are DOMRect-like. Returns the best candidate or null.
// Targets that overlap the current one sideways (same row for ←/→, same column for ↑/↓) win outright, nearest first;
// only if there are none do we fall back to a weighted score. (Edge gaps alone let a header tab above a row beat the
// next card in the row — the v0.3.0 "can't reach Favourites" bug.)
export function pickNext(from, candidates, dir) {
  const { axis, sign } = DIRS[dir];
  const other = axis === 'x' ? 'y' : 'x';
  const lo = other === 'x' ? 'left' : 'top';
  const size = other === 'x' ? 'width' : 'height';
  const a = center(from);
  const scored = [];
  for (const c of candidates) {
    const b = center(c.rect);
    const along = (b[axis] - a[axis]) * sign;
    if (along <= 1) continue; // not in that direction
    const gap = Math.max(0, c.rect[lo] - (from[lo] + from[size]), from[lo] - (c.rect[lo] + c.rect[size]));
    scored.push({ c, along, gap, off: Math.abs(b[other] - a[other]) });
  }
  const inLine = scored.filter((s) => s.gap === 0);
  const pool = inLine.length ? inLine : scored;
  let best = null;
  let bestScore = Infinity;
  for (const s of pool) {
    const score = s.along + s.gap * 2 + s.off * 0.1;
    if (score < bestScore) { bestScore = score; best = s.c; }
  }
  return best;
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [role="button"], .cflip, tr.eplist, .watch-season';
// Never focus these: on the site they reset watch progress for an episode / the whole show.
const NEVER = '.resetwatchedep, .resetwatchedall';

function visible(el) {
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  const s = getComputedStyle(el);
  return s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('.hide, [hidden]');
}

// Our overlays (content/player.js) live in open shadow roots; a modal one confines focus to itself.
function overlayRoots() {
  return [...document.querySelectorAll('#player > div')].map((h) => h.shadowRoot).filter(Boolean);
}

export function candidates() {
  const roots = overlayRoots();
  const modal = roots.find((r) => r.querySelector('[aria-modal="true"]'));
  const inside = roots.find((r) => r === activeEl()?.getRootNode());
  // A modal prompt, or the card you're already in, keeps the arrows to itself (Back / "Not now" gets you out).
  const scope = modal ? [modal] : inside ? [inside] : [document, ...roots];
  const els = scope.flatMap((root) => [...root.querySelectorAll(FOCUSABLE)]).filter((el) => !el.matches(NEVER) && visible(el));
  // One stop per card / episode row: drop targets nested inside another target.
  const set = new Set(els);
  const nested = (el) => { for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return true; return false; };
  return els.filter((el) => !nested(el)).map((el) => ({ el, rect: el.getBoundingClientRect() }));
}

export function focusEl(el) {
  if (!el.matches('a[href], button, input, select, textarea') && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
}

// The focused element, looking through open shadow roots.
export function activeEl() {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el && el !== document.body ? el : null;
}

export function move(dir) {
  const list = candidates();
  if (!list.length) return false;
  const cur = activeEl();
  const from = cur && list.some((c) => c.el === cur) ? cur.getBoundingClientRect() : { left: 0, top: -1, width: 0, height: 0 };
  const next = pickNext(from, list, cur ? dir : 'down') ?? (cur ? null : list[0]);
  if (next) focusEl(next.el);
  return !!next;
}
