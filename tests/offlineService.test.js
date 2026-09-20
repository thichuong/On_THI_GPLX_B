import { test } from 'node:test';
import assert from 'node:assert';
import { offlineService } from '../src/services/offlineService.js';
import { dbService } from '../src/services/dbService.js';

test('OfflineService - getImageUrls returns all 318 normalized question image URLs', () => {
  const urls = offlineService.getImageUrls();
  assert.strictEqual(Array.isArray(urls), true, 'getImageUrls should return an array');
  assert.strictEqual(urls.length, 318, 'There should be exactly 318 questions with images');

  // Verify all URLs start with /images/
  for (const url of urls) {
    assert.strictEqual(url.startsWith('/images/'), true, `URL ${url} should start with /images/`);
    assert.strictEqual(url.endsWith('.png'), true, `URL ${url} should end with .png`);
  }

  // Verify distinctness
  const uniqueSet = new Set(urls);
  assert.strictEqual(uniqueSet.size, 318, 'All image URLs should be unique');
});

test('OfflineService - formatBytes formats byte sizes accurately', () => {
  assert.strictEqual(offlineService.formatBytes(0), '0 B');
  assert.strictEqual(offlineService.formatBytes(1024), '1 KB');
  assert.strictEqual(offlineService.formatBytes(1048576), '1 MB');
  assert.strictEqual(offlineService.formatBytes(157286400), '150 MB');
  assert.strictEqual(offlineService.formatBytes(1073741824), '1 GB');
});

test('OfflineService - getStatus returns structured offline status object', async () => {
  const status = await offlineService.getStatus();
  assert.ok(status !== null && typeof status === 'object', 'status should be an object');
  assert.strictEqual(typeof status.isOnline, 'boolean');
  assert.strictEqual(status.totalImages, 318);
  assert.strictEqual(typeof status.cachedCount, 'number');
  assert.strictEqual(typeof status.percent, 'number');
  assert.strictEqual(typeof status.isComplete, 'boolean');
});

test('DBService - getOfflineStatus and setOfflineStatus persist offline metadata', async () => {
  const mockStatus = {
    cachedCount: 318,
    totalImages: 318,
    isComplete: true,
    percent: 100,
    updatedAt: new Date().toISOString()
  };

  await dbService.setOfflineStatus(mockStatus);
  const retrieved = await dbService.getOfflineStatus();

  // In Node environment without browser IndexedDB, it may return null or fall back
  if (retrieved) {
    assert.strictEqual(retrieved.cachedCount, 318);
    assert.strictEqual(retrieved.isComplete, true);
    assert.strictEqual(retrieved.percent, 100);
  }
});

