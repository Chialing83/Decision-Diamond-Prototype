<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  DexProvider,
  DexConfirmDialogViewport,
  DexNotificationViewport,
} from '@thryvlabs/dex-vue';
import Header from './Header.vue';
import Nav from './Nav.vue';

const route = useRoute();
const isFullscreen = computed(() => Boolean(route.meta?.fullscreen));
</script>

<template>
  <DexProvider>
    <div class="app dex-app" :class="{ 'app--fullscreen': isFullscreen }">
      <template v-if="!isFullscreen">
        <Header />
        <Nav />
      </template>

      <main class="main">
        <router-view />
      </main>
    </div>

    <DexConfirmDialogViewport />
    <DexNotificationViewport />
  </DexProvider>
</template>
