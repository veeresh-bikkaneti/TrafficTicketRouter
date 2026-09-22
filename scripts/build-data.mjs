// build-data.mjs — compiles data/states/*.yaml -> site/data/<state>.json
// Run validate.mjs first; this script assumes valid input.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseYAML } from './yaml.mjs';

const root = process.cwd();
const inDir = join(root, 'data', 'states');
const outDir = join(root, 'site', 'data');
mkdirSync(outDir, { recursive: true });

const files = readdirSync(inDir).filter(f => /\.ya?ml$/.test(f));
if (files.length === 0) {
  console.error('build-data: no state files found');
  process.exit(1);
}
const manifest = [];
for (const f of files) {
  let data;
  try {
    data = parseYAML(readFileSync(join(inDir, f), 'utf8'));
  } catch (e) {
    throw new Error(`build-data: ${f}: ${e.message}`);
  }
  const code = String(data.state).toLowerCase();
  const out = join(outDir, `${code}.json`);
  writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
  console.log(`build-data: ${f} -> site/data/${code}.json (${data.cards.length} cards)`);
  manifest.push({ code: String(data.state).toUpperCase(), name: String(data.state_name) });
}
// states-manifest.json drives the state <select> on check.html — one entry per
// built state file, sorted by code. The frontend fetches data/<code>.json
// (lowercased) when a state is picked.
manifest.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
writeFileSync(join(outDir, 'states-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`build-data: states-manifest.json (${manifest.length} states)`);
