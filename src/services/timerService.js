/**
 * Timer Service: Handles count-up exam timers with total time, formatted strings, and event emission.
 */
import { eventBus } from '../core/eventBus.js';

export class TimerService {
  constructor() {
    this.intervalId = null;
    this.totalSeconds = 0;
    this.remainingSeconds = 0;
    this.startTime = null;
    this.isRunning = false;
  }

  /**
   * Start a new count-up exam timer with a maximum duration
   * @param {number} seconds - Total exam duration in seconds
   * @param {Object} [options]
   * @param {Function} [options.onTick]
   * @param {Function} [options.onTimeout]
   */
  start(seconds, { onTick = null, onTimeout = null } = {}) {
    this.stop();

    this.totalSeconds = Math.max(0, Math.round(seconds));
    this.remainingSeconds = this.totalSeconds;
    this.startTime = Date.now();
    this.isRunning = true;
    this.onTickCallback = onTick;
    this.onTimeoutCallback = onTimeout;

    // Trigger initial tick (00:00 / total)
    this._handleTick();

    this.intervalId = setInterval(() => {
      const elapsed = Math.min(this.totalSeconds, Math.floor((Date.now() - this.startTime) / 1000));
      this.remainingSeconds = Math.max(0, this.totalSeconds - elapsed);
      this._handleTick();

      if (this.remainingSeconds <= 0) {
        this.stop();
        if (typeof this.onTimeoutCallback === 'function') {
          this.onTimeoutCallback();
        }
        eventBus.emit('timer:timeout');
      }
    }, 1000);
  }

  _handleTick() {
    const elapsedSeconds = this.getElapsed();
    const formattedElapsed = TimerService.formatTime(elapsedSeconds);
    const formattedTotal = TimerService.formatTime(this.totalSeconds);
    const formatted = `${formattedElapsed} / ${formattedTotal}`;

    const data = {
      elapsedSeconds,
      remainingSeconds: this.remainingSeconds,
      totalSeconds: this.totalSeconds,
      formattedElapsed,
      formattedTotal,
      formatted,
      status: this.getStatus()
    };

    if (typeof this.onTickCallback === 'function') {
      this.onTickCallback(data);
    }
    eventBus.emit('timer:tick', data);
  }

  /**
   * Stop and clear the timer
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * Get status based on remaining time
   * @returns {'danger' | 'warning' | 'normal'}
   */
  getStatus() {
    if (this.totalSeconds <= 300) {
      if (this.remainingSeconds <= 30) return 'danger';
      if (this.remainingSeconds <= 60) return 'warning';
      return 'normal';
    }
    if (this.remainingSeconds <= 120) return 'danger';
    if (this.remainingSeconds <= 300) return 'warning';
    return 'normal';
  }

  getRemaining() {
    return this.remainingSeconds;
  }

  getElapsed() {
    return Math.max(0, this.totalSeconds - this.remainingSeconds);
  }

  getTotal() {
    return this.totalSeconds;
  }

  /**
   * Format progress as "mm:ss / mm:ss" (elapsed / total)
   * @returns {string}
   */
  getFormattedProgress() {
    return `${TimerService.formatTime(this.getElapsed())} / ${TimerService.formatTime(this.totalSeconds)}`;
  }

  /**
   * Format seconds to mm:ss
   * @param {number} seconds
   * @returns {string}
   */
  static formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(s / 60);
    const remainingSec = s % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSec).padStart(2, '0')}`;
  }
}

