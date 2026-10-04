<script setup>
defineProps({
  formattedTime: {
    type: String,
    required: true
  },
  formattedTotal: {
    type: String,
    default: ''
  },
  isUrgent: {
    type: Boolean,
    default: false
  }
});
</script>

<template>
  <div
    class="timer-display"
    :class="{ urgent: isUrgent }"
    role="timer"
    aria-live="polite"
  >
    <span class="timer-icon">⏱️</span>
    <span class="timer-current">{{ formattedTime }}</span>
    <span v-if="formattedTotal" class="timer-total"> / {{ formattedTotal }}</span>
  </div>
</template>
