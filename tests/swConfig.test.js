import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Cloudflare _headers file contains optimal caching rules', () => {
  const headersPath = path.join(rootDir, 'public', '_headers');
  assert.strictEqual(fs.existsSync(headersPath), true, 'public/_headers file must exist');

  const content = fs.readFileSync(headersPath, 'utf-8');

  // Must configure immutable caching for hashed assets
  assert.match(content, /\/assets\/\*/);
  assert.match(content, /max-age=31536000,\s*immutable/);

  // Must configure long caching for images
  assert.match(content, /\/images\/\*/);
  assert.match(content, /max-age=2592000/);

  // Must configure prompt revalidation for HTML
  assert.match(content, /\/index\.html/);
  assert.match(content, /max-age=0,\s*must-revalidate/);

  // Must configure no-cache for Service Worker
  assert.match(content, /\/sw\.js/);
  assert.match(content, /no-cache,\s*no-store/);
});

test('Service Worker source does not contain redundant background fetch for cached assets', () => {
  const swPath = path.join(rootDir, 'public', 'sw.js');
  assert.strictEqual(fs.existsSync(swPath), true, 'public/sw.js file must exist');

  const content = fs.readFileSync(swPath, 'utf-8');

  // Must have separated caches
  assert.match(content, /gplx-images-v1/);
  assert.match(content, /gplx-fonts-v1/);

  // Must have placeholder for build assets
  assert.match(content, /\/\* __BUILD_ASSETS_PLACEHOLDER__ \*\//);

  // Must handle SKIP_WAITING
  assert.match(content, /SKIP_WAITING/);

  // Must not have the old buggy pattern that fetched in the background on every hit
  const hasOldRevalidateLoop = content.includes("if (!url.pathname.includes('/images/')) {") &&
                                content.includes("fetch(request).then((networkResponse) => {");
  assert.strictEqual(hasOldRevalidateLoop, false, 'Old redundant background fetch loop must be removed');
});

test('update-sw-manifest.js script is executable and valid', () => {
  const scriptPath = path.join(rootDir, 'scripts', 'update-sw-manifest.js');
  assert.strictEqual(fs.existsSync(scriptPath), true, 'scripts/update-sw-manifest.js must exist');
});

