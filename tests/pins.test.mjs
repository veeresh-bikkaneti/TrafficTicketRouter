// pins.test.mjs — tests for the P5 courthouse map pins, all states.
// Run order: validate.mjs -> build-data.mjs + build-pins.mjs -> this.
// Loops over every site/data/pins-<st>.json and its matching state file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_BOUNDS } from '../scripts/state-bounds.mjs';

const root = join(import.meta.dirname, '..');
const dataDir = join(root, 'site', 'data');
const pinFiles = readdirSync(dataDir).filter((f) => /^pins-[a-z]{2}\.json$/.test(f));
assert.ok(pinFiles.length > 0, 'no built pins-*.json files found');

const hostIsOfficial = (url, hosts) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (hosts || []).some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
};

const REQUIRED = ['id', 'state', 'county', 'name', 'address', 'lat', 'lng', 'url', 'kind'];

for (const pinFile of pinFiles) {
  const code = pinFile.replace(/^pins-/, '').replace(/\.json$/, '');
  const STATE = code.toUpperCase();
  const { pins } = JSON.parse(readFileSync(join(dataDir, pinFile), 'utf8'));
  const stateData = JSON.parse(readFileSync(join(dataDir, `${code}.json`), 'utf8'));
  const bounds = STATE_BOUNDS[STATE];
  assert.ok(bounds, `no STATE_BOUNDS entry for ${STATE}`);
  const officialHosts = stateData.official_hosts;
  assert.ok(Array.isArray(officialHosts) && officialHosts.length > 0,
    `${STATE}: official_hosts missing from built state JSON`);

  test(`${STATE}: pins file loads with at least one pin`, () => {
    assert.ok(Array.isArray(pins) && pins.length > 0, 'pins must be a non-empty array');
  });

  test(`${STATE}: every pin carries the full contract`, () => {
    for (const pin of pins) {
      for (const f of REQUIRED) {
        assert.ok(pin[f] !== undefined && pin[f] !== null && pin[f] !== '',
          `pin ${pin.id || '?'}: ${f} required`);
      }
      assert.match(pin.id, /^[a-z0-9-]+$/, `pin id "${pin.id}" must be lowercase/digits/hyphens`);
      assert.equal(pin.state, STATE, `pin ${pin.id}: state must be ${STATE}`);
      assert.equal(pin.kind, 'courthouse', `pin ${pin.id}: kind must be courthouse`);
    }
  });

  test(`${STATE}: pin ids are unique`, () => {
    const ids = pins.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate pin id');
  });

  test(`${STATE}: pin coordinates fall inside the state`, () => {
    for (const pin of pins) {
      assert.ok(typeof pin.lat === 'number' && isFinite(pin.lat), `pin ${pin.id}: lat must be a number`);
      assert.ok(typeof pin.lng === 'number' && isFinite(pin.lng), `pin ${pin.id}: lng must be a number`);
      assert.ok(pin.lat >= bounds.lat[0] && pin.lat <= bounds.lat[1] &&
        pin.lng >= bounds.lng[0] && pin.lng <= bounds.lng[1],
        `pin ${pin.id}: (${pin.lat}, ${pin.lng}) outside ${STATE} — bad geocode?`);
    }
  });

  test(`${STATE}: pin urls are https on official hosts`, () => {
    for (const pin of pins) {
      // Policy: https everywhere, except an official site with human-verified
      // broken TLS — then the working http URL is allowed when the pin's
      // verification_note actually asserts the breakage (mirrors
      // scripts/validate.mjs; a note that merely mentions "https" is not enough).
      const tlsBrokenOk = pin.url.startsWith('http://') &&
        typeof pin.verification_note === 'string' &&
        /certificate[^.]{0,80}(broken|error|invalid|expired|misconfigured|mismatch)|tls[^.]{0,80}(broken|error|disabled)/i.test(pin.verification_note);
      assert.ok(pin.url.startsWith('https://') || tlsBrokenOk,
        `pin ${pin.id}: url must be https (http allowed only with documented broken TLS)`);
      assert.ok(hostIsOfficial(pin.url, officialHosts),
        `pin ${pin.id}: url host not on the state's official_hosts allowlist`);
    }
  });

  test(`${STATE}: pin counties exist in the state file`, () => {
    const counties = new Set(stateData.counties.map((c) => c.name));
    for (const pin of pins) {
      assert.ok(counties.has(pin.county), `pin ${pin.id}: unknown county "${pin.county}"`);
    }
  });

  test(`${STATE}: pin data never implies ticket search`, () => {
    const blob = JSON.stringify(pins);
    assert.ok(!/search (your|any|the) tickets?/i.test(blob),
      'pins must not imply we search tickets');
    assert.ok(!/\b(SSN|driver.?license number|date of birth)\b/i.test(blob),
      'pins must not reference identity fields');
  });
}

test('map page + script contract', () => {
  const html = readFileSync(join(root, 'site', 'map.html'), 'utf8');
  const js = readFileSync(join(root, 'site', 'js', 'map.js'), 'utf8');
  assert.ok(html.includes('class="skip"'), 'map.html needs a skip link');
  assert.ok(html.includes('maplibre-gl@5.24.0'), 'map.html must pin the MapLibre CDN version');
  // The only <input> on this page is the client-side courthouse search box,
  // built by map.js (never present in the static markup) — no identity field
  // (name/DOB/DL/plate/VIN) is ever collected.
  assert.ok(!/<input/i.test(html), 'map.html must contain no static identity inputs');
  assert.ok(!/\b(ssn|driver.?s? licen[sc]e number|date of birth)\b/i.test(js),
    'map.js must never reference identity fields');
  assert.ok(js.includes("target = '_blank'") && js.includes("rel = 'noopener noreferrer'"),
    'map.js must open official sites with target=_blank rel=noopener noreferrer');
  assert.ok(/we did not search any database/i.test(html), 'map.html keeps the no-search disclaimer');
  assert.ok(js.includes('setDOMContent'), 'map.js must build popups via setDOMContent (no innerHTML)');
  assert.ok(!/\.innerHTML\s*=/.test(js), 'map.js must not assign innerHTML on pin data');
  assert.ok(js.includes('maxBounds') && js.includes('US_MAX_BOUNDS'),
    'map.js must clamp panning/zooming to a US envelope (US-only view)');
  assert.ok(js.includes('minZoom'), 'map.js must set a minZoom floor so users cannot zoom out to the world');
  assert.ok(!/renderWorldCopies:\s*false/.test(js),
    'renderWorldCopies:false must stay unset alongside maxBounds — verified to corrupt the camera center ' +
    'on any zoom-changing call in maplibre-gl 5.24.0; maxBounds alone already keeps the map US-only');
  assert.ok(js.includes('US_CONTINENTAL_BOUNDS') && js.includes('fitBounds'),
    'map.js must open fit to the continental US');
});
