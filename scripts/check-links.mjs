// check-links.mjs — reachability check for every official URL in the built data.
// Reads site/data/*.json (run build-data.mjs and build-pins.mjs first).
// Covers state cards AND map pins. Follows redirects.
// Rows with link_check=manual are reported as skipped (bot-blocked, human-verified).
// Politeness: at most one request per host every HOST_DELAY_MS, so bulk runs
// don't trip bot defenses (observed 2026-09-21: arcourts.gov tarpits rapid
// sequential hits from one IP, hanging connections until timeout).
// Exits non-zero if any auto-checked URL is unreachable.
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const TIMEOUT_MS = 15000;
const HOST_DELAY_MS = 2000;
const UA = 'TicketRouter-linkcheck/1.0 (+https://github.com/veeresh-bikkaneti/TrafficTicketRouter)';

const lastHit = new Map();
async function politeWait(url) {
  const host = new URL(url).hostname.toLowerCase();
  const wait = HOST_DELAY_MS - (Date.now() - (lastHit.get(host) || 0));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
}

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
let files = readdirSync(dir).filter((f) => f.endsWith('.json'));
// Resume support: CHECK_FILES=me.json,mi.json (comma-separated) limits the run
// to those files, e.g. after an interrupted sweep.
if (process.env.CHECK_FILES) {
  const want = new Set(process.env.CHECK_FILES.split(',').map((s) => s.trim()).filter(Boolean));
  files = files.filter((f) => want.has(f));
}
// Resume support: CHECK_RESUME=1 skips file|url pairs already logged as OK or
// SKIP in the log file (CHECK_LOG, default postfix-sweep.log). Pairs logged as
// FAIL are re-checked.
const resumeSkip = new Set();
if (process.env.CHECK_RESUME) {
  const logPath = process.env.CHECK_LOG || new URL('../../sweep-shards/postfix-sweep.log', import.meta.url).pathname;
  let logText = '';
  try { logText = readFileSync(logPath, 'utf8'); } catch { /* no log yet */ }
  for (const line of logText.split('\n')) {
    const m = line.match(/^(OK|FAIL|SKIP)\b[^\]]*\] (\S+\.json) \S+ (.*)$/);
    if (!m) continue;
    const rest = m[3].split(' -> ')[0]; // drop redirect target
    const ci = rest.lastIndexOf(': ');
    if (ci < 0) continue;
    const key = `${m[2]}|${rest.slice(ci + 2)}`;
    if (m[1] === 'FAIL') resumeSkip.delete(key); // failures are always re-checked
    else resumeSkip.add(key);
  }
}
const resumed = (f, url) => resumeSkip.has(`${basename(f)}|${url}`);
const failures = [];
let checked = 0, skipped = 0;

// Collect source_urls of link_check=manual cards: a pin pointing at the exact
// same URL is covered by the card's human verification, so it is skipped too.
const manualUrls = new Set();
for (const f of files) {
  const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const card of data.cards || []) {
    if (card.link_check === 'manual') {
      if (card.source_url) manualUrls.add(card.source_url);
      for (const l of card.extra_links || []) manualUrls.add(l.source_url);
    }
  }
}

for (const f of files) {
  const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const card of data.cards || []) {
    const urls = [];
    if (card.source_url) urls.push([card.id, 'source_url', card.source_url]);
    for (const l of card.extra_links || []) urls.push([card.id, `extra:${l.label}`, l.source_url]);
    for (const [id, role, url] of urls) {
      if (card.link_check === 'manual') {
        console.log(`SKIP [manual] ${basename(f)} ${id} ${role}: ${url}`);
        skipped++;
        continue;
      }
      if (process.env.CHECK_RESUME && resumed(f, url)) continue;
      await politeWait(url);
      const r = await check(url);
      checked++;
      const tag = r.ok ? 'OK  ' : 'FAIL';
      console.log(`${tag} [${r.status}] ${basename(f)} ${id} ${role}: ${url}${r.final !== url ? ` -> ${r.final}` : ''}`);
      if (!r.ok) failures.push(`${basename(f)} ${id} ${role}: ${url} [${r.status}]`);
    }
  }
  for (const pin of data.pins || []) {
    if (!pin.url) continue;
    if (pin.link_check === 'manual') {
      console.log(`SKIP [manual] ${basename(f)} ${pin.id} pin: ${pin.url}`);
      skipped++;
      continue;
    }
    if (manualUrls.has(pin.url)) {
      console.log(`SKIP [manual] ${basename(f)} ${pin.id} pin: ${pin.url}`);
      skipped++;
      continue;
    }
    if (process.env.CHECK_RESUME && resumed(f, pin.url)) continue;
    await politeWait(pin.url);
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
