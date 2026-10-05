<script setup>
import { computed, isRef } from 'vue';

const props = defineProps({
  formattedTime: {
    type: [String, Object],
    required: true
  },
  formattedTotal: {
    type: [String, Object],
    default: ''
  },
  isUrgent: {
    type: [Boolean, Object],
    default: false
  },
  status: {
    type: [String, Object],
    default: 'normal'
  }
});

const resolvedTime = computed(() => (isRef(props.formattedTime) ? props.formattedTime.value : props.formattedTime));
const resolvedTotal = computed(() => (isRef(props.formattedTotal) ? props.formattedTotal.value : props.formattedTotal));
const resolvedUrgent = computed(() => (isRef(props.isUrgent) ? props.isUrgent.value : props.isUrgent));
const resolvedStatus = computed(() => (isRef(props.status) ? props.status.value : props.status));
</script>

<template>
  <div
    class="timer-display"
    :class="[resolvedStatus && resolvedStatus !== 'normal' ? resolvedStatus : '', { urgent: resolvedUrgent, danger: resolvedUrgent || resolvedStatus === 'danger', warning: resolvedStatus === 'warning' }]"
    role="timer"
    aria-live="polite"
  >
    <span class="timer-icon">⏱️</span>
    <span class="timer-current">{{ resolvedTime }}</span>
    <span v-if="resolvedTotal" class="timer-total"> / {{ resolvedTotal }}</span>
  </div>
</template>
