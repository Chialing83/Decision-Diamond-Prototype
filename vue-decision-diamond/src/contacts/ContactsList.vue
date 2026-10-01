<script setup lang="ts">
import {
  DexBox,
  DexButtonGroup,
  DexIconButton,
  DexInline,
  DexText,
  DexCursorPager,
  DexCursorPagerFirst,
  DexCursorPagerPrevious,
  DexCursorPagerNext,
  DexCursorPagerLast,
  DexList,
  DexListItem,
  DexSkeletonAvatar,
  DexSkeletonItem,
  DexSkeletonText,
  DexTooltip,
  DexDropdownMenu,
  DexDropdownMenuRadioGroup,
  DexDropdownMenuRadioItem,
  DexDropdownMenuHeading,
  DexDropdownMenuCheckboxItem,
  DexStatus,
} from '@thryvlabs/dex-vue';
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { contacts } from './contacts';
import AddContactModal from './AddContactModal.vue';
import ContactListItem from './ContactListItem.vue';

const PAGE_SIZE = 20;

const route = useRoute();
const router = useRouter();

defineOptions({
  name: 'DexContactsList',
});

const isLoading = ref(true);
let loadingTimer: ReturnType<typeof setTimeout>;

onMounted(() => {
  const loadingTimeout = Math.random() * 2000 + 500;
  loadingTimer = setTimeout(() => {
    isLoading.value = false;
  }, loadingTimeout);
});

onUnmounted(() => {
  clearTimeout(loadingTimer);
});

const currentPage = computed(() => Number(route.query.page) || 1);

const sort = computed(() => (route.query.sort as string) || 'firstName:asc');

const filterParam = computed(() => route.query.filter as string | undefined);
const filters = computed(() =>
  filterParam.value ? filterParam.value.split(',') : [],
);

const filteredAndSortedContacts = computed(() => {
  let filteredArray = [...contacts];
  if (filters.value.length > 0) {
    filteredArray = filteredArray.filter((contact) =>
      filters.value.includes(contact.status),
    );
  }

  const [field, direction] = sort.value.split(':');
  const sortedArray = filteredArray.sort((a, b) => {
    let aValue: string;
    let bValue: string;

    if (field === 'firstName') {
      aValue = a.name.split(' ')[0] || '';
      bValue = b.name.split(' ')[0] || '';
    } else if (field === 'lastName') {
      const aParts = a.name.split(' ');
      const bParts = b.name.split(' ');
      aValue = aParts[aParts.length - 1] || '';
      bValue = bParts[bParts.length - 1] || '';
    } else if (field === 'email') {
      aValue = a.email;
      bValue = b.email;
    } else {
      return 0;
    }

    const comparison = aValue.localeCompare(bValue, undefined, {
      sensitivity: 'base',
    });
    return direction === 'asc' ? comparison : -comparison;
  });

  return sortedArray;
});

const totalPages = computed(() =>
  Math.ceil(filteredAndSortedContacts.value.length / PAGE_SIZE),
);

const startIndex = computed(() => (currentPage.value - 1) * PAGE_SIZE);
const endIndex = computed(() =>
  Math.min(
    startIndex.value + PAGE_SIZE,
    filteredAndSortedContacts.value.length,
  ),
);
const currentContacts = computed(() =>
  filteredAndSortedContacts.value.slice(startIndex.value, endIndex.value),
);

const handlePageChange = (page: number) => {
  const query = { ...route.query, page: page.toString() };
  router.push({ query });
};

const handleSortChange = (newSort: string) => {
  const query = { ...route.query, sort: newSort, page: undefined };
  router.push({ query });
};

const isFilterSelected = (status: string) => {
  return filters.value.includes(status);
};

const toggleFilter = (status: string) => {
  const isSelected = filters.value.includes(status);
  const newFilters = isSelected
    ? filters.value.filter((f) => f !== status)
    : [...filters.value, status];

  const query = {
    ...route.query,
    page: undefined,
    filter: newFilters.length > 0 ? newFilters.join(',') : undefined,
  };
  router.push({ query });
};

const isSortDropdownOpen = ref(false);
const isFilterDropdownOpen = ref(false);
</script>

