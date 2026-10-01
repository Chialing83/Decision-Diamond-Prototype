<script setup lang="ts">
import { DexText } from '@thryvlabs/dex-vue';
import { RouterLink } from 'vue-router';

interface Props {
  to: string;
}

defineProps<Props>();

defineOptions({
  name: 'DexNavLink',
});
</script>

<template>
  <li class="nav-link">
    <RouterLink :to="to" active-class="active">
      <DexText as="span" variant="body-2">
        <slot />
      </DexText>
    </RouterLink>
  </li>
</template>
