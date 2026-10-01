<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import {
  DexButton,
  DexInline,
  DexDropdownMenu,
  DexDropdownMenuItem,
  DexText,
} from '@thryvlabs/dex-vue';

defineOptions({
  name: 'DexHeader',
});

// Theme is locked to light variants for the POC — Dark / System are
// disabled to avoid the half-themed states some DEX components still
// have. Default is Whisker Light.
const theme = ref<'maverick' | 'keap'>('maverick');
const colorScheme = 'light' as const;

watchEffect(() => {
  document.body.dataset.theme = theme.value;
  document.body.dataset.colorScheme = colorScheme;
  localStorage.setItem('dex-theme', theme.value);
  localStorage.setItem('dex-color-scheme', colorScheme);
});

function setTheme(newTheme: 'maverick' | 'keap') {
  theme.value = newTheme;
}
</script>

<template>
  <header class="header">
    <DexInline align-x="spread" align-y="center" stretch>
      <DexInline align-y="center" gap="100">
        <span class="brand-logo" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="32" height="32">
            <!-- Cat head silhouette with two triangular ears -->
            <path
              d="M 5 7 L 11 14 Q 16 12.5 21 14 L 27 7 L 27 18 Q 27 27 16 27 Q 5 27 5 18 Z"
              fill="#F97316"
            />
            <!-- Inner ears -->
            <path d="M 7.5 9 L 11 13 L 12 9.5 Z" fill="#FED7AA" />
            <path d="M 24.5 9 L 21 13 L 20 9.5 Z" fill="#FED7AA" />
            <!-- Eyes -->
            <ellipse cx="12.2" cy="18" rx="1.8" ry="2.4" fill="#1F2937" />
            <ellipse cx="19.8" cy="18" rx="1.8" ry="2.4" fill="#1F2937" />
            <circle cx="12.7" cy="17.2" r="0.7" fill="#ffffff" />
            <circle cx="20.3" cy="17.2" r="0.7" fill="#ffffff" />
            <!-- Nose -->
            <path d="M 14.6 21 L 17.4 21 L 16 22.4 Z" fill="#1F2937" />
            <!-- Mouth: two soft curves -->
            <path
              d="M 16 22.4 Q 14.5 24 13 23 M 16 22.4 Q 17.5 24 19 23"
              stroke="#1F2937"
              stroke-width="0.9"
              fill="none"
              stroke-linecap="round"
            />
            <!-- Whiskers -->
            <line x1="1" y1="19" x2="9" y2="20.5" stroke="#1F2937" stroke-width="0.7" stroke-linecap="round" />
            <line x1="1" y1="22" x2="9" y2="22" stroke="#1F2937" stroke-width="0.7" stroke-linecap="round" />
            <line x1="31" y1="19" x2="23" y2="20.5" stroke="#1F2937" stroke-width="0.7" stroke-linecap="round" />
            <line x1="31" y1="22" x2="23" y2="22" stroke="#1F2937" stroke-width="0.7" stroke-linecap="round" />
          </svg>
        </span>
        <DexText as="h1" variant="display-2">Pebble</DexText>
      </DexInline>

      <DexDropdownMenu align="end">
        <template #default>
          <DexButton variant="outline">Theme</DexButton>
        </template>
        <template #content>
          <DexDropdownMenuItem @select="setTheme('maverick')">
            Whisker Light
          </DexDropdownMenuItem>
          <DexDropdownMenuItem @select="setTheme('keap')">
            Pebble Light
          </DexDropdownMenuItem>
        </template>
      </DexDropdownMenu>
    </DexInline>
  </header>
</template>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}
.brand-logo svg {
  display: block;
}
</style>
