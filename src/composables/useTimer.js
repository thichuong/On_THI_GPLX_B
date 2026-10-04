import { ref, computed } from 'vue';
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

  const isUrgent = computed(() => {
    if (totalDuration.value <= 0) return false;
    const remaining = totalDuration.value - elapsedSeconds.value;
    return remaining > 0 && remaining <= 60;
  });

  const isExpired = computed(() => {
    return totalDuration.value > 0 && elapsedSeconds.value >= totalDuration.value;
  });

  function start(durationSeconds, onExpire) {
    stop();
    totalDuration.value = durationSeconds;
    elapsedSeconds.value = 0;
    isRunning.value = true;

    timerServiceInstance = new TimerService();
    timerServiceInstance.start(
      durationSeconds,
      (elapsed, total) => {
        elapsedSeconds.value = elapsed;
        totalDuration.value = total;
      },
      () => {
        isRunning.value = false;
        if (typeof onExpire === 'function') {
          onExpire();
        }
      }
    );
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

  return {
    elapsedSeconds,
    totalDuration,
    isRunning,
    formattedTime,
    formattedTotal,
    isUrgent,
    isExpired,
    start,
    stop,
    reset
  };
}
