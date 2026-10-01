<script setup lang="ts">
import {
  DexListItem,
  DexAvatar,
  DexTag,
  DexIcon,
  DexDropdownMenuRadioGroup,
  DexDropdownMenuRadioItem,
  DexDropdownMenu,
} from '@thryvlabs/dex-vue';
import { useRoute } from 'vue-router';
import { type Contact } from './contacts';
import { computed } from 'vue';

const props = defineProps<{
  contact: Contact;
}>();

defineOptions({
  name: 'DexContactsListItem',
});

const route = useRoute();

const to = computed(() => ({
  path: `/contacts/contact/${props.contact.id}`,
  query: route.query,
}));

const tagDisplay = computed(() => {
  return props.contact.status === 'lead'
    ? 'Lead'
    : props.contact.status === 'client'
      ? 'Client'
      : 'Other';
});

const tagColor = computed(() => {
  return props.contact.status === 'lead'
    ? 'var(--dex-color-accent-orange-emphasis)'
    : props.contact.status === 'client'
      ? 'var(--dex-color-accent-blue-emphasis)'
      : 'var(--dex-color-accent-gray-emphasis)';
});
</script>

<template>
  <DexListItem
    :to="to"
    :title="contact.name"
    :description="contact.email"
    class="break-all"
  >
    <template #leading>
      <DexAvatar :name="contact.name" />
    </template>

    <template #title>
      <span class="break-all line-clamp-1">
        {{ contact.name }}
      </span>
    </template>

    <template #description>
      <span class="break-all line-clamp-1">
        {{ contact.email }}
      </span>
    </template>

    <template #trailing>
      <DexDropdownMenu>
        <template #default>
          <DexTag>
            <template #leading>
              <DexIcon name="circle-fill" :style="{ fill: tagColor }" />
            </template>
            {{ tagDisplay }}
          </DexTag>
        </template>
        <template #content>
          <DexDropdownMenuRadioGroup :model-value="contact.status">
            <DexDropdownMenuRadioItem value="lead" title="Lead" />
            <DexDropdownMenuRadioItem value="client" title="Client" />
            <DexDropdownMenuRadioItem value="other" title="Other" />
          </DexDropdownMenuRadioGroup>
        </template>
      </DexDropdownMenu>
    </template>
  </DexListItem>
</template>
