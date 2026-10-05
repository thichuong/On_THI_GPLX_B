import { ref, computed } from 'vue';
import { StorageService } from '../services/storageService.js';
import { eventBus } from '../core/eventBus.js';

const VALID_THEMES = ['system', 'light', 'dark'];

function getStoredTheme() {
  if (typeof localStorage === 'undefined') return 'system';
  try {
    const saved = localStorage.getItem('theme') || localStorage.getItem('gplx_theme');
    return VALID_THEMES.includes(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

function getSystemPreference() {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch {
    // fallback
  }
  return 'dark';
}

const theme = ref(getStoredTheme());
const systemPreference = ref(getSystemPreference());

const resolvedTheme = computed(() => {
  return theme.value === 'system' ? systemPreference.value : theme.value;
});

function updateDOM(resolved, mode) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.setAttribute('data-theme-mode', mode);

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolved === 'light' ? '#f1f5f9' : '#0b0f19');
  }
}

function applyTheme(newTheme) {
  if (!VALID_THEMES.includes(newTheme)) {
    newTheme = 'system';
  }
  theme.value = newTheme;

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('theme', newTheme);
      localStorage.setItem('gplx_theme', newTheme);
    } catch {}
  }

  StorageService.setTheme(newTheme);
  updateDOM(resolvedTheme.value, newTheme);
}

function toggleTheme() {
  // Cycle order: system -> light -> dark -> system
  const nextThemeMap = {
    system: 'light',
    light: 'dark',
    dark: 'system'
  };
  const next = nextThemeMap[theme.value] || 'system';
  applyTheme(next);
}

// Listen to OS/Browser theme preference changes (prefers-color-scheme)
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e) => {
      systemPreference.value = e.matches ? 'dark' : 'light';
      if (theme.value === 'system') {
        updateDOM(resolvedTheme.value, 'system');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleMediaChange);
    }
  } catch {}
}

// Sync when theme:changed is emitted
eventBus.on('theme:changed', (newTheme) => {
  if (VALID_THEMES.includes(newTheme) && theme.value !== newTheme) {
    theme.value = newTheme;
    updateDOM(resolvedTheme.value, newTheme);
  }
});

// Immediate initial sync for DOM
if (typeof document !== 'undefined') {
  updateDOM(resolvedTheme.value, theme.value);
}

export function useTheme() {
  const themeIcon = computed(() => {
    if (theme.value === 'system') return '💻';
    if (theme.value === 'light') return '☀️';
    return '🌙';
  });

  const themeLabel = computed(() => {
    if (theme.value === 'system') return 'Hệ thống';
    if (theme.value === 'light') return 'Sáng';
    return 'Tối';
  });

  const themeDescription = computed(() => {
    if (theme.value === 'system') {
      return `Tự động theo thiết bị (${resolvedTheme.value === 'dark' ? 'đang là Tối' : 'đang là Sáng'})`;
    }
    if (theme.value === 'light') {
      return 'Giao diện nền sáng';
    }
    return 'Giao diện nền tối';
  });

  return {
    theme,
    resolvedTheme,
    systemPreference,
    themeIcon,
    themeLabel,
    themeDescription,
    applyTheme,
    setTheme: applyTheme,
    toggleTheme,
    cycleTheme: toggleTheme,
    isDark: computed(() => resolvedTheme.value === 'dark'),
    isLight: computed(() => resolvedTheme.value === 'light'),
    isSystem: computed(() => theme.value === 'system')
  };
}
