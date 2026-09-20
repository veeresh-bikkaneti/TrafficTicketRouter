// router.test.mjs — runs the fixture suite against the BUILT data file.
// Run order: validate.mjs -> build-data.mjs -> this.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { route } from '../site/js/router.js';

const root = join(import.meta.dirname, '..');
const data = JSON.parse(readFileSync(join(root, 'site', 'data', 'ne.json'), 'utf8'));
const fixtures = JSON.parse(readFileSync(join(root, 'tests', 'fixtures', 'routes.json'), 'utf8'));

const byId = (result, id) => result.cards.find((c) => c.id === id);

for (const fx of fixtures) {
  test(fx.name, () => {
    const result = route(data, fx.input);
    assert.equal(result.type, fx.expect.type, `expected type ${fx.expect.type}, got ${result.type}`);

    if (fx.expect.cardIds) {
      const ids = result.cards.map((c) => c.id);
      assert.deepEqual(ids, fx.expect.cardIds, `card order/ids mismatch: ${ids.join(',')}`);
    }
    if (fx.expect.justice) {
      const j = byId(result, 'justice-search');
      assert.ok(j, 'justice-search card present');
      assert.equal(j.cost_free, false, 'JUSTICE card must not say free');
      assert.match(j.cost, /\$17\.00/, 'JUSTICE cost mentions $17.00');
      assert.equal(j.cost_notes, 'confirm fee on the terms page; $17 as of 2026-09-20',
        'JUSTICE cost_notes carries the confirm-fee language');
      assert.match(j.accepted_keys, /party name/i, 'JUSTICE accepted keys mention party-name search');
      assert.ok(!/\bVIN\b/i.test(j.accepted_keys) || /not[^.]*\bVIN\b/i.test(j.accepted_keys),
        'JUSTICE must not claim VIN search (a "not searchable by VIN" negation is fine)');
      assert.ok(j.limitations.some((l) => /24-hour lag/i.test(l)), 'JUSTICE limitations mention the lag');
    }
    if (fx.expect.dmv) {
      const d = byId(result, 'dmv-record');
      assert.ok(d, 'dmv-record card present');
      assert.match(d.cost, /\$15\.00/, 'DMV cost is $15.00');
      assert.ok(d.source_url.includes('dmv.nebraska.gov'), 'DMV card uses the DMV source URL');
      assert.ok(
        d.limitations.some((l) => /convictions/i.test(l) && /NOT a pending-ticket portal/i.test(l)),
        'DMV card labeled convictions history, not a pending-ticket portal'
      );
    }
    if (fx.expect.zeroUrls) {
      assert.equal(fx.expect.page, result.page);
      assert.deepEqual(result.cards, []);
      const blob = JSON.stringify(result);
      assert.ok(!/https?:\/\//.test(blob), 'explainer result claims zero URLs');
    }
  });
}

test('no emitted card claims VIN lookup', () => {
  for (const card of data.cards) {
    const blob = `${card.accepted_keys} ${card.limitations.join(' ')}`;
    assert.ok(!/\bVIN\b/i.test(blob) || /not/i.test(blob),
      `card ${card.id} must not present itself as a VIN lookup`);
  }
});

test('router never emits unverified or disabled rows', () => {
  for (const intent of ['lost_paper', 'history', 'handle_it']) {
    for (const county of ['Lancaster', 'Douglas', 'Sarpy', 'other']) {
      const r = route(data, { intent, state: 'NE', county });
      for (const c of r.cards) {
        assert.ok(['link_ok', 'keys_documented', 'handoff_tested'].includes(c.verification),
          `card ${c.id} verification ${c.verification} must not route`);
      }
    }
  }
});
