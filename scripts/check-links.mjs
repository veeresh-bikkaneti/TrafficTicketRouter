// check-links.mjs — reachability check for every official URL in the built data.
// Reads site/data/*.json (run build-data.mjs and build-pins.mjs first).
// Covers state cards AND map pins. Follows redirects.
// Rows with link_check=manual are reported as skipped (bot-blocked, human-verified).
// Exits non-zero if any auto-checked URL is unreachable.
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const TIMEOUT_MS = 15000;
const UA = 'TicketRouter-linkcheck/1.0 (+https://github.com/veeresh-bikkaneti/TrafficTicketRouter)';

async function check(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA },
    });
    if (res.status === 405 || res.status === 403 || res.status >= 500) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'user-agent': UA },
      });
    }
    if (res.status === 429) {
      // The host asked us to slow down. Do not fall back to GET (that doubles
      // the load); report it and let the operator decide.
      return { ok: false, status: 429, final: res.url, error: 'rate-limited' };
    }
    // Drain small bodies so sockets close cleanly.
    if (res.body) { try { await res.arrayBuffer(); } catch { /* ignore */ } }
    return { ok: res.status >= 200 && res.status < 400, status: res.status, final: res.url };
  } catch (e) {
    return { ok: false, status: 'ERR', final: url, error: e.name };
  } finally {
    clearTimeout(t);
  }
}

const dir = join(process.cwd(), 'site', 'data');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const failures = [];
let checked = 0, skipped = 0;

for (const f of files) {
  const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const card of data.cards || []) {
    const urls = [];
    if (card.source_url) urls.push([card.id, 'source_url', card.source_url]);
    for (const l of card.extra_links || []) urls.push([card.id, `extra:${l.label}`, l.source_url]);
    for (const [id, role, url] of urls) {
      if (card.link_check === 'manual') {
        console.log(`SKIP (manual) ${basename(f)} ${id} ${role}: ${url}`);
        skipped++;
        continue;
      }
      const r = await check(url);
      checked++;
      const tag = r.ok ? 'OK  ' : 'FAIL';
      console.log(`${tag} [${r.status}] ${basename(f)} ${id} ${role}: ${url}${r.final !== url ? ` -> ${r.final}` : ''}`);
      if (!r.ok) failures.push(`${basename(f)} ${id} ${role}: ${url} [${r.status}]`);
    }
  }
  for (const pin of data.pins || []) {
    if (!pin.url) continue;
    const r = await check(pin.url);
    checked++;
    const tag = r.ok ? 'OK  ' : 'FAIL';
    console.log(`${tag} [${r.status}] ${basename(f)} ${pin.id} pin: ${pin.url}${r.final !== pin.url ? ` -> ${r.final}` : ''}`);
    if (!r.ok) failures.push(`${basename(f)} ${pin.id} pin: ${pin.url} [${r.status}]`);
  }
}

console.log(`\ncheck-links: ${checked} checked, ${skipped} manual-skipped, ${failures.length} failed`);
if (failures.length > 0) {
  for (const x of failures) console.error('  - ' + x);
  process.exit(1);
}
