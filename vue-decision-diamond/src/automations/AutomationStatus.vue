<template>
  <DexStatus :variant="variant" emphasis="high">
    {{ label }}
  </DexStatus>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DexStatus } from '@thryvlabs/dex-vue';

const props = defineProps<{
  status: 'draft' | 'active' | 'disabled';
}>();

const variant = computed(() => {
  switch (props.status) {
    case 'active':
      return 'success';
    default:
      return 'default';
  }
});

const label = computed(() => {
  switch (props.status) {
    case 'active':
      return 'Active';
    case 'disabled':
      return 'Disabled';
    case 'draft':
      return 'Draft';
    default:
      return '';
  }
});
</script>
