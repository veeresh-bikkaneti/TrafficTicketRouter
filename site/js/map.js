// map.js — MapLibre courthouse map for map.html.
// Pins come from site/data/pins-ne.json (built from data/pins/NE.yaml).
// DOM only: markers are real <button>s (keyboard-operable, 44px+ targets),
// popup content is built with textContent — never innerHTML.
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const PINS_URL = 'data/pins-ne.json';

const mapEl = document.getElementById('map');
const fallbackEl = document.getElementById('map-fallback');

function showFallback(message, pins) {
  fallbackEl.hidden = false;
  fallbackEl.textContent = '';
  const p = document.createElement('p');
  p.textContent = message;
  fallbackEl.appendChild(p);
  if (pins && pins.length > 0) {
    const list = document.createElement('ul');
    for (const pin of pins) {
      const li = document.createElement('li');
      li.textContent = `${pin.name}, ${pin.county} County — `;
      const a = document.createElement('a');
      a.href = pin.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Open official site';
      li.appendChild(a);
      list.appendChild(li);
    }
    fallbackEl.appendChild(list);
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
  county.textContent = `${pin.county} County`;
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
  el.setAttribute('aria-label', `${pin.name}, ${pin.county} County — show details`);
  return el;
}

async function init() {
  if (typeof maplibregl === 'undefined') {
    showFallback('The map library could not load (check your connection and try again).');
    return;
  }
  let pins;
  try {
    const res = await fetch(PINS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pins = (await res.json()).pins;
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
    center: [-99.8, 41.5],
    zoom: 6,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');

  let open = null;
  const closeOpen = () => { if (open) { open.remove(); open = null; } };

  const bounds = new maplibregl.LngLatBounds();
  for (const pin of pins) {
    const el = markerButton(pin);
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([pin.lng, pin.lat])
      .addTo(map);
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
    bounds.extend([pin.lng, pin.lat]);
  }
  map.fitBounds(bounds, { padding: 60, maxZoom: 11 });
  map.on('error', () => {
    closeOpen();
    mapEl.setAttribute('aria-hidden', 'true');
    showFallback('The interactive map failed to render.', pins);
  });
}

init();
