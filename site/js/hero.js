// hero.js — index.html only: the "Where were you stopped?" quick-start and
// the decorative road/route backdrop behind the hero. Vanilla, no deps.
// Nothing here reads or sends anything the visitor types.

// ---------- quick-start: state <select> -> check.html?state=XX ----------

const STATE_CODE = /^[A-Z]{2}$/;

async function initQuickstart() {
  const form = document.getElementById('quickstart');
  const sel = document.getElementById('qs-state');
  const hint = document.getElementById('qs-hint');
  if (!form || !sel || !hint) return;
  const go = form.querySelector('button[type="submit"]');
  // With the quick-start live, "Go" is the primary action and "Start a check"
  // steps back to secondary. Without JS, or if the list fails, it stays primary.
  // (The row is still invisible in its entrance delay here, so no flash.)
  const start = document.getElementById('hero-start');
  if (start) start.classList.add('btn-secondary');

  try {
    const res = await fetch('data/states-manifest.json');
    if (!res.ok) throw new Error('states manifest failed to load');
    const manifest = await res.json();
    if (!Array.isArray(manifest)) throw new Error('states manifest malformed');

    const frag = document.createDocumentFragment();
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Choose a state…';
    frag.appendChild(ph);
    for (const s of manifest) {
      const code = String((s && s.code) || '').toUpperCase();
      if (!STATE_CODE.test(code)) continue; // only well-formed codes reach the URL
      const o = document.createElement('option');
      o.value = code;
      o.textContent = String(s.name || code);
      frag.appendChild(o);
    }
    if (frag.childNodes.length < 2) throw new Error('states manifest empty');

    sel.textContent = '';
    sel.appendChild(frag);
    sel.disabled = false;
    if (go) go.disabled = false;
  } catch {
    // Leave the controls disabled rather than offering an empty list.
    sel.options[0].textContent = 'State list unavailable';
    form.classList.add('is-unavailable');
    if (start) start.classList.remove('btn-secondary');
    hint.textContent = 'The state list could not load. Use “Start a check” below — nothing was sent anywhere.';
  }
}

// ---------- ambient backdrop ----------
// A painted-asphalt road with drifting lane dashes and passing sprite
// traffic (a colored body + a lighter windshield + a soft shadow, top-down
// driving-game style), a mast-arm signal cycling at the roadside stop, a
// small roundabout junction the route rises from, a crosswalk, and a dashed
// route to a destination pin with a breathing halo. Static markup parsed
// with DOMParser so CSS can animate its parts. The root MUST carry xmlns,
// or the XML-parsed node is not an SVG element and renders at zero size.
//
// No viewBox: user units are CSS px, so nothing scales with the hero's
// height. Two nested viewports pin the parts to the hero's edges:
//   - the road hangs off the bottom-left corner (y=100%, drawn at negative y)
//     and runs full width, in the open lane below the buttons;
//   - the route + pin hang off the bottom-right corner (x=y=100%, drawn at
//     negative x/y), so the pin sits in the right gutter beside the headline
//     and the route rises from the road to the right of the controls. The
//     signal and roundabout sit in this same viewport, left of the route's
//     origin.

const ROUTE = 'M-285 -60 C-330 -150 -236 -170 -204 -260 S-150 -420 -150 -492';

