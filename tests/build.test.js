/**
 * Build integrity.
 *
 * The app ships with no bundler, so nothing checks at build time that the
 * service worker's precache list still matches the files on disk. A module
 * added but not precached would work perfectly online and break the moment the
 * user goes offline — exactly the failure this app must never have. These
 * tests are that missing build step.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { VERSION } from '../src/version.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relPath) => readFileSync(join(ROOT, relPath), 'utf8');
const exists = (relPath) => {
  try {
    statSync(join(ROOT, relPath));
    return true;
  } catch {
    return false;
  }
};

/** Every file under `dir`, as repo-relative POSIX paths. */
function walk(dir, filter = () => true) {
  const out = [];
  const absDir = join(ROOT, dir);
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(rel, filter));
    else if (filter(rel)) out.push(rel);
  }
  return out;
}

const SW = read('sw.js');

/** All `'./…'` literals in sw.js — the union of CORE and EXTRAS. */
const precached = new Set([...SW.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean));

test('the service worker version matches the app version', () => {
  const match = SW.match(/const VERSION = '([^']+)'/);
  assert.ok(match, 'sw.js must declare a VERSION');
  assert.equal(match[1], VERSION, 'bump sw.js VERSION together with src/version.js');
});

test('package.json version matches the app version', () => {
  assert.equal(JSON.parse(read('package.json')).version, VERSION);
});

test('every source module is precached', () => {
  const modules = walk('src', (p) => p.endsWith('.js'));
  assert.ok(modules.length > 15, 'expected to find the source tree');
  const missing = modules.filter((p) => !precached.has(p));
  assert.deepEqual(missing, [], 'add these to CORE in sw.js or the app breaks offline');
});

test('every font and icon is precached', () => {
  const assets = walk('assets', (p) => !p.endsWith('.txt'));
  const missing = assets.filter((p) => !precached.has(p));
  assert.deepEqual(missing, [], 'add these to EXTRAS in sw.js');
});

test('the stylesheet and shell are precached', () => {
  for (const path of ['index.html', 'styles/app.css', 'manifest.webmanifest']) {
    assert.ok(precached.has(path), `${path} must be precached`);
  }
  assert.ok(SW.includes("'./'"), 'the bare start URL must be precached too');
});

test('nothing is precached that does not exist', () => {
  const dangling = [...precached].filter((p) => p && !exists(p));
  assert.deepEqual(dangling, [], 'sw.js references files that are not in the repo');
});

test('every local file index.html references exists', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/(?:href|src)="\.\/([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 6, 'expected the shell to reference its assets');
  for (const ref of refs) assert.ok(exists(ref), `index.html references missing ${ref}`);
});

test('every manifest icon exists and is declared', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.ok(manifest.icons.length >= 3);
  for (const iconEntry of manifest.icons) {
    const rel = iconEntry.src.replace(/^\.\//, '');
    assert.ok(exists(rel), `manifest references missing ${rel}`);
    assert.ok(precached.has(rel), `${rel} should be precached`);
  }
  assert.equal(manifest.start_url, './', 'must be relative to work under a project Pages path');
  assert.equal(manifest.scope, './');
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'), 'needs a maskable icon for Android');
});

test('every path in the app is relative, so a project Pages subpath works', () => {
  const html = read('index.html');
  const rooted = [...html.matchAll(/(?:href|src)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(rooted, [], 'absolute paths break under https://user.github.io/repo/');

  for (const module of walk('src', (p) => p.endsWith('.js'))) {
    const source = read(module);
    const badImports = [...source.matchAll(/from '(\/[^']*)'/g)].map((m) => m[1]);
    assert.deepEqual(badImports, [], `${module} imports from an absolute path`);
  }
});

test('the stylesheet only loads fonts that are in the repo', () => {
  const css = read('styles/app.css');
  const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(urls.length >= 4, 'expected the self-hosted @font-face rules');
  for (const url of urls) {
    assert.ok(!/^https?:/i.test(url), `${url} must be self-hosted for offline use`);
    assert.ok(exists(url.replace(/^\.\.\//, '')), `missing font file ${url}`);
  }
});

test('nothing reaches out to a third-party origin at runtime', () => {
  const sources = [
    'index.html',
    'styles/app.css',
    'sw.js',
    ...walk('src', (p) => p.endsWith('.js')),
  ];
  // The repo link in the About panel is a plain anchor the user must click,
  // not something the page loads, so it is allowed.
  const allowed = /github\.com\/mayerwin/;
  for (const file of sources) {
    const source = read(file);
    const externals = [...source.matchAll(/https?:\/\/[^\s'"()]+/g)]
      .map((m) => m[0])
      .filter((url) => !allowed.test(url))
      .filter((url) => !url.startsWith('http://www.w3.org/'));
    assert.deepEqual(externals, [], `${file} references an external origin`);
  }
});

test('the bundled font licences are shipped', () => {
  for (const licence of ['assets/fonts/Fraunces-OFL.txt', 'assets/fonts/InstrumentSans-OFL.txt']) {
    assert.ok(exists(licence), `${licence} is required by the OFL`);
    assert.ok(read(licence).includes('SIL OPEN FONT LICENSE'));
  }
});

test('the repo has the files GitHub Pages and contributors expect', () => {
  for (const file of ['README.md', 'LICENSE', '.nojekyll', '.gitignore']) {
    assert.ok(exists(file), `missing ${file}`);
  }
});

test('no source file still imports something that was removed', () => {
  // Cheap dead-import check: every named import from a local module must be
  // exported by that module.
  const modules = walk('src', (p) => p.endsWith('.js'));
  for (const module of modules) {
    const source = read(module);
    for (const match of source.matchAll(/import \{([^}]+)\} from '([^']+)'/g)) {
      const names = match[1]
        .split(',')
        .map((n) => n.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean);
      const target = resolve(dirname(join(ROOT, module)), match[2]);
      const targetRel = relative(ROOT, target).split('\\').join('/');
      if (!exists(targetRel)) continue;
      const targetSource = read(targetRel);
      for (const name of names) {
        const exported =
          new RegExp(`export (?:const|function|let|class|async function) ${name}\\b`).test(targetSource) ||
          new RegExp(`export \\{[^}]*\\b${name}\\b`).test(targetSource);
        assert.ok(exported, `${module} imports { ${name} } from ${match[2]}, which does not export it`);
      }
    }
  }
});
