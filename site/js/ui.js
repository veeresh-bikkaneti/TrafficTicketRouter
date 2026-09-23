// ui.js — check.html: one ask screen → one answer view. DOM only; routing
// stays in router.js. Every piece of output is built with createElement +
// textContent — never innerHTML with data. Nothing typed leaves the browser:
// the only network reads are the pre-built data/*.json files.
import { route } from './router.js';
import { enhanceSelect } from './combo.js';

const KIND_LABELS = {
  statewide_cms: 'Statewide court search',
  pay_portal: 'Official payment',
  county_court: 'County court',
  dmv: 'DMV driving record',
  self_help: 'Self-help',
  guidance: 'Guidance',
  driving_school: 'Defensive driving / traffic school',
  dmv_exam_prep: 'DMV exam prep',
};

// Cards start their stagger just after the heading lands and the ROUTED
// stamp thumps down (see .answer rules in app.css).
const CARD_DELAY_MS = 220;
const CARD_STAGGER_MS = 70;

const $ = (id) => document.getElementById(id);

// h(tag, attrs, ...children): tiny DOM builder. Strings become text nodes
// (via append), so data can never be parsed as markup.
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c);
  }
  return el;
}

// Only http(s) URLs become links (validate.mjs already requires https, or
// http with a documented TLS note); anything else renders no link at all.
function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function officialLink(url, cls, ...label) {
  const href = safeUrl(url);
  if (!href) return null;
  return h('a', { class: cls, href, target: '_blank', rel: 'noopener noreferrer' },
    ...label, h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'));
}

// ---------- result cards (the data contract: fee, lag, limitations, last verified) ----------

function fact(term, value) {
  return h('div', null, h('dt', null, term), h('dd', null, value == null ? '' : String(value)));
}

function buildCard(card, i) {
  const extras = (card.extra_links || [])
    .map((l) => {
      const a = officialLink(l.source_url, null, String(l.label));
      return a && h('div', null, a);
    })
    .filter(Boolean);
  const limits = card.limitations || [];
  const article = h('article', { class: 'card stub-card' },
    h('p', { class: 'card-kind' }, h('span', { class: 'pill' }, KIND_LABELS[card.kind] || String(card.kind))),
    h('h3', null, String(card.agency)),
    card.contact ? h('p', { class: 'card-contact' }, String(card.contact)) : null,
    h('dl', { class: 'card-facts' },
      fact('What the official form asks for', card.accepted_keys),
      fact('Fee', card.cost),
      card.lag ? fact('Lag', card.lag) : null),
    limits.length ? h('ul', { class: 'limitations' }, limits.map((l) => h('li', null, String(l)))) : null,
    h('p', { class: 'verified' }, `Last verified ${card.last_verified} · Source: official site`),
    card.source_url
      ? officialLink(card.source_url, 'btn btn-block', 'Open official site ',
        h('span', { class: 'ext', 'aria-hidden': 'true' }, '↗'))
      : null,
    extras.length ? h('div', { class: 'extra-links' }, extras) : null);
  article.style.setProperty('--d', `${CARD_DELAY_MS + i * CARD_STAGGER_MS}ms`);
  return article;
}

function warnNotice(...content) {
  return h('div', { class: 'notice notice-warn' },
    h('span', { class: 'warn-icon', 'aria-hidden': 'true' }),
    h('div', null, ...content));
}

// ---------- ask screen: state + county comboboxes, intent radios ----------

const ask = $('ask');
const answer = $('answer');
const results = $('results');
const stateSel = $('state');
const countySel = $('county');
// Typeahead comboboxes mirror the selects above: the selects stay the source
// of truth (value, options, 'change'), the inputs are the visible controls.
const stateCombo = enhanceSelect(stateSel);
const countyCombo = enhanceSelect(countySel);
const radios = Array.from(document.querySelectorAll('input[name="have"]'));
const DATA_BY_STATE = {};

async function loadStatesManifest() {
  const res = await fetch('data/states-manifest.json');
  if (!res.ok) throw new Error('states manifest failed to load');
  return res.json();
}

function setCounties(counties, placeholder = 'Choose a county…') {
  countySel.textContent = '';
  countySel.append(h('option', { value: '' }, placeholder));
  for (const c of counties || []) countySel.append(h('option', { value: c.name }, c.name));
  countySel.append(h('option', { value: 'other' }, 'Not sure / another county'));
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

const stateHint = $('state-hint');
const defaultStateHint = stateHint.textContent;
const setStateHint = (msg) => { stateHint.textContent = msg || defaultStateHint; };

async function initStateSelect() {
  try {
    const manifest = await loadStatesManifest();
    stateSel.textContent = '';
    stateSel.append(h('option', { value: '' }, 'Choose a state…'));
    for (const s of manifest) stateSel.append(h('option', { value: s.code }, s.name));
    setStateHint();
    return manifest;
  } catch {
    setStateHint('The state list could not load. Check your connection and reload — nothing was sent anywhere.');
    return null;
  }
}

// Picking a state loads its counties and clears any county picked for the
// previous state, so a stale county can never be submitted.
// Generation token: if the user picks another state while a fetch is in
// flight, the stale response is discarded instead of overwriting the
// current state's counties. Resolves true only when this call's counties
// are the ones now on screen.
let stateGen = 0;
async function loadCountiesForState() {
  const code = stateSel.value;
  const gen = ++stateGen;
  if (!code) {
    setCounties(null, 'Choose a state first…');
    return false;
  }
  setCounties(null, 'Loading counties…');
  try {
    const data = await loadStateData(code);
    if (gen !== stateGen) return false; // superseded by a newer selection
    setCounties(data.counties);
    setStateHint();
    return true;
  } catch {
    if (gen !== stateGen) return false; // superseded by a newer selection
    setStateHint('That state’s data could not load. Check your connection and try again — nothing was sent anywhere.');
    return false;
  }
}

// ---------- inline validation ----------
// Errors appear only after a submit attempt, and each one clears the moment
// its own field becomes valid. The error text is tied to its control(s) via
// aria-describedby + aria-invalid while shown; an icon + a visually hidden
// "Error:" prefix mean it never relies on color alone.

const ERROR_TARGETS = {
  state: () => [stateCombo.input],
  county: () => [countyCombo.input],
  intent: () => radios,
};

function setError(name, on) {
  const err = $(`${name}-error`);
  if (err.hidden === !on) return;
  err.hidden = !on;
  for (const el of ERROR_TARGETS[name]()) {
    if (el.dataset.baseDescribedby === undefined) {
      el.dataset.baseDescribedby = el.getAttribute('aria-describedby') || '';
    }
    const ids = [on ? err.id : '', el.dataset.baseDescribedby].filter(Boolean).join(' ');
    if (ids) el.setAttribute('aria-describedby', ids);
    else el.removeAttribute('aria-describedby');
    if (on) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  }
  if (name === 'intent') $('intent-group').classList.toggle('is-invalid', on);
}

const checkedRadio = () => radios.find((r) => r.checked) || null;

stateSel.addEventListener('change', () => {
  if (stateSel.value) setError('state', false);
  loadCountiesForState();
});
countySel.addEventListener('change', () => {
  if (countySel.value) setError('county', false);
});
for (const r of radios) {
  r.addEventListener('change', () => {
    setError('intent', false);
    // The VIN explainer needs no location, so location errors no longer apply.
    if (r.value === 'vin_only') {
      setError('state', false);
      setError('county', false);
    }
  });
}

// ---------- answer view ----------

function chip(term, value) {
  return h('div', { class: 'pill pill-answer' }, h('dt', null, term), h('dd', null, value));
}

function optionText(select) {
  const o = select.selectedOptions && select.selectedOptions[0];
  return o ? o.textContent : '';
}

function stampIn(on) {
  const stamp = $('answer-stamp');
  stamp.hidden = !on;
  stamp.classList.remove('stamp-in');
  if (!on) return;
  void stamp.offsetWidth; // reflow, so the thump replays on every new answer
  stamp.classList.add('stamp-in');
}

function showAnswer(heading, routed, body, q) {
  $('answer-h').textContent = heading;
  $('answer-chips').replaceChildren(
    chip('State', q.stateName),
    chip('County', q.countyLabel),
    chip('You have', q.intentLabel));
  ask.hidden = true;
  answer.hidden = false;
  stampIn(routed);
  results.replaceChildren(...body);
  answer.scrollIntoView({ block: 'start' });
  $('answer-h').focus({ preventScroll: true });
  if (!(history.state && history.state.tr === 'answer')) {
    // A same-page history entry, so the phone's Back button returns to the
    // ask screen instead of leaving the page. Carries no data, changes no URL.
    history.pushState({ tr: 'answer' }, '');
  }
}

function showAsk() {
  answer.hidden = true;
  ask.hidden = false;
  ask.scrollIntoView({ block: 'start' });
  $('where-h').focus({ preventScroll: true });
}

function routedBody(result, q) {
  return [
    q.county === 'other'
      ? warnNotice(h('p', null, h('strong', null, 'County not covered yet.'),
        ' Start with the statewide pages below, or call the county court where you were stopped. ' +
        'Traffic cases live in the county court of the county where the stop happened.'))
      : null,
    h('div', { class: 'card-grid' }, result.cards.map((c, i) => buildCard(c, i))),
    h('div', { class: 'notice' }, h('p', null,
      'We did not search any database. You will type your information on the official site.')),
  ].filter(Boolean);
}

// No verified card for this county + intent: say so plainly, then give the
// next best official door for what they asked.
function gapBody(q, data, statewide) {
  const here = q.county === 'other' ? 'the county where you were stopped' : q.countyLabel;
  const countyInfo = data && Array.isArray(data.counties)
    ? data.counties.find((c) => c.name === q.county)
    : null;
  const steps = [];
  if (q.intent === 'history') {
    steps.push('Driving records come from your state’s DMV (motor vehicle agency), not the county court. ' +
      'Use the state’s official .gov site, not a third-party records site.');
  } else {
    steps.push(`Call or visit the court for ${here}. Traffic cases live in the county court of the county ` +
      'where the stop happened, and the clerk can look up a citation for you.');
    // Broadly true regardless of state or verified data: most courts offer
    // some form of driver-safety-course option for eligible citations, and
    // only the clerk can say whether yours qualifies. See driving_school
    // cards for verified per-state programs where we have one.
    steps.push('Many courts let you take a defensive-driving or driver-safety course to have an eligible ' +
      'citation dismissed instead of paying it — ask the clerk whether that applies to yours.');
  }
  if (countyInfo && countyInfo.note && q.intent !== 'history') {
    steps.push(`Local note: ${countyInfo.note}`);
  }
  if (statewide) steps.push(`We do have statewide ${q.stateName} pages — try those next.`);

  const actions = h('div', { class: 'btn-row' });
  if (statewide) {
    const btn = h('button', { class: 'btn', type: 'button' }, 'Show statewide pages ',
      h('span', { class: 'ext arr-right', 'aria-hidden': 'true' }, '→'));
    btn.addEventListener('click', () => {
      countySel.value = 'other';
      countyCombo.sync();
      runCheck();
    });
    actions.append(btn);
  }
  // The general how-to-handle-it guide only covers Nebraska so far (see
  // learn.html) — showing it for every other state would point people at
  // guidance that isn't theirs, so it only appears when it actually applies.
  if (q.state === 'NE') {
    actions.append(h('a', { class: 'btn btn-secondary', href: 'learn.html' },
      'General how-to-handle-it info (Nebraska guide)'));
  }

  return [
    warnNotice(
      h('p', null, h('strong', null, 'We haven’t verified an official page for this yet.'),
        ' We only link pages we have checked by hand, so we won’t guess at one.'),
      h('p', { class: 'gap-h' }, 'What to do now'),
      h('ul', { class: 'gap-steps' }, steps.map((s) => h('li', null, s)))),
    actions,
  ];
}

// ---------- submit: validate → route → answer ----------

let submitGen = 0;
async function runCheck() {
  const radio = checkedRadio();
  const intent = radio ? radio.value : null;
  const needsPlace = intent !== 'vin_only';
  const stateOk = !needsPlace || Boolean(stateSel.value);
  const countyOk = !needsPlace || Boolean(countySel.value);
  setError('state', !stateOk);
  setError('county', !countyOk);
  setError('intent', !intent);
  const firstBad = !stateOk ? stateCombo.input : !countyOk ? countyCombo.input : !intent ? radios[0] : null;
  if (firstBad) {
    firstBad.focus();
    return;
  }

  const q = {
    intent,
    state: stateSel.value,
    county: countySel.value,
    stateName: optionText(stateSel),
    countyLabel: optionText(countySel),
    intentLabel: radio.dataset.chip || radio.value,
  };
  const gen = ++submitGen;
  let data = null;
  if (needsPlace) {
    try {
      data = await loadStateData(q.state);
    } catch {
      if (gen !== submitGen) return;
      showAnswer('We couldn’t load the pages just now', false, [
        warnNotice(h('p', null, 'The check could not load its data just now. Check your connection and try again — ' +
          'nothing was sent anywhere.')),
      ], q);
      return;
    }
    if (gen !== submitGen) return;
  }

  const result = route(data, { intent: q.intent, state: q.state, county: q.county });
  if (result.type === 'explainer') {
    window.location.href = result.page; // vin_only → vin.html, as before
    return;
  }
  if (result.type === 'cannot-route') {
    if (result.reason === 'unknown-state') {
      showAnswer(`We can’t route ${q.stateName} yet`, false, [
        warnNotice(h('p', null, 'We don’t have verified pages for that state yet. Change your answers to pick another state.')),
      ], q);
      return;
    }
    const statewide = q.county !== 'other' &&
      route(data, { intent: q.intent, state: q.state, county: 'other' }).type === 'cards';
    const where = q.county === 'other' ? q.stateName : `${q.countyLabel}, ${q.state}`;
    showAnswer(`No verified page yet for ${where}`, false, gapBody(q, data, statewide), q);
    return;
  }
  const heading = q.county === 'other'
    ? `Your official pages for ${q.stateName} (statewide)`
    : `Your official pages for ${q.countyLabel}, ${q.state}`;
  showAnswer(heading, true, routedBody(result, q), q);
}

ask.addEventListener('submit', (e) => {
  e.preventDefault();
  runCheck();
});

// "Change your answers": back to the ask screen with every selection intact —
// the form was only hidden, never reset.
for (const btn of document.querySelectorAll('[data-change]')) {
  btn.addEventListener('click', () => {
    if (history.state && history.state.tr === 'answer') history.back(); // popstate shows the ask screen
    else showAsk();
  });
}
window.addEventListener('popstate', (e) => {
  const wantAnswer = Boolean(e.state && e.state.tr === 'answer');
  if (!wantAnswer && !answer.hidden) showAsk();
  else if (wantAnswer && answer.hidden) runCheck();
});
// A reload lands on the ask screen; drop a stale "answer" entry marker so
// Back doesn't need two presses.
if (history.state && history.state.tr === 'answer') history.replaceState(null, '');

// ---------- ?state= preselect (e.g. from the homepage quick start) ----------
// Whitelisted against the manifest: only a real state code is accepted, and
// the value used is the manifest's own code, never the raw parameter.
function stateFromQuery(manifest) {
  if (!manifest) return null;
  let raw;
  try {
    raw = new URLSearchParams(window.location.search).get('state');
  } catch {
    return null;
  }
  if (!raw || raw.length > 2) return null;
  const code = raw.toUpperCase();
  const hit = manifest.find((s) => s.code === code);
  return hit ? hit.code : null;
}

async function init() {
  const manifest = await initStateSelect();
  const code = stateFromQuery(manifest);
  if (!code) return;
  stateSel.value = code;
  stateCombo.sync();
  const ready = await loadCountiesForState();
  // Land the user on the county picker, unless they've already moved on.
  const idle = !document.activeElement || document.activeElement === document.body;
  if (ready && idle && !ask.hidden) countyCombo.input.focus();
}

init();