const BACKDROP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" class="hb" width="100%" height="100%" aria-hidden="true" focusable="false">
  <defs>
    <mask id="hb-route-mask" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="6000" height="6000">
      <path class="hb-route-reveal" d="${ROUTE}" pathLength="100" fill="none" stroke="#fff" stroke-width="10"/>
    </mask>
  </defs>
  <svg y="100%" overflow="visible">
    <rect class="hb-road-bed" x="0" y="-60" width="100%" height="46"/>
    <line class="hb-road-edge" x1="0" y1="-60" x2="100%" y2="-60"/>
    <line class="hb-road-edge" x1="0" y1="-14" x2="100%" y2="-14"/>
    <g class="hb-lane"><path d="M-100 -37 H3000" stroke-dasharray="28 52"/></g>

    <g class="hb-car hb-car-a">
      <ellipse class="hb-car-shadow" cx="-25" cy="-19" rx="18" ry="3.5"/>
      <rect class="hb-car-body hb-body-red" x="-40" y="-30" width="30" height="9" rx="4.5"/>
      <rect class="hb-car-glass" x="-32" y="-28.5" width="14" height="6" rx="1.5"/>
      <path class="hb-indicator" d="M-44 -28 L-52 -25.5 L-44 -23 Z"/>
    </g>
    <g class="hb-car hb-car-c">
      <ellipse class="hb-car-shadow" cx="-12" cy="-21" rx="11" ry="3"/>
      <rect class="hb-car-body hb-body-blue" x="-20" y="-31" width="16" height="8" rx="4"/>
      <rect class="hb-car-glass" x="-16" y="-29.5" width="7" height="5" rx="1"/>
    </g>
    <g class="hb-car hb-car-e">
      <rect class="hb-car-body hb-body-amber" x="-15" y="-29" width="11" height="5" rx="2.5"/>
    </g>
    <g class="hb-car hb-car-f">
      <ellipse class="hb-car-shadow" cx="-43" cy="-17" rx="20" ry="4"/>
      <rect class="hb-car-body hb-body-slate" x="-60" y="-32" width="34" height="13" rx="2"/>
      <rect class="hb-car-glass" x="-54" y="-30" width="16" height="7" rx="1.5"/>
    </g>
  </svg>
  <svg x="100%" y="100%" overflow="visible">
    <g class="hb-car hb-car-b">
      <ellipse class="hb-car-shadow" cx="23" cy="-42" rx="16" ry="3.5"/>
      <rect class="hb-car-body hb-body-blue" x="10" y="-53" width="26" height="9" rx="4.5"/>
      <rect class="hb-car-glass" x="17" y="-51.5" width="12" height="6" rx="1.5"/>
    </g>
    <g class="hb-car hb-car-d">
      <ellipse class="hb-car-shadow" cx="78" cy="-42" rx="21" ry="4"/>
      <rect class="hb-car-body hb-body-cruiser" x="60" y="-54" width="36" height="10" rx="3"/>
      <rect class="hb-car-glass" x="69" y="-52" width="16" height="6.5" rx="1.5"/>
      <rect class="hb-lightbar hb-lightbar-red" x="73" y="-57" width="4" height="3"/>
      <rect class="hb-lightbar hb-lightbar-blue" x="78" y="-57" width="4" height="3"/>
    </g>
    <g class="hb-car hb-car-g">
      <ellipse class="hb-car-shadow" cx="49" cy="-40" rx="17" ry="3.5"/>
      <rect class="hb-car-body hb-body-amber" x="35" y="-52" width="28" height="10" rx="2.5"/>
      <rect class="hb-car-glass" x="42" y="-50" width="14" height="6" rx="1.5"/>
    </g>
    <g class="hb-signal" transform="translate(-352,-60)">
      <rect class="hb-signal-pole" x="-1.5" y="-34" width="3" height="34"/>
      <rect class="hb-signal-arm" x="-1.5" y="-38" width="20" height="3"/>
      <rect class="hb-signal-box" x="11" y="-47" width="15" height="19" rx="3"/>
      <circle class="hb-signal-light hb-signal-red" cx="18.5" cy="-40.5" r="2.6"/>
      <circle class="hb-signal-light hb-signal-yellow" cx="18.5" cy="-35.5" r="2.6"/>
      <circle class="hb-signal-light hb-signal-green" cx="18.5" cy="-30.5" r="2.6"/>
    </g>
    <g class="hb-dest">
      <path class="hb-yield-line" d="M-266 -58 L-270 -18 L-262 -18 Z"/>
      <g class="hb-crosswalk">
        <rect x="-249" y="-58" width="6" height="42"/>
        <rect x="-239" y="-58" width="6" height="42"/>
        <rect x="-229" y="-58" width="6" height="42"/>
      </g>
      <circle class="hb-pedestrian-head" cx="-245" cy="-66" r="2.5"/>
      <rect class="hb-pedestrian-body" x="-247" y="-63" width="4" height="7" rx="2"/>
      <g class="hb-roundabout" transform="translate(-285,-60)">
        <circle class="hb-roundabout-ring" r="14"/>
        <circle class="hb-roundabout-island" r="6"/>
        <line class="hb-roundabout-spoke" x1="0" y1="-14" x2="0" y2="-20"/>
        <line class="hb-roundabout-spoke" x1="0" y1="14" x2="0" y2="20"/>
        <line class="hb-roundabout-spoke" x1="-14" y1="0" x2="-20" y2="0"/>
        <line class="hb-roundabout-spoke" x1="14" y1="0" x2="20" y2="0"/>
      </g>
      <g class="hb-route-wrap"><path class="hb-route" d="${ROUTE}" mask="url(#hb-route-mask)"/></g>
      <circle class="hb-halo" cx="-150" cy="-533" r="30"/>
      <ellipse class="hb-pin-shadow" cx="-150" cy="-499" rx="10" ry="3"/>
      <path class="hb-pin" d="M-150 -500 C-157 -511 -166 -520 -166 -533 A16 16 0 1 1 -134 -533 C-134 -520 -143 -511 -150 -500 Z"/>
      <circle class="hb-pin-dot" cx="-150" cy="-533" r="5.5"/>
    </g>
  </svg>
