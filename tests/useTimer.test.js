import test from 'node:test';
import assert from 'node:assert/strict';
import { useTimer } from '../src/composables/useTimer.js';
import { TimerService } from '../src/services/timerService.js';

test('useTimer - Initial state is inactive and at 00:00', () => {
  const timer = useTimer();

  assert.equal(timer.isRunning.value, false);
  assert.equal(timer.elapsedSeconds.value, 0);
  assert.equal(timer.totalDuration.value, 0);
  assert.equal(timer.remainingSeconds.value, 0);
  assert.equal(timer.formattedTime.value, '00:00');
  assert.equal(timer.formattedTotal.value, '00:00');
  assert.equal(timer.status.value, 'normal');
  assert.equal(timer.isUrgent.value, false);
  assert.equal(timer.isExpired.value, false);
});

test('useTimer - Starts correctly, updates formatted time and handles ticks', async () => {
  const timer = useTimer();

  timer.start(1200);

  assert.equal(timer.isRunning.value, true);
  assert.equal(timer.totalDuration.value, 1200);
  assert.equal(timer.formattedTotal.value, '20:00');
  assert.equal(timer.formattedTime.value, '00:00');
  assert.equal(timer.status.value, 'normal');
  assert.equal(timer.isUrgent.value, false);

  // Wait 1.1s for at least one tick to occur
  await new Promise(resolve => setTimeout(resolve, 1100));

  assert.ok(timer.elapsedSeconds.value >= 1, `Expected elapsedSeconds >= 1, got ${timer.elapsedSeconds.value}`);
  assert.equal(timer.formattedTime.value, '00:01');
  assert.equal(timer.isRunning.value, true);

  timer.stop();
  assert.equal(timer.isRunning.value, false);
});

test('useTimer - Stop and reset functions work as expected', () => {
  const timer = useTimer();

  timer.start(600);
  assert.equal(timer.isRunning.value, true);

  timer.stop();
  assert.equal(timer.isRunning.value, false);
  assert.equal(timer.totalDuration.value, 600);

  timer.reset();
  assert.equal(timer.elapsedSeconds.value, 0);
  assert.equal(timer.totalDuration.value, 0);
  assert.equal(timer.formattedTime.value, '00:00');
});

test('useTimer - Status correctly transitions based on remaining time', () => {
  const timer = useTimer();

  // Test status computation for 1200s exam
  timer.totalDuration.value = 1200;

  // Remaining > 300s -> normal
  timer.elapsedSeconds.value = 800; // remaining = 400
  assert.equal(timer.status.value, 'normal');
  assert.equal(timer.isUrgent.value, false);

  // Remaining <= 300s and > 120s -> warning
  timer.elapsedSeconds.value = 950; // remaining = 250
  assert.equal(timer.status.value, 'warning');
  assert.equal(timer.isUrgent.value, false);

  // Remaining <= 120s -> danger & isUrgent
  timer.elapsedSeconds.value = 1100; // remaining = 100
  assert.equal(timer.status.value, 'danger');
  assert.equal(timer.isUrgent.value, true);

  // Expired
  timer.elapsedSeconds.value = 1200;
  assert.equal(timer.isExpired.value, true);
});

test('TimerService - Supports positional callback arguments (seconds, onTick, onTimeout)', () => {
  const timer = new TimerService();
  let tickedElapsed = null;
  let tickedTotal = null;

  timer.start(
    600,
    (elapsed, total) => {
      tickedElapsed = elapsed;
      tickedTotal = total;
    },
    () => {}
  );

  assert.equal(timer.isRunning, true);
  assert.equal(tickedElapsed, 0);
  assert.equal(tickedTotal, 600);

  timer.stop();
  assert.equal(timer.isRunning, false);
});
