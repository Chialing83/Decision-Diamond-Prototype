<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { contacts } from './contacts';
import { DexBox, DexInlineAlert, DexText } from '@thryvlabs/dex-vue';

defineOptions({
  name: 'DexContactDetails',
});

const route = useRoute();

const contactId = computed(() => {
  const raw = route.params.id;
  if (raw === undefined) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
});

const contact = computed(() => {
  const id = contactId.value;
  if (id === undefined) return undefined;
  return contacts.find((c) => c.id === id);
});
</script>

<template>
  <DexBox v-if="!contact" padding="200">
    <DexInlineAlert variant="danger" leading-icon>
      Contact not found
    </DexInlineAlert>
  </DexBox>

  <DexBox v-else padding="200">
    <DexText variant="display-3">{{ contact.name }}</DexText>
  </DexBox>
</template>
