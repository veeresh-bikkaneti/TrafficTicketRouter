// map.js — MapLibre courthouse map for map.html.
// Pins come from site/data/pins-<st>.json (built from data/pins/<ST>.yaml);
// site/data/pins-manifest.json lists which states have a pin file.
// DOM only: markers/clusters/search are real <button>/<input> elements
// (keyboard-operable, 44px+ targets), popup content is built with
// textContent/createElement — never innerHTML.
//
// US-only view: the map is clamped with maxBounds + minZoom so panning/zooming
// can never reach a world view. It opens fit to the continental US; Alaska and
// Hawaii pins exist in the data and are reachable by panning within the US
// envelope. maxBounds alone fully enforces this: the camera can never zoom out
// or pan far enough for a repeated/wrapped world to become visible, which is
// what the renderWorldCopies map option (left deliberately unset here, so it
// keeps its default) would otherwise prevent. Verified against maplibre-gl
// 5.24.0: setting that option to disable world copies, combined with
// maxBounds, corrupts the camera's center (it lands far from the requested
// target) on any zoom-changing call — fitBounds, flyTo, jumpTo, even the
// initial constructor center. maxBounds by itself does not have this bug.
//
// No network calls beyond this page's own origin, the Esri tile services, and
// the CARTO dark tile host — matching this site's CSP. No API keys: all four
// basemaps are open tile services.
//
// Performance: the 50-state dataset ships ~2,300 pins. Below zoom ~10.5, pins
// are grouped into screen-space grid clusters (count bubbles) so the map never
// mounts thousands of DOM markers at once; above that zoom, individual pins
// render for whatever is in the current viewport, capped at MAX_MARKERS.
//
// Clean default view: the national overview otherwise tiles wall-to-wall with
// cluster bubbles the moment the map opens, which reads as noise rather than
// a starting point. So the very first camera settle (the programmatic
// fitBounds to the continental US on load) renders nothing; a jump-to-state/
// county control and the courthouse search box are the intended way in, and
// any pan/zoom past that point (manual or programmatic) renders normally.

const PINS_MANIFEST_URL = 'data/pins-manifest.json';
const STATES_MANIFEST_URL = 'data/states-manifest.json';
const MAX_MARKERS = 500;
const FALLBACK_LIST_CAP = 100;
const CLUSTER_ZOOM = 10.5;
const CLUSTER_CELL_PX = 64;

// US envelope including Alaska and Hawaii — panning/zooming is clamped here.
const US_MAX_BOUNDS = [[-180, 15], [-50, 55]];
// Continental-US framing for the initial view.
const US_CONTINENTAL_BOUNDS = [[-125.5, 24.0], [-66.5, 50.0]];

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
      a.rel = 'noopener noreferrer';
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
      more.append(a, ' to find your county’s official page.');
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

function popupNode(pins) {
  const node = document.createElement('div');
  node.className = 'map-popup';
  for (const pin of pins) {
    const h = document.createElement('h3');
    h.textContent = pin.name;
    const county = document.createElement('p');
    county.className = 'map-popup-county';
    county.textContent = pin.county;
    const addr = document.createElement('p');
    addr.className = 'map-popup-addr';
    addr.textContent = pin.address;
    const link = document.createElement('a');
    link.className = 'btn';
    link.href = pin.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open official site';
    node.append(h, county, addr, link);
  }
  return node;
}

// Once the drop-in/pop-in animation finishes, clear it: a filling CSS
// animation keeps cascade priority over normal declarations (like :hover)
// targeting the same properties, which would otherwise mute the hover scale.
function releaseAnimationOnEnd(el) {
  el.addEventListener('animationend', () => { el.style.animation = 'none'; }, { once: true });
}

function markerButton(pin, delayMs) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'map-pin';
  el.style.setProperty('--d', `${delayMs}ms`);
  el.setAttribute('aria-label', `${pin.name}, ${pin.county} — show details`);
  releaseAnimationOnEnd(el);
  return el;
}

function clusterButton(count, delayMs) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'map-cluster';
  el.style.setProperty('--d', `${delayMs}ms`);
  const size = Math.max(44, Math.min(52, 40 + Math.round(Math.log2(count + 1) * 4)));
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.textContent = String(count);
  el.setAttribute('aria-label', `${count} courthouses in this area — expand`);
  releaseAnimationOnEnd(el);
  return el;
}

