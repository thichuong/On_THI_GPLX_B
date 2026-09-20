#!/usr/bin/env node
/**
 * Post-build script: Injects hashed Vite assets into dist/sw.js
 * Ensures that all generated bundles are precached during Service Worker install.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const distAssetsDir = path.join(distDir, 'assets');
const distSwPath = path.join(distDir, 'sw.js');

function updateServiceWorkerManifest() {
  if (!fs.existsSync(distSwPath)) {
    console.warn('[SW Manifest] dist/sw.js not found. Skipping asset injection.');
    return;
  }

  // Scan dist/assets for JS and CSS bundles
  const assetFiles = [];
  if (fs.existsSync(distAssetsDir)) {
    const files = fs.readdirSync(distAssetsDir);
    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.css')) {
        assetFiles.push(`/assets/${file}`);
      }
    }
  }

  // Compute a content-based cache version hash
  const hash = crypto.createHash('sha256');
  hash.update(assetFiles.sort().join(','));
  const versionHash = hash.digest('hex').slice(0, 10);
  const cacheVersion = `gplx-v1.0-${versionHash}`;

  let swContent = fs.readFileSync(distSwPath, 'utf-8');

  // Replace placeholder or existing precache assets
  const placeholderRegex = /\/\* __BUILD_ASSETS_PLACEHOLDER__ \*\/\[\]/;
  const fallbackRegex = /const BUILD_ASSETS\s*=\s*\[[^\]]*\];/;

  const serializedAssets = JSON.stringify(assetFiles, null, 2);

  if (placeholderRegex.test(swContent)) {
    swContent = swContent.replace(placeholderRegex, serializedAssets);
  } else if (fallbackRegex.test(swContent)) {
    swContent = swContent.replace(fallbackRegex, `const BUILD_ASSETS = ${serializedAssets};`);
  }

  // Replace CACHE_VERSION
  swContent = swContent.replace(
    /const CACHE_VERSION\s*=\s*['"][^'"]*['"];/,
    `const CACHE_VERSION = '${cacheVersion}';`
  );

  fs.writeFileSync(distSwPath, swContent, 'utf-8');
  console.log(`[SW Manifest] Injected ${assetFiles.length} Vite build assets into dist/sw.js (Version: ${cacheVersion})`);

  // Verify _headers exists in dist/
  const distHeadersPath = path.join(distDir, '_headers');
  if (fs.existsSync(distHeadersPath)) {
    console.log('[SW Manifest] Verified Cloudflare _headers file in dist/');
  } else {
    // If Vite public copy missed it, copy from public/_headers
    const publicHeadersPath = path.join(rootDir, 'public', '_headers');
    if (fs.existsSync(publicHeadersPath)) {
      fs.copyFileSync(publicHeadersPath, distHeadersPath);
      console.log('[SW Manifest] Copied public/_headers to dist/_headers');
    }
  }
}

updateServiceWorkerManifest();