</svg>`;

function initBackdrop() {
  const host = document.querySelector('.hero-backdrop');
  if (!host || host.firstElementChild) return;

  const doc = new DOMParser().parseFromString(BACKDROP_SVG, 'image/svg+xml');
  const root = doc.documentElement;
  // A parse failure yields a <parsererror> document instead of <svg>.
  if (!root || root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) return;
  host.appendChild(document.importNode(root, true));

  // Only spend frames while the hero is on screen.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) host.classList.toggle('is-paused', !e.isIntersecting);
    });
    io.observe(host);
  }
}

// ---------- yield & flow: the road pauses for a beat before navigating ----------
// A progressive-enhancement-only flourish for the hero's own controls (the
// quick-start form and its two buttons below it): on a plain click, the
// backdrop gets a brief "is-yielding" state (a painted yield line and a
// blinking indicator) before the real navigation happens, so leaving the
// page reads as the traffic pausing rather than a hard cut. Every case that
// isn't a plain same-tab click — a modifier key, a middle click, no
// backdrop, or prefers-reduced-motion — skips straight to instant,
// unmodified navigation; nothing here can trap a visitor on the page.
const YIELD_DELAY_MS = 160;

function initYield() {
  const backdrop = document.querySelector('.hero-backdrop');
  if (!backdrop) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const yieldThenGo = (go) => {
    backdrop.classList.add('is-yielding');
    window.setTimeout(() => {
      backdrop.classList.remove('is-yielding');
      go();
    }, YIELD_DELAY_MS);
  };

  const form = document.getElementById('quickstart');
  if (form) {
    form.addEventListener('submit', (ev) => {
      if (form.classList.contains('is-unavailable') || form.dataset.yielded) return;
      ev.preventDefault();
      form.dataset.yielded = '1';
      // form.submit() bypasses the submit event, so this can't re-enter.
      yieldThenGo(() => form.submit());
    });
  }

  document.querySelectorAll('.hero-stage a[href]').forEach((a) => {
    a.addEventListener('click', (ev) => {
      if (ev.defaultPrevented || ev.button !== 0) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      if (a.target === '_blank' || a.dataset.yielded) return;
      ev.preventDefault();
      a.dataset.yielded = '1';
      yieldThenGo(() => { window.location.href = a.href; });
    });
  });
}

initBackdrop();
initQuickstart();
initYield();