<template>
  <div
    class="flex flex-col h-full"
    :style="{ borderRight: '1px solid var(--dex-borderColor-alpha-subtle)' }"
  >
    <DexBox
      padding="200"
      :style="{ borderBottom: '1px solid var(--dex-borderColor-alpha-subtle)' }"
    >
      <DexInline align-y="center" align-x="spread" stretch>
        <DexText as="h2" variant="display-3"> People </DexText>

        <DexButtonGroup>
          <DexTooltip content="Sort contacts" :disabled="isSortDropdownOpen">
            <DexInline>
              <DexDropdownMenu v-model:open="isSortDropdownOpen">
                <template #default>
                  <DexIconButton name="sort" label="Sort" />
                </template>
                <template #content>
                  <DexDropdownMenuHeading>
                    Sort contacts by
                  </DexDropdownMenuHeading>
                  <DexDropdownMenuRadioGroup
                    :model-value="sort"
                    @update:model-value="handleSortChange"
                  >
                    <DexDropdownMenuRadioItem
                      value="firstName:asc"
                      title="First name, A-Z"
                    />
                    <DexDropdownMenuRadioItem
                      value="firstName:desc"
                      title="First name, Z-A"
                    />
                    <DexDropdownMenuRadioItem
                      value="lastName:asc"
                      title="Last name, A-Z"
                    />
                    <DexDropdownMenuRadioItem
                      value="lastName:desc"
                      title="Last name, Z-A"
                    />
                    <DexDropdownMenuRadioItem
                      value="email:asc"
                      title="Email, A-Z"
                    />
                    <DexDropdownMenuRadioItem
                      value="email:desc"
                      title="Email, Z-A"
                    />
                  </DexDropdownMenuRadioGroup>
                </template>
              </DexDropdownMenu>
            </DexInline>
          </DexTooltip>

          <DexTooltip
            content="Filter contacts"
            :disabled="isFilterDropdownOpen"
          >
            <DexInline :style="{ position: 'relative' }">
              <DexDropdownMenu v-model:open="isFilterDropdownOpen">
                <template #default>
                  <DexIconButton
                    name="filter"
                    label="Filter"
                    :selected="filters.length > 0"
                  />
                </template>
                <template #content>
                  <DexDropdownMenuHeading>
                    Filter by contact type
                  </DexDropdownMenuHeading>
                  <DexDropdownMenuCheckboxItem
                    title="Lead"
                    :selected="isFilterSelected('lead')"
                    @select="() => toggleFilter('lead')"
                  />
                  <DexDropdownMenuCheckboxItem
                    title="Client"
                    :selected="isFilterSelected('client')"
                    @select="() => toggleFilter('client')"
                  />
                  <DexDropdownMenuCheckboxItem
                    title="Other"
                    :selected="isFilterSelected('other')"
                    @select="() => toggleFilter('other')"
                  />
                </template>
              </DexDropdownMenu>
              <DexStatus
                v-if="filters.length > 0"
                variant="info"
                emphasis="high"
                :style="{
                  position: 'absolute',
                  top: 'calc(var(--dex-spacing-050) * -1)',
                  right: 'calc(var(--dex-spacing-050) * -1)',
                  pointerEvents: 'none',
                }"
              >
                {{ filters.length }}
              </DexStatus>
            </DexInline>
          </DexTooltip>

          <DexTooltip content="Add contact">
            <DexInline>
              <AddContactModal>
                <template #trigger>
                  <DexIconButton name="add-circle" label="Add Contact" />
                </template>
              </AddContactModal>
            </DexInline>
          </DexTooltip>
        </DexButtonGroup>
      </DexInline>
    </DexBox>
    <DexList border="stretch" class="flex-1 overflow-y-auto">
      <template v-if="isLoading">
        <DexListItem v-for="index in PAGE_SIZE" :key="index">
          <template #leading>
            <DexSkeletonAvatar />
          </template>
          <template #trailing>
            <DexSkeletonItem
              :style="{
                width: '66px',
                height: '24px',
                borderRadius: 'var(--dex-borderRadius-150)',
              }"
            />
          </template>
          <template #title>
            <DexSkeletonText variant="body" :style="{ width: '100px' }" />
          </template>
          <template #description>
            <DexSkeletonText variant="body-2" :style="{ width: '150px' }" />
          </template>
        </DexListItem>
      </template>
      <template v-else>
        <ContactListItem
          v-for="contact in currentContacts"
          :key="contact.id"
          :contact="contact"
        />
      </template>
    </DexList>
    <DexBox
      v-if="totalPages > 0"
      padding="200"
      class="flex justify-center"
      :style="{ borderTop: '1px solid var(--dex-borderColor-alpha-subtle)' }"
    >
      <DexInline align-y="center" stretch align-x="spread" gap="100">
        <DexCursorPager
          aria-label="Contacts pagination"
          labels-hidden
          size="dense"
        >
          <DexCursorPagerFirst
            :disabled="currentPage === 1 || isLoading"
            @click="() => handlePageChange(1)"
          />
          <DexCursorPagerPrevious
            :disabled="currentPage === 1 || isLoading"
            @click="() => handlePageChange(currentPage - 1)"
          />
          <DexCursorPagerNext
            :disabled="currentPage === totalPages || isLoading"
            @click="() => handlePageChange(currentPage + 1)"
          />
          <DexCursorPagerLast
            :disabled="currentPage === totalPages || isLoading"
            @click="() => handlePageChange(totalPages)"
          />
        </DexCursorPager>

        <DexSkeletonText
          v-if="isLoading"
          variant="body-2"
          :style="{ width: '100px' }"
        />
        <DexText v-else variant="body-2">
          {{ startIndex + 1 }} - {{ endIndex }} of
          {{ filteredAndSortedContacts.length }}
        </DexText>
      </DexInline>
    </DexBox>
  </div>
</template>
