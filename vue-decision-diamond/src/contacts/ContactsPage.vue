<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { DexBox, DexStack, DexText } from '@thryvlabs/dex-vue';
import ContactsList from './ContactsList.vue';

defineOptions({
  name: 'DexContactsPage',
});

const route = useRoute();
const hasContactId = computed(() => !!route.params.id);
</script>

<template>
  <div
    class="grid grid-cols-[375px_1fr] grid-rows-[100%] h-full"
    :style="{ backgroundColor: 'var(--dex-surface-flat-bgColor)' }"
  >
    <ContactsList />

    <div>
      <router-view />
      <DexBox v-if="!hasContactId" padding="200">
        <DexStack>
          <DexText variant="display-3">Contacts</DexText>
          <DexText variant="body">Select a contact to view details</DexText>
        </DexStack>
      </DexBox>
    </div>
  </div>
</template>
