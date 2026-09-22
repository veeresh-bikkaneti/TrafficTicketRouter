// map.js — MapLibre courthouse map for map.html.
// Pins come from site/data/pins-<st>.json (built from data/pins/<ST>.yaml);
// site/data/pins-manifest.json lists which states have a pin file.
// DOM only: markers are real <button>s (keyboard-operable, 44px+ targets),
// popup content is built with textContent — never innerHTML.
//
// Performance: the 50-state dataset ships ~2,300 pins. One DOM marker per pin
// is fine for a few hundred pins but janks low-end devices at national zoom,
// so this map only mounts markers for pins inside the current viewport
// (recomputed on moveend), capped at MAX_MARKERS. Zooming in reveals the rest;
// a live count tells the user when pins are hidden by the cap. The full pin
// set stays in memory and nothing is fetched twice. States without a pin file
// are skipped silently — the map never breaks on a missing file.
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const PINS_MANIFEST_URL = 'data/pins-manifest.json';
const MAX_MARKERS = 500;
const FALLBACK_LIST_CAP = 100;
// Continental-US framing. Alaska and Hawaii pins exist in the data and are
// reachable by panning/zooming; fitting all 50 states at once would shrink
// the continental US to a corner.
const US_BOUNDS = [[-125.5, 24.0], [-66.5, 50.0]];

const mapEl = document.getElementById('map');
const fallbackEl = document.getElementById('map-fallback');
const countEl = document.getElementById('map-count');

function showFallback(message, pins) {
  fallbackEl.hidden = false;
  fallbackEl.textContent = '';
  const p = document.createElement('p');
  p.textContent = message;
  fallbackEl.appendChild(p);
  if (pins && pins.length > 0) {
    const shown = pins.slice(0, FALLBACK_LIST_CAP);
    const list = document.createElement('ul');
    for (const pin of shown) {
      const li = document.createElement('li');
      li.textContent = `${pin.name}, ${pin.county} — `;
      const a = document.createElement('a');
      a.href = pin.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Open official site';
      li.appendChild(a);
      list.appendChild(li);
    }
    fallbackEl.appendChild(list);
    if (pins.length > shown.length) {
      const more = document.createElement('p');
      more.textContent = `…and ${pins.length - shown.length} more. `;
      const a = document.createElement('a');
      a.href = 'check.html';
      a.textContent = 'Start a check';
      more.append(a, ' to find your county\u2019s official page.');
      fallbackEl.appendChild(more);
    }
  } else {
    const a = document.createElement('a');
    a.href = 'check.html';
    a.textContent = 'Start a check';
    const p2 = document.createElement('p');
    p2.append('The same official pages are listed on the ', a, '.');
    fallbackEl.appendChild(p2);
  }
}

function popupNode(pin) {
  const node = document.createElement('div');
  node.className = 'map-popup';
  const h = document.createElement('h3');
  h.textContent = pin.name;
  const county = document.createElement('p');
  county.className = 'map-popup-county';
  county.textContent = `${pin.county}`;
  const addr = document.createElement('p');
  addr.className = 'map-popup-addr';
  addr.textContent = pin.address;
  const link = document.createElement('a');
  link.className = 'btn';
  link.href = pin.url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Open official site';
  node.append(h, county, addr, link);
  return node;
}

function markerButton(pin) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'map-pin';
  el.setAttribute('aria-label', `${pin.name}, ${pin.county} — show details`);
  return el;
}

async function loadPins() {
  const res = await fetch(PINS_MANIFEST_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const codes = await res.json();
  if (!Array.isArray(codes) || codes.length === 0) return [];
  // A state may legitimately lack a pin file (unverifiable courthouse data);
  // allSettled lets one failure skip that state without breaking the map.
  const results = await Promise.allSettled(
    codes.map(async (code) => {
      const r = await fetch(`data/pins-${code}.json`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = await r.json();
      return Array.isArray(body.pins) ? body.pins : [];
    })
  );
  return results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);
}

async function init() {
  if (typeof maplibregl === 'undefined') {
    showFallback('The map library could not load (check your connection and try again).');
    return;
  }
  let pins;
  try {
    pins = await loadPins();
  } catch (e) {
    showFallback('The map data could not load (check your connection and try again).');
    return;
  }
  if (!Array.isArray(pins) || pins.length === 0) {
    showFallback('No courthouse pins are available yet.');
    return;
  }

  const map = new maplibregl.Map({
    container: mapEl,
    style: STYLE_URL,
    center: [-98.5, 39.8],
    zoom: 3,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');

  let open = null;
  const closeOpen = () => { if (open) { open.remove(); open = null; } };

  const mounted = [];
  function clearMarkers() {
    closeOpen();
    for (const m of mounted) m.remove();
    mounted.length = 0;
  }

  function addMarker(pin) {
    const el = markerButton(pin);
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([pin.lng, pin.lat])
      .addTo(map);
    mounted.push(marker);
    el.addEventListener('click', (ev) => {
      closeOpen();
      open = new maplibregl.Popup({ offset: 30, maxWidth: '320px' })
        .setLngLat(marker.getLngLat())
        .setDOMContent(popupNode(pin))
        .addTo(map);
      // Keyboard activation (detail === 0): move focus into the popup so
      // screen-reader and keyboard users land on its content. Mouse users
      // keep focus on the marker they clicked.
      if (ev.detail === 0) {
        const closeBtn = open.getElement().querySelector('.maplibregl-popup-close-button');
        if (closeBtn) closeBtn.focus();
      }
    });
  }

  function updateCount(inView, shown) {
    countEl.textContent = '';
    if (inView === 0) {
      countEl.textContent = 'No courthouse pins in this view — pan or zoom out.';
    } else if (inView > shown) {
      countEl.textContent =
        `Showing ${shown} of ${inView} courthouses in view — zoom in to see more.`;
    }
  }

  function renderInView() {
    clearMarkers();
    const b = map.getBounds();
    const w = b.getWest(), e = b.getEast(), s = b.getSouth(), n = b.getNorth();
    const inView = pins.filter(
      (p) => p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n
    );
    for (const pin of inView.slice(0, MAX_MARKERS)) addMarker(pin);
    updateCount(inView.length, Math.min(inView.length, MAX_MARKERS));
  }

  map.fitBounds(US_BOUNDS, { padding: 24 });
  map.on('load', renderInView);
  map.on('moveend', renderInView);
  map.on('error', () => {
    clearMarkers();
    mapEl.setAttribute('aria-hidden', 'true');
    showFallback('The interactive map failed to render.', pins);
  });
}

init();
