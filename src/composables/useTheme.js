import { ref, watch, onMounted } from 'vue';

const theme = ref(localStorage.getItem('theme') || 'dark');

export function useTheme() {
  function applyTheme(newTheme) {
    theme.value = newTheme;
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }

  function toggleTheme() {
    const nextTheme = theme.value === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  }

  onMounted(() => {
    applyTheme(theme.value);
  });

  return {
    theme,
    toggleTheme,
    applyTheme
  };
}
