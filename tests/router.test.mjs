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
    if (fx.expect.excludes) {
      for (const id of fx.expect.excludes) {
        assert.ok(!byId(result, id), `card ${id} must not route here`);
      }
    }
    if (fx.expect.justice) {
      const j = byId(result, 'justice-search');
      assert.ok(j, 'justice-search card present');
      assert.equal(j.cost_free, false, 'JUSTICE card must not say free');
      assert.match(j.cost, /\$17\.00/, 'JUSTICE cost mentions $17.00');
      assert.match(j.accepted_keys, /name/i, 'JUSTICE accepted keys mention name search');
      assert.ok(j.limitations.some((l) => /24-hour lag/i.test(l)), 'JUSTICE limitations mention the lag');
    }
    if (fx.expect.dmv) {
      const d = byId(result, 'dmv-record');
      assert.ok(d, 'dmv-record card present');
      assert.match(d.cost, /\$15\.00/, 'DMV cost is $15.00');
      assert.ok(
        d.limitations.some((l) => /convictions/i.test(l) && /not pending tickets/i.test(l)),
        'DMV card labeled convictions, not pending tickets'
      );
    }
    if (fx.expect.douglasLimitationMentionsExclusion) {
      const d = byId(result, 'douglas-county-card');
      assert.ok(d, 'douglas-county-card present');
      assert.ok(
        d.limitations.some((l) => /excluded from the state ePayments/i.test(l)),
        'Douglas card notes the ePayments exclusion'
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

test('no card claims VIN search', () => {
  const blob = JSON.stringify(data.cards);
  assert.ok(!/\bVIN\b/i.test(blob) || /does not|not/i.test(blob),
    'no card should present itself as a VIN search');
});
