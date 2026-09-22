// build-pins.mjs — compiles data/pins/*.yaml -> site/data/pins-<state>.json
// Mirrors build-data.mjs. Run validate.mjs first; this script assumes valid input.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseYAML } from './yaml.mjs';

const root = process.cwd();
const inDir = join(root, 'data', 'pins');
const outDir = join(root, 'site', 'data');
mkdirSync(outDir, { recursive: true });

const files = readdirSync(inDir).filter(f => /\.ya?ml$/.test(f));
if (files.length === 0) {
  console.error('build-pins: no pin files found');
  process.exit(1);
}
const manifest = [];
for (const f of files) {
  let data;
  try {
    data = parseYAML(readFileSync(join(inDir, f), 'utf8'));
  } catch (e) {
    throw new Error(`build-pins: ${f}: ${e.message}`);
  }
  const code = f.replace(/\.ya?ml$/, '').toLowerCase();
  if (!data || !Array.isArray(data.pins)) {
    throw new Error(`build-pins: ${f}: missing or invalid 'pins' list`);
  }
  const out = join(outDir, `pins-${code}.json`);
  writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
  console.log(`build-pins: ${f} -> site/data/pins-${code}.json (${data.pins.length} pins)`);
  manifest.push(code);
}
// pins-manifest.json lists which states have a pin file. Some states
// legitimately lack one (unverifiable courthouse data); map.js skips those
// gracefully instead of breaking.
manifest.sort();
writeFileSync(join(outDir, 'pins-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`build-pins: pins-manifest.json (${manifest.length} states)`);
