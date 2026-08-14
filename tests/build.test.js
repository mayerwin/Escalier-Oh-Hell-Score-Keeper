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
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

test('the precache manifest is up to date with the files on disk', () => {
  // The whole freshness guarantee rests on these hashes matching the bytes
  // they name. A stale manifest would serve users the previous build.
  const result = spawnSync(process.execPath, ['tools/build-sw.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});

test('precache hashes do not depend on the platform line ending', () => {
  // .gitattributes stores text with LF while a Windows working tree may hold
  // CRLF. Hashing raw bytes made the manifest check pass locally and fail in
  // CI on a commit that was perfectly correct.
  const source = read('tools/build-sw.mjs');
  assert.match(source, /replace\(\/\\r\\n\/g, '\\n'\)/, 'the hasher must normalise CRLF to LF for text files');

  const dir = mkdtempSync(join(tmpdir(), 'escalier-eol-'));
  try {
    const lf = join(dir, 'a.js');
    const crlf = join(dir, 'b.js');
    writeFileSync(lf, 'const a = 1;\nconst b = 2;\n');
    writeFileSync(crlf, 'const a = 1;\r\nconst b = 2;\r\n');

    const digest = (file) => {
      const bytes = readFileSync(file);
      return createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);
    };
    assert.equal(digest(lf), digest(crlf), 'the same source must hash the same either way');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('every precache entry carries a content hash', () => {
  const block = SW.slice(SW.indexOf('const PRECACHE'), SW.indexOf('/* @generated-precache-end */'));
  const entries = [...block.matchAll(/\['(\.\/[^']*)', '([0-9a-f]+)'\]/g)];
  assert.ok(entries.length > 30, `expected a full manifest, got ${entries.length}`);
  for (const [, url, hash] of entries) {
    assert.equal(hash.length, 10, `${url} has a malformed hash`);
  }
  const urls = entries.map(([, url]) => url);
  assert.equal(new Set(urls).size, urls.length, 'a URL is listed twice');
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
