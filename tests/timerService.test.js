import test from 'node:test';
import assert from 'node:assert/strict';
import { TimerService } from '../src/services/timerService.js';

test('TimerService - formatTime formats seconds to mm:ss accurately', () => {
  assert.equal(TimerService.formatTime(0), '00:00');
  assert.equal(TimerService.formatTime(9), '00:09');
  assert.equal(TimerService.formatTime(59), '00:59');
  assert.equal(TimerService.formatTime(60), '01:00');
  assert.equal(TimerService.formatTime(65), '01:05');
  assert.equal(TimerService.formatTime(600), '10:00');
  assert.equal(TimerService.formatTime(1200), '20:00');
  assert.equal(TimerService.formatTime(-5), '00:00');
  assert.equal(TimerService.formatTime(65.8), '01:05');
});

test('TimerService - Initial state is 0 and formatted as 00:00 / 00:00', () => {
  const timer = new TimerService();
  assert.equal(timer.getElapsed(), 0);
  assert.equal(timer.getRemaining(), 0);
  assert.equal(timer.getTotal(), 0);
  assert.equal(timer.getFormattedProgress(), '00:00 / 00:00');
  assert.equal(timer.isRunning, false);
});

test('TimerService - Starts counting up from 00:00 with total duration', () => {
  const timer = new TimerService();
  let firstTickData = null;

  timer.start(1200, {
    onTick: (data) => {
      if (!firstTickData) firstTickData = data;
    }
  });

  assert.ok(timer.isRunning);
  assert.equal(timer.getTotal(), 1200);
  assert.equal(timer.getRemaining(), 1200);
  assert.equal(timer.getElapsed(), 0);
  assert.equal(timer.getFormattedProgress(), '00:00 / 20:00');

  assert.ok(firstTickData);
  assert.equal(firstTickData.elapsedSeconds, 0);
  assert.equal(firstTickData.remainingSeconds, 1200);
  assert.equal(firstTickData.totalSeconds, 1200);
  assert.equal(firstTickData.formattedElapsed, '00:00');
  assert.equal(firstTickData.formattedTotal, '20:00');
  assert.equal(firstTickData.formatted, '00:00 / 20:00');
  assert.equal(firstTickData.status, 'normal');

  timer.stop();
  assert.equal(timer.isRunning, false);
});

test('TimerService - Quick exam 10 minutes starts at 00:00 / 10:00', () => {
  const timer = new TimerService();
  timer.start(600);

  assert.equal(timer.getFormattedProgress(), '00:00 / 10:00');
  assert.equal(timer.getTotal(), 600);

  timer.stop();
});

test('TimerService - Status thresholds for standard and short exams', () => {
  const timer = new TimerService();
  timer.totalSeconds = 1200;

  // Normal: remaining > 300s
  timer.remainingSeconds = 301;
  assert.equal(timer.getStatus(), 'normal');

  // Warning: remaining <= 300s and > 120s
  timer.remainingSeconds = 300;
  assert.equal(timer.getStatus(), 'warning');
  timer.remainingSeconds = 121;
  assert.equal(timer.getStatus(), 'warning');

  // Danger: remaining <= 120s
  timer.remainingSeconds = 120;
  assert.equal(timer.getStatus(), 'danger');
  timer.remainingSeconds = 10;
  assert.equal(timer.getStatus(), 'danger');

  // Short exam (<= 300s)
  timer.totalSeconds = 180;
  timer.remainingSeconds = 120;
  assert.equal(timer.getStatus(), 'normal'); // 120s is normal for 3-minute exam

  timer.remainingSeconds = 60;
  assert.equal(timer.getStatus(), 'warning');

  timer.remainingSeconds = 30;
  assert.equal(timer.getStatus(), 'danger');
});