// ---------- basemaps ----------
// Inline style, all rasters as layers toggled by visibility — no external
// style.json fetch (keeps everything inside the CSP img-src/connect-src
// allowlist: server.arcgisonline.com + a.basemaps.cartocdn.com). No API keys.
const BASEMAPS = [
  { id: 'street', label: 'Street', boundaries: true },
  { id: 'imagery', label: 'Satellite', boundaries: true },
  { id: 'topo', label: 'Terrain', boundaries: false },
  { id: 'dark', label: 'Night', boundaries: false },
];

function mapStyle() {
  return {
    version: 8,
    sources: {
      street: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Esri',
      },
      imagery: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Esri',
      },
      topo: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Esri',
      },
      boundaries: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Esri',
      },
      dark: {
        type: 'raster',
        tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 20,
        attribution: 'CARTO, OpenStreetMap contributors',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#e8e0cb' } },
      { id: 'street', type: 'raster', source: 'street', layout: { visibility: 'visible' } },
      { id: 'imagery', type: 'raster', source: 'imagery', layout: { visibility: 'none' } },
      { id: 'topo', type: 'raster', source: 'topo', layout: { visibility: 'none' } },
      { id: 'dark', type: 'raster', source: 'dark', layout: { visibility: 'none' } },
      { id: 'boundaries', type: 'raster', source: 'boundaries', layout: { visibility: 'none' } },
    ],
  };
}

function setBasemap(map, id) {
  for (const b of BASEMAPS) {
    map.setLayoutProperty(b.id, 'visibility', b.id === id ? 'visible' : 'none');
  }
  const active = BASEMAPS.find((b) => b.id === id);
  map.setLayoutProperty('boundaries', 'visibility', active && active.boundaries ? 'visible' : 'none');
}

// A real IControl (not a freely-positioned div) so MapLibre stacks it above
// the NavigationControl in the top-right corner instead of overlapping it.
class LayerSwitcherControl {
  onAdd(map) {
    const wrap = document.createElement('div');
    wrap.className = 'maplibregl-ctrl map-layers';
    wrap.setAttribute('role', 'radiogroup');
    wrap.setAttribute('aria-label', 'Map style');
    let current = 'street';
    const buttons = [];
    for (const b of BASEMAPS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'map-layer-btn';
      btn.textContent = b.label;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', b.id === current ? 'true' : 'false');
      btn.addEventListener('click', () => {
        current = b.id;
        buttons.forEach((x) => x.el.setAttribute('aria-checked', x.id === current ? 'true' : 'false'));
        setBasemap(map, current);
      });
      buttons.push({ id: b.id, el: btn });
      wrap.appendChild(btn);
    }
    this._container = wrap;
    return wrap;
  }
  onRemove() {
    this._container.remove();
  }
}

