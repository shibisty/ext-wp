// Packs dist/chrome and dist/firefox into store-ready zips:
//   node scripts/zip.mjs            (run after `npm run build`, or use `npm run zip`)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createZip, listFiles } from './zip-writer.mjs';

const root = resolve(import.meta.dirname, '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

for (const target of ['chrome', 'firefox']) {
  const dir = join(root, 'dist', target);
  if (!existsSync(join(dir, 'manifest.json'))) {
    console.error(`dist/${target} is missing — run "npm run build" first.`);
    process.exit(1);
  }
  const entries = listFiles(dir)
    .map((full) => ({ name: relative(dir, full).split(/[\\/]/).join('/'), data: readFileSync(full) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const out = join(root, 'dist', `wp-sidebar-editor-${target}-${version}.zip`);
  writeFileSync(out, createZip(entries));
  console.log(`${relative(root, out)}  (${entries.length} files)`);
}
