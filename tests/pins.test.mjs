// pins.test.mjs — tests for the P5 courthouse map pins.
// Run order: validate.mjs -> build-data.mjs + build-pins.mjs -> this.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const pins = JSON.parse(readFileSync(join(root, 'site', 'data', 'pins-ne.json'), 'utf8')).pins;
const stateData = JSON.parse(readFileSync(join(root, 'site', 'data', 'ne.json'), 'utf8'));

// Mirrors OFFICIAL_HOSTS in scripts/validate.mjs (defense in depth on the test side).
const OFFICIAL_HOSTS = ['nebraskajudicial.gov', 'nebraska.gov', 'nefindalawyer.com'];
const hostIsOfficial = (url) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return OFFICIAL_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
};

const NE_BOUNDS = { lat: [40.0, 43.0], lng: [-104.1, -95.3] };
const REQUIRED = ['id', 'state', 'county', 'name', 'address', 'lat', 'lng', 'url', 'kind'];

test('pins file loads with at least one pin', () => {
  assert.ok(Array.isArray(pins) && pins.length > 0, 'pins must be a non-empty array');
});

test('every pin carries the full contract', () => {
  for (const pin of pins) {
    for (const f of REQUIRED) {
      assert.ok(pin[f] !== undefined && pin[f] !== null && pin[f] !== '',
        `pin ${pin.id || '?'}: ${f} required`);
    }
    assert.match(pin.id, /^[a-z0-9-]+$/, `pin id "${pin.id}" must be lowercase/digits/hyphens`);
    assert.equal(pin.state, 'NE', `pin ${pin.id}: state must be NE`);
    assert.equal(pin.kind, 'courthouse', `pin ${pin.id}: kind must be courthouse`);
  }
});

test('pin ids are unique', () => {
  const ids = pins.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate pin id');
});

test('pin coordinates fall inside Nebraska', () => {
  for (const pin of pins) {
    assert.ok(typeof pin.lat === 'number' && isFinite(pin.lat), `pin ${pin.id}: lat must be a number`);
    assert.ok(typeof pin.lng === 'number' && isFinite(pin.lng), `pin ${pin.id}: lng must be a number`);
    assert.ok(pin.lat >= NE_BOUNDS.lat[0] && pin.lat <= NE_BOUNDS.lat[1] &&
      pin.lng >= NE_BOUNDS.lng[0] && pin.lng <= NE_BOUNDS.lng[1],
      `pin ${pin.id}: (${pin.lat}, ${pin.lng}) outside Nebraska — bad geocode?`);
  }
});

test('pin urls are https on official hosts', () => {
  for (const pin of pins) {
    assert.ok(pin.url.startsWith('https://'), `pin ${pin.id}: url must be https`);
    assert.ok(hostIsOfficial(pin.url), `pin ${pin.id}: url host not on the official allowlist`);
  }
});

test('pin counties exist in the state file', () => {
  const counties = new Set(stateData.counties.map((c) => c.name));
  for (const pin of pins) {
    assert.ok(counties.has(pin.county), `pin ${pin.id}: unknown county "${pin.county}"`);
  }
});

test('pin data never implies ticket search', () => {
  const blob = JSON.stringify(pins);
  assert.ok(!/search (your|any|the) tickets?/i.test(blob),
    'pins must not imply we search tickets');
  assert.ok(!/\b(SSN|driver.?license number|date of birth)\b/i.test(blob),
    'pins must not reference identity fields');
});

test('map page + script contract', () => {
  const html = readFileSync(join(root, 'site', 'map.html'), 'utf8');
  const js = readFileSync(join(root, 'site', 'js', 'map.js'), 'utf8');
  assert.ok(html.includes('class="skip"'), 'map.html needs a skip link');
  assert.ok(html.includes('maplibre-gl@5.24.0'), 'map.html must pin the MapLibre CDN version');
  assert.ok(js.includes('pins-ne.json'), 'map script must load the built pins JSON');
  assert.ok(!/<input/i.test(html), 'map.html must contain no identity inputs');
  assert.ok(js.includes("target = '_blank'") && js.includes("rel = 'noopener'"),
    'map.js must open official sites with target=_blank rel=noopener');
  assert.ok(/we did not search any database/i.test(html), 'map.html keeps the no-search disclaimer');
  assert.ok(js.includes('setDOMContent'), 'map.js must build popups via setDOMContent (no innerHTML)');
  assert.ok(!/\.innerHTML\s*=/.test(js), 'map.js must not assign innerHTML on pin data');
});