// ---------- search ----------
function buildSearch(pins, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'map-search';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'map-search-input';
  input.className = 'map-search-input';
  input.placeholder = 'Find a courthouse or county…';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', 'map-search-list');
  input.setAttribute('aria-label', 'Find a courthouse or county');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('spellcheck', 'false');

  const list = document.createElement('ul');
  list.id = 'map-search-list';
  list.className = 'map-search-list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;

  wrap.append(input, list);

  let matches = [];
  let activeIndex = -1;

  function render() {
    list.textContent = '';
    matches.forEach((pin, i) => {
      const li = document.createElement('li');
      li.className = 'map-search-option';
      li.id = `map-search-opt-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
      li.classList.toggle('active', i === activeIndex);
      const strong = document.createElement('strong');
      strong.textContent = pin.name;
      li.append(strong, document.createTextNode(` — ${pin.county}, ${pin.state}`));
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        pick(i);
      });
      list.appendChild(li);
    });
    list.hidden = matches.length === 0;
    input.setAttribute('aria-expanded', matches.length > 0 ? 'true' : 'false');
  }

  function setActive(i) {
    activeIndex = i;
    list.querySelectorAll('.map-search-option').forEach((el, idx) => {
      el.classList.toggle('active', idx === i);
      el.setAttribute('aria-selected', idx === i ? 'true' : 'false');
    });
    if (i >= 0) {
      input.setAttribute('aria-activedescendant', `map-search-opt-${i}`);
      const el = list.children[i];
      if (el) el.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function close() {
    matches = [];
    activeIndex = -1;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function pick(i) {
    const pin = matches[i];
    if (!pin) return;
    close();
    input.value = '';
    input.blur();
    onPick(pin);
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q === '') {
      close();
      return;
    }
    matches = pins
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.county.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q))
      .slice(0, 8);
    activeIndex = -1;
    render();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (matches.length) setActive(Math.min(activeIndex + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (matches.length) setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        pick(activeIndex);
      }
    } else if (e.key === 'Escape') {
      close();
    }
  });

  input.addEventListener('blur', () => {
    // Let a mousedown pick fire first, then close.
    setTimeout(close, 120);
  });

  return wrap;
}

// Bounding box of a set of pins, as [[west, south], [east, north]] for
// map.fitBounds. A single pin (or a tight cluster) collapses to a point —
// callers pad/clamp the zoom rather than fitBounds a zero-size box.
function boundsOf(pins) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of pins) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

// ---------- jump to state / county ----------
// A guided narrow-down for anyone who'd rather pick their state (then county)
// than hunt through the national cluster view. Native <select>s: state lists
// stay short, but a few states have 100+ counties with pins, and a native
// select handles that (scrolling, type-ahead-to-jump) for free.
function buildJump(pins, statesManifest, onZoomTo) {
  const wrap = document.createElement('div');
  wrap.className = 'map-jump';

  const stateNames = new Map((statesManifest || []).map((s) => [s.code, s.name]));
  const byState = new Map();
  for (const p of pins) {
    if (!byState.has(p.state)) byState.set(p.state, []);
    byState.get(p.state).push(p);
  }
  const stateCodes = [...byState.keys()].sort((a, b) =>
    (stateNames.get(a) || a).localeCompare(stateNames.get(b) || b));

  const stateSel = document.createElement('select');
  stateSel.className = 'map-jump-select';
  stateSel.setAttribute('aria-label', 'Jump to a state');
  stateSel.append(new Option('Jump to a state…', ''));
  for (const code of stateCodes) {
    stateSel.append(new Option(stateNames.get(code) || code, code));
  }

  const countySel = document.createElement('select');
  countySel.className = 'map-jump-select';
  countySel.setAttribute('aria-label', 'Jump to a county');
  countySel.disabled = true;
  countySel.append(new Option('Choose a state first…', ''));

  function fillCounties(code) {
    countySel.textContent = '';
    if (!code) {
      countySel.disabled = true;
      countySel.append(new Option('Choose a state first…', ''));
      return;
    }
    const statePins = byState.get(code) || [];
    const counties = [...new Set(statePins.map((p) => p.county))].sort();
    countySel.disabled = counties.length === 0;
    countySel.append(new Option(`All of ${stateNames.get(code) || code}`, ''));
    for (const county of counties) countySel.append(new Option(county, county));
  }

  stateSel.addEventListener('change', () => {
    const code = stateSel.value;
    fillCounties(code);
    if (!code) return;
    const statePins = byState.get(code) || [];
    onZoomTo(statePins, `${stateNames.get(code) || code} (statewide)`);
  });

  countySel.addEventListener('change', () => {
    const code = stateSel.value;
    const county = countySel.value;
    if (!code) return;
    const statePins = byState.get(code) || [];
    const target = county ? statePins.filter((p) => p.county === county) : statePins;
    onZoomTo(target, county ? `${county}, ${code}` : `${stateNames.get(code) || code} (statewide)`);
  });

  wrap.append(stateSel, countySel);
  return wrap;
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

// Group pins sharing (near-)identical coordinates into one dot; its popup
// lists every courthouse at that address instead of stacking hidden markers.
function dedupe(pins) {
  const byKey = new Map();
  for (const pin of pins) {
    const key = `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(pin);
  }
  return [...byKey.values()].map((group) => ({
    lat: group[0].lat,
    lng: group[0].lng,
    pins: group,
  }));
}

async function init() {
  if (typeof maplibregl === 'undefined') {
    showFallback('The map library could not load (check your connection and try again).');
    return;
  }
  let rawPins;
  try {
    rawPins = await loadPins();
  } catch (e) {
    showFallback('The map data could not load (check your connection and try again).');
    return;
  }
  if (!Array.isArray(rawPins) || rawPins.length === 0) {
    showFallback('No courthouse pins are available yet.');
    return;
  }
  // Full state names for the jump-to control; non-fatal if this fails — the
  // control still works, falling back to two-letter codes as labels.
  let statesManifest = null;
  try {
    const r = await fetch(STATES_MANIFEST_URL);
    if (r.ok) statesManifest = await r.json();
  } catch { /* fall back to state codes as labels */ }

  const points = dedupe(rawPins);
  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const map = new maplibregl.Map({
    container: mapEl,
    style: mapStyle(),
    center: [-98.5, 39.8],
    zoom: 3,
    minZoom: 3,
    maxBounds: US_MAX_BOUNDS,
    attributionControl: false,
  });
  map.addControl(new maplibregl.AttributionControl({
    compact: true,
    customAttribution: 'Esri · OpenStreetMap contributors · CARTO',
  }), 'bottom-right');
  map.addControl(new LayerSwitcherControl(), 'top-right');
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

  let openKey = null;
  let openPopup = null;
  function closeOpen() {
    if (openPopup) { openPopup.remove(); openPopup = null; }
    openKey = null;
  }

  const mounted = [];
  function clearMarkers() {
    for (const m of mounted) m.remove();
    mounted.length = 0;
  }

  function openPopupFor(point, key, focusClose) {
    closeOpen();
    openKey = key;
    openPopup = new maplibregl.Popup({ offset: 30, maxWidth: '320px' })
      .setLngLat([point.lng, point.lat])
      .setDOMContent(popupNode(point.pins))
      .addTo(map);
    openPopup.on('close', () => { openKey = null; openPopup = null; });
    if (focusClose) {
      const closeBtn = openPopup.getElement().querySelector('.maplibregl-popup-close-button');
      if (closeBtn) closeBtn.focus();
    }
  }

  function addPointMarker(point, key, delayMs) {
    const el = markerButton(point.pins[0], reduceMotion ? 0 : delayMs);
    if (point.pins.length > 1) {
      el.classList.add('map-pin-multi');
      el.setAttribute('aria-label', `${point.pins.length} courthouses at this address — show details`);
    }
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([point.lng, point.lat])
      .addTo(map);
    mounted.push(marker);
    el.addEventListener('click', (ev) => {
      // Without this, the click that opens the popup keeps bubbling past this
      // button to the map container, where MapLibre's own default
      // closeOnClick listener treats it as an outside click and immediately
      // closes the popup this same click just opened.
      ev.stopPropagation();
      openPopupFor(point, key, ev.detail === 0);
    });
  }

  function addClusterMarker(cx, cy, cellPoints, delayMs) {
    const count = cellPoints.reduce((n, p) => n + p.pins.length, 0);
    const el = clusterButton(count, reduceMotion ? 0 : delayMs);
    const center = map.unproject([cx, cy]);
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(center)
      .addTo(map);
    mounted.push(marker);
    el.addEventListener('click', () => {
      const [[minLng, minLat], [maxLng, maxLat]] = boundsOf(cellPoints);
      const spreadLat = maxLat - minLat, spreadLng = maxLng - minLng;
      // Tight group (all effectively at one screen point): step in with an
      // ease. Spread group: fit its bounds so every pin becomes reachable.
      if (spreadLat < 0.05 && spreadLng < 0.05) {
        map.easeTo({ center: center, zoom: Math.min(map.getZoom() + 2.5, 16) });
      } else {
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, maxZoom: 16 });
      }
    });
  }

  function updateCount(shown, total) {
    countEl.textContent = '';
    if (total === 0) {
      countEl.textContent = 'No courthouse pins in this view — pan or zoom out.';
    } else {
      countEl.textContent = `${total} courthouse${total === 1 ? '' : 's'} in view` +
        (shown < total ? ` — showing ${shown}.` : '.');
    }
  }

  function renderInView() {
    const wasOpenPoint = openKey;
    clearMarkers();
    const b = map.getBounds();
    const w = b.getWest(), e = b.getEast(), s = b.getSouth(), n = b.getNorth();
    const inView = points.filter(
      (p) => p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n
    );
    const totalPins = inView.reduce((n, p) => n + p.pins.length, 0);

    // Close the open popup only once its point has left the current view —
    // it must survive marker re-renders on every pan/zoom otherwise.
    if (wasOpenPoint && !inView.some((p) => `${p.lat},${p.lng}` === wasOpenPoint)) {
      closeOpen();
    }

    if (map.getZoom() < CLUSTER_ZOOM && inView.length > 1) {
      // Screen-space grid clustering: bucket by projected pixel cell so
      // bubbles never collide, independent of geographic distance.
      const cells = new Map();
      for (const p of inView) {
        const px = map.project([p.lng, p.lat]);
        const cx = Math.floor(px.x / CLUSTER_CELL_PX);
        const cy = Math.floor(px.y / CLUSTER_CELL_PX);
        const key = `${cx},${cy}`;
        if (!cells.has(key)) cells.set(key, { sumX: 0, sumY: 0, points: [] });
        const cell = cells.get(key);
        cell.sumX += px.x; cell.sumY += px.y; cell.points.push(p);
      }
      let i = 0;
      let shownPins = 0;
      for (const cell of cells.values()) {
        const delay = reduceMotion ? 0 : Math.min(i * 18, 480);
        if (cell.points.length === 1) {
          const p = cell.points[0];
          addPointMarker(p, `${p.lat},${p.lng}`, delay);
          shownPins += p.pins.length;
        } else {
          addClusterMarker(cell.sumX / cell.points.length, cell.sumY / cell.points.length, cell.points, delay);
          shownPins += cell.points.reduce((n, p) => n + p.pins.length, 0);
        }
        i++;
      }
      updateCount(shownPins, totalPins);
    } else {
      const capped = inView.slice(0, MAX_MARKERS);
      capped.forEach((p, i) => {
        addPointMarker(p, `${p.lat},${p.lng}`, reduceMotion ? 0 : Math.min(i * 12, 480));
      });
      const shownPins = capped.reduce((n, p) => n + p.pins.length, 0);
      updateCount(shownPins, totalPins);
    }
  }

  const panel = document.createElement('div');
  panel.className = 'map-panel';

  const searchBox = buildSearch(rawPins, (pin) => {
    map.stop();
    map.flyTo({ center: [pin.lng, pin.lat], zoom: 14, essential: true });
    map.once('moveend', () => {
      openPopupFor({ lat: pin.lat, lng: pin.lng, pins: [pin] }, `${pin.lat},${pin.lng}`, true);
    });
  });

  // Zoom to a state's or a county's pins (from the jump-to control below).
  // A single pin — or every pin sitting at effectively the same point —
  // can't fitBounds a zero-size box, so it flies to a point instead.
  function zoomToPins(targetPins, label) {
    map.stop();
    if (targetPins.length === 0) return;
    countEl.textContent = `Zooming to ${label}…`;
    const [[w, s], [e, n]] = boundsOf(targetPins);
    if (targetPins.length === 1 || (Math.abs(e - w) < 0.001 && Math.abs(n - s) < 0.001)) {
      map.flyTo({ center: [(w + e) / 2, (s + n) / 2], zoom: 13, essential: true });
    } else {
      map.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 14 });
    }
  }
  const jumpControl = buildJump(rawPins, statesManifest, zoomToPins);

  panel.append(searchBox, jumpControl);
  mapEl.appendChild(panel);

  // The default view opens clean — no clusters covering the whole country —
  // so the first thing anyone sees isn't a wall of numbers. Search, the
  // jump-to control, or just panning/zooming manually all reveal pins from
  // then on; only the very first (purely programmatic) camera settle after
  // load is skipped.
  let skipNextMoveend = true;
  map.on('load', () => {
    map.fitBounds(US_CONTINENTAL_BOUNDS, { padding: 24, duration: 0 });
    countEl.textContent = 'Search a courthouse, or jump to a state below, to see pins — or pan and zoom in yourself.';
  });
  map.on('moveend', () => {
    if (skipNextMoveend) { skipNextMoveend = false; return; }
    renderInView();
  });
  map.on('error', (e) => {
    // A single failed tile (edge coverage gap, one basemap host blocked by a
    // network filter, a transient 404) fires this per source/tile and must
    // not be fatal — three other basemaps and every pin still work. Only a
    // genuine map-level failure (no sourceId) falls back to the plain list.
    if (e && e.sourceId) return;
    clearMarkers();
    mapEl.setAttribute('aria-hidden', 'true');
    showFallback('The interactive map failed to render.', rawPins);
  });
}

init();
