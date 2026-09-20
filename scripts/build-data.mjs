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
for (const f of files) {
  const data = parseYAML(readFileSync(join(inDir, f), 'utf8'));
  const code = String(data.state).toLowerCase();
  const out = join(outDir, `${code}.json`);
  writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
  console.log(`build-data: ${f} -> site/data/${code}.json (${data.cards.length} cards)`);
}
