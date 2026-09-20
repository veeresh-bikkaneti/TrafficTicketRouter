// validate.mjs — schema + policy checks for data/states/*.yaml
// Uses the vendored YAML-subset parser. Exits non-zero on any failure.
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseYAML } from './yaml.mjs';

const INTENTS = ['lost_paper', 'history', 'handle_it'];
const VERIFICATIONS = ['unverified', 'link_ok', 'keys_documented', 'handoff_tested', 'disabled'];
const KINDS = ['statewide_cms', 'pay_portal', 'county_court', 'dmv', 'self_help', 'guidance'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const JUSTICE_COST_NOTES = 'confirm fee on the terms page; $17 as of 2026-09-20';

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
  check(DATE_RE.test(data.last_verified || ''), file, 'last_verified must be YYYY-MM-DD');

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
    check(DATE_RE.test(card.last_verified || ''), file, `${where}: last_verified must be YYYY-MM-DD`);
    check(Number.isInteger(card.weight), file, `${where}: weight must be an integer`);
    check(Array.isArray(card.for_intents) && card.for_intents.length > 0 &&
      card.for_intents.every(i => INTENTS.includes(i)), file, `${where}: bad for_intents`);
    check(Array.isArray(card.for_counties) && card.for_counties.length > 0, file, `${where}: for_counties required`);
    for (const co of card.for_counties || []) {
      check(co === '*' || countyNames.has(co), file, `${where}: unknown county "${co}"`);
    }
    for (const co of card.exclude_counties || []) {
      check(countyNames.has(co), file, `${where}: unknown exclude_county "${co}"`);
    }
    if (card.source_url == null) {
      check(card.kind === 'guidance', file, `${where}: source_url may be null only for kind=guidance`);
    } else {
      check(typeof card.source_url === 'string' && card.source_url.startsWith('https://'),
        file, `${where}: source_url must be https`);
    }
    if (card.link_check != null) {
      check(['auto', 'manual'].includes(card.link_check), file, `${where}: bad link_check`);
    }
    for (const l of card.extra_links || []) {
      check(l && typeof l.label === 'string' && typeof l.source_url === 'string' &&
        l.source_url.startsWith('https://'), file, `${where}: bad extra_link`);
    }
    // Policy: JUSTICE-style paid cards must never claim to be free.
    if (card.cost_free === false) {
      check(!/\bfree\b/i.test(card.cost), file, `${where}: cost_free=false but cost text says "free"`);
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

if (errors.length > 0) {
  console.error(`validate: ${errors.length} error(s)`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`validate: OK (${files.length} state file(s))`);
