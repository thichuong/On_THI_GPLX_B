<script setup>
defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'info' // 'info' | 'online' | 'offline'
  }
});
</script>

<template>
  <div
    id="app-toast"
    class="app-toast"
    :class="[type, { show: isVisible }]"
    role="status"
    aria-live="polite"
    v-html="message"
  ></div>
</template>
