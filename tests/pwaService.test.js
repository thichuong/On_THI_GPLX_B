import { test } from 'node:test';
import assert from 'node:assert';
import { pwaService } from '../src/services/pwaService.js';

test('PWAService - Initial state is defined and sane', () => {
  assert.ok(pwaService !== null && typeof pwaService === 'object');
  assert.strictEqual(typeof pwaService.isInstallable, 'boolean');
  assert.strictEqual(typeof pwaService.isStandalone, 'boolean');
  assert.strictEqual(pwaService.deferredPrompt, null);
});

test('PWAService - promptInstall handles dismissed or unpromptable state gracefully', async () => {
  // When no deferredPrompt is available
  const result = await pwaService.promptInstall();
  assert.strictEqual(result.outcome, 'dismissed');
});

