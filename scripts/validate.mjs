// validate.mjs — schema + policy checks for data/states/*.yaml and data/pins/*.yaml
// Uses the vendored YAML-subset parser. Exits non-zero on any failure.
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseYAML } from './yaml.mjs';
import { STATE_BOUNDS } from './state-bounds.mjs';

// Cards must never be tagged vin_only: no court URL may present itself as a
// VIN lookup, so the router's intent set (which includes vin_only) is wider
// than this list on purpose. See router.js for the router side.
const INTENTS = ['lost_paper', 'history', 'handle_it'];
const VERIFICATIONS = ['unverified', 'link_ok', 'keys_documented', 'handoff_tested', 'disabled'];
const KINDS = ['statewide_cms', 'pay_portal', 'county_court', 'dmv', 'self_help', 'guidance',
  'driving_school', 'dmv_exam_prep'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const JUSTICE_COST_NOTES = 'confirm fee on the terms page; $17 as of 2026-09-20';

// M1: defense-in-depth — every URL a contributor adds must live on an official
// host declared by that state file's `official_hosts` list. Human review stays
// the real gate (reviewers verify each declared host is genuinely official);
// this is the automated one. Hosts are per-state so the allowlist scales to 50
// states without a central registry edit for every new URL.
function hostIsOfficial(url, hosts) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (hosts || []).some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

function isRealDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Policy: https is required everywhere. The single exception is an official
// site whose TLS is broken (human-verified): the working http URL may be used,
// but only when the record's verification_note actually asserts the breakage
// (certificate error / broken TLS) — a note that merely mentions "https" is
// not enough.
const TLS_BROKEN_RE = /certificate[^.]{0,80}(broken|error|invalid|expired|misconfigured|mismatch)|tls[^.]{0,80}(broken|error|disabled)/i;
function httpWithTlsNote(url, note) {
  return typeof url === 'string' && url.startsWith('http://') &&
    typeof note === 'string' && TLS_BROKEN_RE.test(note);
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
  const officialHosts = data.official_hosts;
  check(Array.isArray(officialHosts) && officialHosts.length > 0 &&
    officialHosts.every((h) => typeof h === 'string' && h.length > 0),
    file, 'official_hosts must be a non-empty list of host strings');
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
      check(typeof card.source_url === 'string' &&
        (card.source_url.startsWith('https://') || httpWithTlsNote(card.source_url, card.verification_note)),
        file, `${where}: source_url must be https (http allowed only when verification_note documents the site's broken TLS)`);
      check(hostIsOfficial(card.source_url, officialHosts),
        file, `${where}: source_url host is not on this state's official_hosts allowlist`);
    }
    if (card.link_check != null) {
      check(['auto', 'manual'].includes(card.link_check), file, `${where}: bad link_check`);
    }
    if (card.link_check === 'manual') {
      check(typeof card.verification_note === 'string' && card.verification_note.length > 0,
        file, `${where}: link_check=manual requires a verification_note explaining the human verification`);
    }
    for (const l of card.extra_links || []) {
      check(l && typeof l.label === 'string' && typeof l.source_url === 'string' &&
        (l.source_url.startsWith('https://') || httpWithTlsNote(l.source_url, card.verification_note)),
        file, `${where}: bad extra_link (http allowed only when verification_note documents the site's broken TLS)`);
      check(hostIsOfficial(l.source_url, officialHosts),
        file, `${where}: extra_link host is not on this state's official_hosts allowlist`);
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
// Same defense-in-depth as cards: every pin URL must live on an official host
// declared by that state's own file, and coordinates must fall inside the
// state's bounding box (scripts/state-bounds.mjs) so a bad geocode can never
// drop a pin in the wrong state.
const PIN_KINDS = ['courthouse'];

function stateDataFor(stateCode) {
  try {
    const data = parseYAML(readFileSync(join(process.cwd(), 'data', 'states', `${stateCode}.yaml`), 'utf8'));
    return {
      counties: new Set((data.counties || []).map((c) => c && c.name)),
      officialHosts: Array.isArray(data.official_hosts) ? data.official_hosts : [],
    };
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
  check(!!bounds, file, `no coordinate bounds defined for state "${code}" — add them to scripts/state-bounds.mjs`);
  const stateData = stateDataFor(code);
  check(!!stateData, file, `state file data/states/${code}.yaml is missing or unreadable`);
  const counties = stateData && stateData.counties;
  const pinHosts = stateData && stateData.officialHosts;
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
    check(typeof pin.url === 'string' &&
      (pin.url.startsWith('https://') || httpWithTlsNote(pin.url, pin.verification_note)),
      file, `${where}: url must be https (http allowed only when verification_note documents the site's broken TLS)`);
    if (pin.link_check != null) {
      check(['auto', 'manual'].includes(pin.link_check), file, `${where}: bad link_check`);
    }
    if (pin.link_check === 'manual') {
      check(typeof pin.verification_note === 'string' && pin.verification_note.length > 0,
        file, `${where}: link_check=manual requires a verification_note explaining the human verification`);
    }
    if (typeof pin.url === 'string' && pin.url.startsWith('http://')) {
      check(typeof pin.verification_note === 'string' && pin.verification_note.length > 0,
        file, `${where}: http url requires a verification_note documenting the broken TLS`);
    }
    check(hostIsOfficial(pin.url, pinHosts),
      file, `${where}: url host is not on this state's official_hosts allowlist`);
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
