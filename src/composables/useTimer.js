import { ref, computed, onScopeDispose, getCurrentScope } from 'vue';
import { TimerService } from '../services/timerService.js';

export function useTimer() {
  const elapsedSeconds = ref(0);
  const totalDuration = ref(0);
  const isRunning = ref(false);
  let timerServiceInstance = null;

  const formattedTime = computed(() => {
    return TimerService.formatTime(elapsedSeconds.value);
  });

  const formattedTotal = computed(() => {
    return TimerService.formatTime(totalDuration.value);
  });

  const remainingSeconds = computed(() => {
    return Math.max(0, totalDuration.value - elapsedSeconds.value);
  });

  const status = computed(() => {
    if (totalDuration.value <= 0) return 'normal';
    const remaining = remainingSeconds.value;
    if (totalDuration.value <= 300) {
      if (remaining <= 30) return 'danger';
      if (remaining <= 60) return 'warning';
      return 'normal';
    }
    if (remaining <= 120) return 'danger';
    if (remaining <= 300) return 'warning';
    return 'normal';
  });

  const isUrgent = computed(() => {
    return status.value === 'danger';
  });

  const isExpired = computed(() => {
    return totalDuration.value > 0 && elapsedSeconds.value >= totalDuration.value;
  });

  function start(durationSeconds, onExpire) {
    stop();
    totalDuration.value = Math.max(0, Math.round(durationSeconds));
    elapsedSeconds.value = 0;
    isRunning.value = true;

    timerServiceInstance = new TimerService();
    timerServiceInstance.start(totalDuration.value, {
      onTick: (data) => {
        elapsedSeconds.value = data.elapsedSeconds;
        totalDuration.value = data.totalSeconds;
      },
      onTimeout: () => {
        isRunning.value = false;
        if (typeof onExpire === 'function') {
          onExpire();
        }
      }
    });
  }

  function stop() {
    if (timerServiceInstance) {
      timerServiceInstance.stop();
      timerServiceInstance = null;
    }
    isRunning.value = false;
  }

  function reset() {
    stop();
    elapsedSeconds.value = 0;
    totalDuration.value = 0;
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stop();
    });
  }

  return {
    elapsedSeconds,
    totalDuration,
    remainingSeconds,
    isRunning,
    status,
    formattedTime,
    formattedTotal,
    isUrgent,
    isExpired,
    start,
    stop,
    reset
  };
}
