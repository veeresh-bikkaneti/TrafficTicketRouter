// validate.mjs — schema + policy checks for data/states/*.yaml and data/pins/*.yaml
// Uses the vendored YAML-subset parser. Exits non-zero on any failure.
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseYAML } from './yaml.mjs';

// Cards must never be tagged vin_only: no court URL may present itself as a
// VIN lookup, so the router's intent set (which includes vin_only) is wider
// than this list on purpose. See router.js for the router side.
const INTENTS = ['lost_paper', 'history', 'handle_it'];
const VERIFICATIONS = ['unverified', 'link_ok', 'keys_documented', 'handoff_tested', 'disabled'];
const KINDS = ['statewide_cms', 'pay_portal', 'county_court', 'dmv', 'self_help', 'guidance'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const JUSTICE_COST_NOTES = 'confirm fee on the terms page; $17 as of 2026-09-20';

// M1: defense-in-depth — every URL a contributor adds must live on an official
// host. Human review stays the real gate; this is the automated one.
const OFFICIAL_HOSTS = ['nebraskajudicial.gov', 'nebraska.gov', 'nefindalawyer.com'];

function hostIsOfficial(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return OFFICIAL_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

function isRealDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const errors = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

function check(cond, file, msg) { if (!cond) err(file, msg); }

function validateFile(path) {
  const file = basename(path);
  let data;
  try {
    data = parseYAML(readFileSync(path, 'utf8'));
  } catch (e) {
    err(file, `YAML parse error: ${e.message}`);
    return;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    err(file, 'top level must be a mapping'); return;
  }
  const code = file.replace(/\.ya?ml$/, '');
  check(data.state === code, file, `state "${data.state}" must match file name "${code}"`);
  check(typeof data.state_name === 'string' && data.state_name.length > 0, file, 'state_name required');
  check(isRealDate(data.last_verified || ''), file, 'last_verified must be a real YYYY-MM-DD date');

  const counties = data.counties;
  check(Array.isArray(counties) && counties.length > 0, file, 'counties must be a non-empty list');
  const countyNames = new Set();
  for (const c of counties || []) {
    check(c && typeof c.name === 'string', file, 'each county needs a name');
    if (c && c.name) {
      check(!countyNames.has(c.name), file, `duplicate county "${c.name}"`);
      countyNames.add(c.name);
    }
  }

  const cards = data.cards;
  check(Array.isArray(cards) && cards.length > 0, file, 'cards must be a non-empty list');
  const ids = new Set();
  for (const card of cards || []) {
    const id = card && card.id ? String(card.id) : '(missing id)';
    const where = `${file} card "${id}"`;
    if (!card || typeof card !== 'object') { err(file, 'card must be a mapping'); continue; }
    check(/^[a-z0-9-]+$/.test(card.id || ''), file, `card id "${card.id}" must be lowercase letters, digits, hyphens`);
    check(!ids.has(card.id), file, `duplicate card id "${card.id}"`);
    ids.add(card.id);
    for (const f of ['agency', 'accepted_keys', 'cost']) {
      check(typeof card[f] === 'string' && card[f].length > 0, file, `${where}: ${f} required`);
    }
    check(VERIFICATIONS.includes(card.verification), file, `${where}: bad verification "${card.verification}"`);
    check(KINDS.includes(card.kind), file, `${where}: bad kind "${card.kind}"`);
    check(typeof card.cost_free === 'boolean', file, `${where}: cost_free must be boolean`);
    check(Array.isArray(card.limitations) && card.limitations.length > 0 &&
      card.limitations.every(l => typeof l === 'string'), file, `${where}: limitations must be a non-empty string list`);
    check(isRealDate(card.last_verified || ''), file, `${where}: last_verified must be a real YYYY-MM-DD date`);
    check(Number.isInteger(card.weight), file, `${where}: weight must be an integer`);
    check(Array.isArray(card.for_intents) && card.for_intents.length > 0 &&
      card.for_intents.every(i => INTENTS.includes(i)), file, `${where}: bad for_intents`);
    check(Array.isArray(card.for_counties) && card.for_counties.length > 0, file, `${where}: for_counties required`);
    for (const co of card.for_counties || []) {
      check(co === '*' || countyNames.has(co), file, `${where}: unknown county "${co}"`);
    }
    // The router only honors exclude_counties when for_counties is ['*'].
    if ((card.exclude_counties || []).length > 0) {
      check((card.for_counties || []).includes('*'),
        file, `${where}: exclude_counties is ignored unless for_counties is ["*"]`);
    }
    for (const co of card.exclude_counties || []) {
      check(countyNames.has(co), file, `${where}: unknown exclude_county "${co}"`);
    }
    if (card.source_url == null) {
      check(card.kind === 'guidance', file, `${where}: source_url may be null only for kind=guidance`);
    } else {
      check(typeof card.source_url === 'string' && card.source_url.startsWith('https://'),
        file, `${where}: source_url must be https`);
      check(hostIsOfficial(card.source_url),
        file, `${where}: source_url host is not on the official allowlist ${OFFICIAL_HOSTS.join(', ')}`);
    }
    if (card.link_check != null) {
      check(['auto', 'manual'].includes(card.link_check), file, `${where}: bad link_check`);
    }
    for (const l of card.extra_links || []) {
      check(l && typeof l.label === 'string' && typeof l.source_url === 'string' &&
        l.source_url.startsWith('https://'), file, `${where}: bad extra_link`);
      check(hostIsOfficial(l.source_url),
        file, `${where}: extra_link host is not on the official allowlist`);
    }
    // Policy: fee honesty in both directions.
    if (card.cost_free === false) {
      check(!/\bfree\b/i.test(card.cost), file, `${where}: cost_free=false but cost text says "free"`);
    } else {
      check(!/fee|\bcharge\b|\$[\d]/.test(card.cost),
        file, `${where}: cost_free=true but cost text mentions a fee or charge`);
    }
    // Policy (locked scope): the JUSTICE card must carry the exact confirm-fee note.
    if (card.id === 'justice-search') {
      check(card.cost_notes === JUSTICE_COST_NOTES,
        file, `${where}: cost_notes must read exactly "${JUSTICE_COST_NOTES}"`);
    }
  }
}

const dir = join(process.cwd(), 'data', 'states');
let files;
try {
  files = readdirSync(dir).filter(f => /\.ya?ml$/.test(f));
} catch {
  err('data/states', 'directory missing');
  files = [];
}
if (files.length === 0) err('data/states', 'no state files found');
for (const f of files) validateFile(join(dir, f));

// ---- pins (phase P5): county courthouse pins for the MapLibre map page ----
// Same defense-in-depth as cards: every pin URL must live on an official host,
// and coordinates must fall inside the state's bounding box so a bad geocode
// can never drop a pin in the wrong state.
const PIN_KINDS = ['courthouse'];
const STATE_BOUNDS = {
  NE: { lat: [40.0, 43.0], lng: [-104.1, -95.3] },
};

function countyNamesFor(stateCode) {
  try {
    const data = parseYAML(readFileSync(join(process.cwd(), 'data', 'states', `${stateCode}.yaml`), 'utf8'));
    return new Set((data.counties || []).map((c) => c && c.name));
  } catch {
    return null;
  }
}

function validatePinsFile(path) {
  const file = basename(path);
  let data;
  try {
    data = parseYAML(readFileSync(path, 'utf8'));
  } catch (e) {
    err(file, `YAML parse error: ${e.message}`);
    return;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    err(file, 'top level must be a mapping'); return;
  }
  const code = file.replace(/\.ya?ml$/, '');
  const pins = data.pins;
  check(Array.isArray(pins) && pins.length > 0, file, 'pins must be a non-empty list');
  const bounds = STATE_BOUNDS[code];
  check(!!bounds, file, `no coordinate bounds defined for state "${code}" — add them to STATE_BOUNDS`);
  const counties = countyNamesFor(code);
  check(!!counties, file, `state file data/states/${code}.yaml is missing or unreadable`);
  const ids = new Set();
  for (const pin of pins || []) {
    const id = pin && pin.id ? String(pin.id) : '(missing id)';
    const where = `${file} pin "${id}"`;
    if (!pin || typeof pin !== 'object') { err(file, 'pin must be a mapping'); continue; }
    check(/^[a-z0-9-]+$/.test(pin.id || ''), file, `pin id "${pin.id}" must be lowercase letters, digits, hyphens`);
    check(!ids.has(pin.id), file, `duplicate pin id "${pin.id}"`);
    ids.add(pin.id);
    check(pin.state === code, file, `${where}: state "${pin.state}" must match file name "${code}"`);
    check(PIN_KINDS.includes(pin.kind), file, `${where}: bad kind "${pin.kind}"`);
    for (const f of ['name', 'address', 'county']) {
      check(typeof pin[f] === 'string' && pin[f].length > 0, file, `${where}: ${f} required`);
    }
    if (counties) {
      check(counties.has(pin.county), file, `${where}: unknown county "${pin.county}"`);
    }
    check(typeof pin.lat === 'number' && isFinite(pin.lat), file, `${where}: lat must be a number`);
    check(typeof pin.lng === 'number' && isFinite(pin.lng), file, `${where}: lng must be a number`);
    if (bounds && isFinite(pin.lat) && isFinite(pin.lng)) {
      check(pin.lat >= bounds.lat[0] && pin.lat <= bounds.lat[1] &&
        pin.lng >= bounds.lng[0] && pin.lng <= bounds.lng[1],
        file, `${where}: (${pin.lat}, ${pin.lng}) falls outside ${code} bounds — bad geocode?`);
    }
    check(typeof pin.url === 'string' && pin.url.startsWith('https://'),
      file, `${where}: url must be https`);
    check(hostIsOfficial(pin.url),
      file, `${where}: url host is not on the official allowlist ${OFFICIAL_HOSTS.join(', ')}`);
  }
}

const pinsDir = join(process.cwd(), 'data', 'pins');
let pinFiles;
try {
  pinFiles = readdirSync(pinsDir).filter(f => /\.ya?ml$/.test(f));
} catch {
  err('data/pins', 'directory missing');
  pinFiles = [];
}
if (pinFiles.length === 0) err('data/pins', 'no pin files found');
for (const f of pinFiles) validatePinsFile(join(pinsDir, f));

if (errors.length > 0) {
  console.error(`validate: ${errors.length} error(s)`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`validate: OK (${files.length} state file(s), ${pinFiles.length} pin file(s))`);
