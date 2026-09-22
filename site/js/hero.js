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
// A faint road with drifting lane dashes and passing traffic (two cars each
// way, staggered so they never bunch up), a traffic light cycling at the
// roadside stop, and a dashed route that draws from that stop to a
// destination pin with a breathing halo — the stop, then the route to the
// official door. Static markup parsed with DOMParser so CSS can animate its
// parts. The root MUST carry xmlns, or the XML-parsed node is not an SVG
// element and renders at zero size.
//
// No viewBox: user units are CSS px, so nothing scales with the hero's
// height. Two nested viewports pin the parts to the hero's edges:
//   - the road hangs off the bottom-left corner (y=100%, drawn at negative y)
//     and runs full width, in the open lane below the buttons;
//   - the route + pin hang off the bottom-right corner (x=y=100%, drawn at
//     negative x/y), so the pin sits in the right gutter beside the headline
//     and the route rises from the road to the right of the controls. The
//     signal sits in this same viewport, just left of the route's origin.

const ROUTE = 'M-330 -60 C-330 -150 -236 -170 -204 -260 S-150 -420 -150 -492';

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
    <rect class="hb-car hb-car-a" x="-40" y="-30" width="30" height="9" rx="4.5"/>
    <rect class="hb-car hb-car-c" x="-20" y="-31" width="16" height="8" rx="4"/>
  </svg>
  <svg x="100%" y="100%" overflow="visible">
    <rect class="hb-car hb-car-b" x="10" y="-53" width="26" height="9" rx="4.5"/>
    <rect class="hb-car hb-car-d" x="60" y="-54" width="36" height="10" rx="3"/>
    <g class="hb-signal" transform="translate(-352,-60)">
      <rect class="hb-signal-pole" x="-1.5" y="-34" width="3" height="34"/>
      <rect class="hb-signal-box" x="-7.5" y="-47" width="15" height="19" rx="3"/>
      <circle class="hb-signal-light hb-signal-red" cx="0" cy="-40.5" r="2.6"/>
      <circle class="hb-signal-light hb-signal-yellow" cx="0" cy="-35.5" r="2.6"/>
      <circle class="hb-signal-light hb-signal-green" cx="0" cy="-30.5" r="2.6"/>
    </g>
    <g class="hb-dest">
      <g class="hb-route-wrap"><path class="hb-route" d="${ROUTE}" mask="url(#hb-route-mask)"/></g>
      <circle class="hb-origin-ring" cx="-330" cy="-60" r="9"/>
      <circle class="hb-origin" cx="-330" cy="-60" r="4"/>
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

initBackdrop();
initQuickstart();
