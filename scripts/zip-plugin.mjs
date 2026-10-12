// Packs the WordPress plugin for upload (Plugins → Add New → Upload, or the
// wordpress.org submission form):
//   node scripts/zip-plugin.mjs  →  dist/sidebar-editor-bridge-<version>.zip
//
// The archive contains a single top-level "sidebar-editor-bridge/" folder and
// only runtime files (no coding-standards config, no tests).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createZip, listFiles } from './zip-writer.mjs';

const root = resolve(import.meta.dirname, '..');
const SLUG = 'sidebar-editor-bridge';
const src = join(root, 'wp-plugin', SLUG);
const EXCLUDE = [/^\./, /(^|\/)node_modules\//, /(^|\/)tests?\//, /\.(md|xml|dist|lock)$/, /^composer\.json$/];

const header = readFileSync(join(src, `${SLUG}.php`), 'utf8');
const version = /^\s*\*\s*Version:\s*(\S+)/m.exec(header)?.[1];
const stable = /^Stable tag:\s*(\S+)/m.exec(readFileSync(join(src, 'readme.txt'), 'utf8'))?.[1];
if (!version || version !== stable) {
  console.error(`Version mismatch: plugin header "${version}" vs readme.txt Stable tag "${stable}".`);
  process.exit(1);
}

const entries = listFiles(src)
  .map((full) => relative(src, full).split(/[\\/]/).join('/'))
  .filter((name) => !EXCLUDE.some((re) => re.test(name)))
  .sort()
  .map((name) => ({ name: `${SLUG}/${name}`, data: readFileSync(join(src, name)) }));

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', `${SLUG}-${version}.zip`);
writeFileSync(out, createZip(entries));
console.log(`${relative(root, out)}  (${entries.length} files)`);
for (const e of entries) console.log('  ' + e.name);
