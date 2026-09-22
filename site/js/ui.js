// ui.js — wizard wiring for check.html. DOM only; routing stays in router.js.
import { route } from './router.js';

const KIND_LABELS = {
  statewide_cms: 'Statewide court search',
  pay_portal: 'Official payment',
  county_court: 'County court',
  dmv: 'DMV driving record',
  self_help: 'Self-help',
  guidance: 'Guidance',
};

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const RAIL_STEPS = ['step-1', 'step-2', 'step-3'];

function updateRail(id) {
  const rail = document.querySelector('.progress-rail');
  if (!rail) return;
  const idx = RAIL_STEPS.indexOf(id);
  rail.querySelectorAll('li').forEach((li, i) => {
    li.classList.toggle('done', idx !== -1 && i < idx);
    li.classList.toggle('current', i === idx);
  });
}

function show(id) {
  for (const s of ['step-1', 'step-2', 'step-3', 'step-empty']) {
    $(s).hidden = s !== id;
  }
  updateRail(id);
  $(id).scrollIntoView({ block: 'start' });
}

function cardHTML(card, i) {
  const kind = KIND_LABELS[card.kind] || card.kind;
  const extras = (card.extra_links || [])
    .map((l) => `<div><a href="${esc(l.source_url)}" target="_blank" rel="noopener">${esc(l.label)}</a></div>`)
    .join('');
  return `<article class="card" style="--d:${(i || 0) * 70}ms">
    <p class="card-kind"><span class="pill">${esc(kind)}</span></p>
    <h3>${esc(card.agency)}</h3>
    ${card.contact ? `<p class="card-contact">${esc(card.contact)}</p>` : ''}
    <dl class="card-facts">
      <div><dt>What the official form asks for</dt><dd>${esc(card.accepted_keys)}</dd></div>
      <div><dt>Fee</dt><dd>${esc(card.cost)}</dd></div>
      ${card.lag ? `<div><dt>Lag</dt><dd>${esc(card.lag)}</dd></div>` : ''}
    </dl>
    <ul class="limitations">
      ${(card.limitations || []).map((l) => `<li>${esc(l)}</li>`).join('')}
    </ul>
    <p class="verified">Last verified ${esc(card.last_verified)} · Source: official site</p>
    ${card.source_url
      ? `<a class="btn btn-block" href="${esc(card.source_url)}" target="_blank" rel="noopener">Open official site <span class="ext" aria-hidden="true">↗</span></a>`
      : ''}
    ${extras ? `<div class="extra-links">${extras}</div>` : ''}
  </article>`;
}

function renderResults(result, countyLabel) {
  const box = $('results');
  if (result.type === 'explainer') {
    window.location.href = result.page;
    return;
  }
  if (result.type === 'cannot-route') {
    const msg = result.reason === 'unknown-state'
      ? 'We don\u2019t have verified pages for that state yet. Pick a state above.'
      : 'We have no verified official pages for that combination yet. Try the general info page, or start over.';
    $('empty-notice').textContent = msg;
    show('step-empty');
    return;
  }
  const other = countyLabel === 'other'
    ? `<div class="notice"><strong>County not covered yet.</strong>
       Start with the statewide pages below, or call the county court where you were stopped.
       Traffic cases live in the county court of the county where the stop happened.</div>`
    : '';
  box.innerHTML = other +
    `<div class="card-grid">${result.cards.map((c, i) => cardHTML(c, i)).join('')}</div>
     <div class="notice">We did not search any database.
     You will type your information on the official site.</div>`;
  show('step-3');
}

const stateSel = $('state');
const countySel = $('county');
const DATA_BY_STATE = {};

async function loadStatesManifest() {
  const res = await fetch('data/states-manifest.json');
  if (!res.ok) throw new Error('states manifest failed to load');
  return res.json();
}

function setCounties(counties) {
  countySel.textContent = '';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = 'Choose a county\u2026';
  countySel.appendChild(ph);
  for (const c of counties || []) {
    const o = document.createElement('option');
    o.value = c.name;
    o.textContent = c.name;
    countySel.appendChild(o);
  }
  const other = document.createElement('option');
  other.value = 'other';
  other.textContent = 'Not sure / another county';
  countySel.appendChild(other);
}

async function loadStateData(code) {
  const key = String(code).toLowerCase();
  if (!DATA_BY_STATE[key]) {
    const res = await fetch(`data/${key}.json`);
    if (!res.ok) throw new Error('state data failed to load');
    DATA_BY_STATE[key] = await res.json();
  }
  return DATA_BY_STATE[key];
}

const defaultStateHint = $('state-hint').textContent;
function stateLoadError(msg) {
  $('state-hint').textContent = msg;
}
function clearStateError() {
  $('state-hint').textContent = defaultStateHint;
}

async function initStateSelect() {
  try {
    const manifest = await loadStatesManifest();
    stateSel.textContent = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Choose a state\u2026';
    stateSel.appendChild(ph);
    for (const s of manifest) {
      const o = document.createElement('option');
      o.value = s.code;
      o.textContent = s.name;
      stateSel.appendChild(o);
    }
    clearStateError();
  } catch {
    stateLoadError('The state list could not load. Check your connection and reload \u2014 nothing was sent anywhere.');
  }
}

// Picking a state loads its counties; the wizard resets to step 1 so a stale
// county from another state can never be submitted.
// Generation token: if the user picks another state while a fetch is in
// flight, the stale response is discarded instead of overwriting the
// current state's counties.
let stateGen = 0;
stateSel.addEventListener('change', async () => {
  const code = stateSel.value;
  const gen = ++stateGen;
  setCounties([]);
  if (!code) {
    show('step-1');
    return;
  }
  try {
    const data = await loadStateData(code);
    if (gen !== stateGen) return; // superseded by a newer selection
    setCounties(data.counties);
    clearStateError();
  } catch {
    if (gen !== stateGen) return; // superseded by a newer selection
    stateLoadError('That state\u2019s data could not load. Check your connection and try again \u2014 nothing was sent anywhere.');
  }
  show('step-1');
});

function selectedIntent() {
  const el = document.querySelector('input[name="have"]:checked');
  return el ? el.value : null;
}

$('to-step-2').addEventListener('click', () => {
  if (!$('county').value) {
    $('county').focus();
    return;
  }
  show('step-2');
});

$('to-step-3').addEventListener('click', async () => {
  const intent = selectedIntent();
  if (!intent) {
    document.querySelector('input[name="have"]').focus();
    return;
  }
  const stateCode = stateSel.value;
  if (!stateCode) {
    show('step-1');
    stateSel.focus();
    return;
  }
  let data;
  try {
    data = await loadStateData(stateCode);
  } catch {
    $('empty-notice').textContent =
      'The check could not load its data just now. Check your connection and try again — ' +
      'nothing was sent anywhere.';
    show('step-empty');
    return;
  }
  const result = route(data, {
    intent,
    state: stateCode,
    county: countySel.value,
  });
  renderResults(result, countySel.value);
});

$('back-to-1').addEventListener('click', (e) => { e.preventDefault(); show('step-1'); });
$('back-to-2').addEventListener('click', (e) => { e.preventDefault(); show('step-2'); });
$('back-to-1b').addEventListener('click', (e) => { e.preventDefault(); show('step-1'); });

initStateSelect();
