<template>
  <DexBox padding="200">
    <DexStack gap="200">
      <DexInline gap="200" stretch align-x="spread" align-y="center">
        <DexText variant="display-2" as="h2"> Automations </DexText>

        <DexButtonGroup>
          <DexDropdownMenu align="end">
            <template #default>
              <DexIconButton name="more-vertical" label="More options" />
            </template>
            <template #content>
              <DexDropdownMenuItem title="Manage automation categories" />
            </template>
          </DexDropdownMenu>

          <DexDropdownMenu align="end">
            <template #default>
              <DexButton variant="solid" trailing-icon="chevron-down">
                Create an automation
              </DexButton>
            </template>
            <template #content>
              <DexDropdownMenuItem
                leading-icon="copy"
                title="Start from template"
                @select="router.push('/automations/templates')"
              />
              <DexDropdownMenuItem
                leading-icon="copy"
                title="Advanced automation"
                description="Automation builder"
                @select="router.push('/automations/builder/new')"
              />
              <DexDropdownMenuItem
                leading-icon="add-circle"
                title="Easy automation"
              />
            </template>
          </DexDropdownMenu>
        </DexButtonGroup>
      </DexInline>

      <DexInline gap="200" stretch align-x="spread" align-y="center">
        <DexInline gap="100">
          <DexInput
            type="search"
            label="Search"
            label-hidden
            placeholder="Search"
            :model-value="
              (table.getColumn('name')?.getFilterValue() as string) ?? ''
            "
            @update:model-value="handleNameSearchChange"
          >
            <template #leading>
              <DexIcon name="search" />
            </template>
          </DexInput>

          <DexDropdownMenu>
            <template #default>
              <DexButton
                variant="transparent"
                leading-icon="filter"
                :selected="statusFilterCount > 0"
              >
                Filter
                <template v-if="statusFilterCount > 0" #trailing>
                  <DexStatus variant="info" emphasis="high">
                    {{ statusFilterCount }}
                  </DexStatus>
                </template>
              </DexButton>
            </template>
            <template #content>
              <DexDropdownMenuItem
                leading-icon="x"
                title="Clear status filters"
                @select="clearStatusFilters"
              />
              <DexDropdownMenuCheckboxItem
                title="Active"
                :selected="isStatusFilterSelected('active')"
                @select="() => toggleStatusFilter('active')"
              />
              <DexDropdownMenuCheckboxItem
                title="Draft"
                :selected="isStatusFilterSelected('draft')"
                @select="() => toggleStatusFilter('draft')"
              />
              <DexDropdownMenuCheckboxItem
                title="Disabled"
                :selected="isStatusFilterSelected('disabled')"
                @select="() => toggleStatusFilter('disabled')"
              />
            </template>
          </DexDropdownMenu>
        </DexInline>

        <DexInline gap="100" align-y="center">
          <template v-if="selectedRowCount > 0">
            <DexText variant="body-2" color="subtle">
              {{ selectedRowCount }} selected
            </DexText>

            <DexDropdownMenu align="end">
              <template #default>
                <DexButton variant="outline" trailing-icon="chevron-down">
                  Bulk actions
                </DexButton>
              </template>
              <template #content>
                <DexDropdownMenuItem
                  leading-icon="zap-off"
                  @select="handleBulkDeactivate"
                >
                  Deactivate
                </DexDropdownMenuItem>
                <DexDropdownMenuItem
                  variant="danger"
                  leading-icon="trash-2"
                  @select="handleBulkDelete"
                >
                  Delete
                </DexDropdownMenuItem>
              </template>
            </DexDropdownMenu>
          </template>

          <DexIconButton name="settings" label="Settings" />
        </DexInline>
      </DexInline>

      <div style="width: 100%; overflow-x: auto">
        <DexTable style="min-width: 800px">
          <DexTableHeader>
            <DexTableRow
              v-for="headerGroup in table.getHeaderGroups()"
              :key="headerGroup.id"
            >
              <template v-for="header in headerGroup.headers" :key="header.id">
                <DexTableHeaderCheckboxCell v-if="header.id === 'select'">
                  <DexCheckbox
                    v-if="isLoading"
                    label="Select all"
                    label-hidden
                    disabled
                    :checked="false"
                  />
                  <FlexRender
                    v-else-if="!header.isPlaceholder"
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                </DexTableHeaderCheckboxCell>
                <DexTableHeaderCell
                  v-else
                  :width="header.id === 'actions' ? 'content' : undefined"
                >
                  <FlexRender
                    v-if="!header.isPlaceholder"
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                </DexTableHeaderCell>
              </template>
            </DexTableRow>
          </DexTableHeader>

          <DexTableBody>
            <template v-if="isLoading">
              <DexTableRow v-for="index in PAGE_SIZE" :key="index">
                <DexTableCheckboxCell>
                  <DexCheckbox
                    label="Select"
                    label-hidden
                    disabled
                    :checked="false"
                  />
                </DexTableCheckboxCell>
                <DexTableCell>
                  <DexSkeletonText
                    variant="body-2"
                    :style="{ width: '200px' }"
                  />
                </DexTableCell>
                <DexTableCell>
                  <DexSkeletonText
                    variant="body-2"
                    :style="{ width: '66px' }"
                  />
                </DexTableCell>
                <DexTableCell>
                  <DexSkeletonText
                    variant="body-2"
                    :style="{ width: '150px' }"
                  />
                </DexTableCell>
                <DexTableButtonCell>
                  <DexIconButton
                    name="more-vertical"
                    label="More actions"
                    disabled
                  />
                </DexTableButtonCell>
              </DexTableRow>
            </template>
            <template v-else>
              <DexTableRow
                v-for="row in table.getRowModel().rows"
                :key="row.id"
              >
                <template v-for="cell in row.getVisibleCells()" :key="cell.id">
                  <DexTableCheckboxCell v-if="cell.column.id === 'select'">
                    <FlexRender
                      :render="cell.column.columnDef.cell"
                      :props="cell.getContext()"
                    />
                  </DexTableCheckboxCell>
                  <DexTableButtonCell v-else-if="cell.column.id === 'actions'">
                    <FlexRender
                      :render="cell.column.columnDef.cell"
                      :props="cell.getContext()"
                    />
                  </DexTableButtonCell>
                  <DexTableCell v-else>
                    <FlexRender
                      :render="cell.column.columnDef.cell"
                      :props="cell.getContext()"
                    />
                  </DexTableCell>
                </template>
              </DexTableRow>
            </template>
          </DexTableBody>
        </DexTable>
      </div>

      <DexInline
        v-if="table.getFilteredRowModel().rows.length > 0 && !isLoading"
        align-y="center"
        stretch
        align-x="spread"
        gap="100"
      >
        <DexOffsetPager
          size="dense"
          :current-page="pageIndex + 1"
          :total-pages="
            Math.ceil(table.getFilteredRowModel().rows.length / PAGE_SIZE)
          "
          @update:current-page="
            (page: number) => {
              if (isLoading) return;
              router.push({
                path: route.path,
                query: { ...route.query, page: page.toString() },
              });
            }
          "
        />

        <DexText variant="body-2">
          {{ pageIndex * PAGE_SIZE + 1 }} -
          {{
            Math.min(
              (pageIndex + 1) * PAGE_SIZE,
              table.getFilteredRowModel().rows.length,
            )
          }}
          of
          {{ table.getFilteredRowModel().rows.length }}
        </DexText>
      </DexInline>
    </DexStack>
  </DexBox>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted, onUnmounted, type Ref } from 'vue';
import {
  DexBox,
  DexStack,
  DexText,
  DexTable,
  DexTableHeader,
  DexTableHeaderCell,
  DexTableRow,
  DexTableCheckboxCell,
  DexTableButtonCell,
  DexTableHeaderCheckboxCell,
  DexTableBody,
  DexTableCell,
  DexDropdownMenu,
  DexDropdownMenuItem,
  DexDropdownMenuCheckboxItem,
  DexIconButton,
  DexInline,
  DexButtonGroup,
  DexButton,
  DexInput,
  DexIcon,
  DexCheckbox,
  useNotification,
  useConfirmDialog,
  DexOffsetPager,
  DexStatus,
  DexSkeletonText,
} from '@thryvlabs/dex-vue';
import { automations, type Automation } from './automations';
import {
  useVueTable,
  getCoreRowModel,
  createColumnHelper,
  type RowSelectionState,
  FlexRender,
  getPaginationRowModel,
  getFilteredRowModel,
  type ColumnFiltersState,
} from '@tanstack/vue-table';
import { useRoute, useRouter } from 'vue-router';
import AutomationStatus from './AutomationStatus.vue';
import type { CheckboxState } from '@thryvlabs/dex-core';

defineOptions({
  name: 'DexAutomationsIndexPage',
});

const route = useRoute();
const router = useRouter();

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

const rowSelection: Ref<RowSelectionState> = ref({});

const initialStatusFilter = route.query.status as string | undefined;
const initialSearchFilter = route.query.search as string | undefined;

const getInitialFilters = (): ColumnFiltersState => {
  const filters: ColumnFiltersState = [];
  if (initialStatusFilter) {
    const statusValues = initialStatusFilter.split(',');
    filters.push({ id: 'status', value: statusValues });
  }
  if (initialSearchFilter) {
    filters.push({ id: 'name', value: initialSearchFilter });
  }
  return filters;
};

const columnFilters: Ref<ColumnFiltersState> = ref(getInitialFilters());

const currentPage = computed(() => Number(route.query.page) || 1);
const pageIndex = computed(() => Math.max(0, currentPage.value - 1));
const PAGE_SIZE = 20;

function formatDate(date: string) {
  const d = new Date(date);
  const dateString = d.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
  const timeString = d
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase();
  return `${dateString} ${timeString}`;
}

const { open: openNotification } = useNotification();
const { open: openConfirmDialog } = useConfirmDialog();

const columnHelper = createColumnHelper<Automation>();

const columns = [
  columnHelper.display({
    id: 'select',
    header: ({ table }) =>
      h(DexCheckbox, {
        label: 'Select all',
        labelHidden: true,
        checked: table.getIsAllRowsSelected()
          ? true
          : table.getIsSomeRowsSelected()
            ? 'indeterminate'
            : false,
        'onUpdate:checked': (value: CheckboxState) =>
          table.toggleAllRowsSelected(!!value),
      }),
    cell: ({ row }) =>
      h(DexCheckbox, {
        label: `Select ${row.original.name}`,
        labelHidden: true,
        checked: row.getIsSelected(),
        disabled: !row.getCanSelect(),
        'onUpdate:checked': (value: CheckboxState) =>
          row.toggleSelected(!!value),
      }),
  }),
  columnHelper.accessor('name', {
    header: 'Name',
    cell: (info) =>
      h(
        'a',
        {
          href: `/automations/builder/${info.row.original.id}`,
          style: 'color: #006ceb; text-decoration: none; cursor: pointer;',
          onClick: (e: MouseEvent) => {
            e.preventDefault();
            router.push(`/automations/builder/${info.row.original.id}`);
          },
        },
        info.getValue(),
      ),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => h(AutomationStatus, { status: info.getValue() }),
    filterFn: (row, columnId, filterValue: string[]) => {
      if (!filterValue || filterValue.length === 0) return true;
      return filterValue.includes(row.getValue(columnId));
    },
  }),
  columnHelper.accessor('updatedAt', {
    header: 'Last Updated',
    cell: (info) => formatDate(info.getValue()),
  }),
  columnHelper.display({
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      return h(
        DexDropdownMenu,
        {
          align: 'end',
          content: [
            {
              leadingIcon: 'edit',
              title: 'Edit',
              onSelect: () => {
                router.push(`/automations/builder/${row.original.id}`);
              },
            },
            {
              leadingIcon: 'trash-2',
              variant: 'danger',
              title: 'Delete',
              onSelect: () => {
                openConfirmDialog({
                  title: 'Delete automation',
                  description: `If you delete "${row.original.name}", it can't be undone.`,
                  confirmLabel: 'Delete automation',
                  cancelLabel: 'Go back',
                  variant: 'danger',
                  onConfirm: () => {
                    openNotification({
                      title: 'Automation deleted',
                      description: `"${row.original.name}" has been deleted.`,
                    });
                  },
                });
              },
            },
          ],
        },
        {
          default: () =>
            h(DexIconButton, {
              name: 'more-vertical',
              label: 'More actions',
            }),
        },
      );
    },
  }),
];

const table = useVueTable({
  get data() {
    return automations;
  },
  columns,
  state: {
    get rowSelection() {
      return rowSelection.value;
    },
    get columnFilters() {
      return columnFilters.value;
    },
    get pagination() {
      return {
        pageIndex: pageIndex.value,
        pageSize: PAGE_SIZE,
      };
    },
  },
  enableRowSelection: true,
  onRowSelectionChange: (updater) => {
    const value =
      typeof updater === 'function' ? updater(rowSelection.value) : updater;
    rowSelection.value = value;
  },
  onColumnFiltersChange: (updater) => {
    const value =
      typeof updater === 'function' ? updater(columnFilters.value) : updater;
    columnFilters.value = value;
  },
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
});

const statusFilterCount = computed(() => {
  return (
    (table.getColumn('status')?.getFilterValue() as string[] | undefined)
      ?.length ?? 0
  );
});

const isStatusFilterSelected = (status: string) => {
  return (
    (
      table.getColumn('status')?.getFilterValue() as string[] | undefined
    )?.includes(status) ?? false
  );
};

const toggleStatusFilter = (status: string) => {
  const currentFilter =
    (table.getColumn('status')?.getFilterValue() as string[]) || [];
  const isSelected = currentFilter.includes(status);
  const newFilter = isSelected
    ? currentFilter.filter((v) => v !== status)
    : [...currentFilter, status];

  table
    .getColumn('status')
    ?.setFilterValue(newFilter.length > 0 ? newFilter : undefined);

  const query = { ...route.query };
  delete query.page;
  if (newFilter.length > 0) {
    query.status = newFilter.join(',');
  } else {
    delete query.status;
  }
  router.push({ path: route.path, query });
};

const handleNameSearchChange = (value: string) => {
  table.getColumn('name')?.setFilterValue(value || undefined);
  const query = { ...route.query };
  delete query.page;
  if (value) {
    query.search = value;
  } else {
    delete query.search;
  }
  router.push({ path: route.path, query });
};

const clearStatusFilters = () => {
  if (statusFilterCount.value === 0) return;

  table.getColumn('status')?.setFilterValue(undefined);
  const query = { ...route.query };
  delete query.page;
  delete query.status;
  router.push({ path: route.path, query });
};

const selectedRows = computed(() => table.getSelectedRowModel().rows);
const selectedRowCount = computed(() => selectedRows.value.length);
const selectedNames = computed(() =>
  selectedRows.value.map((row) => row.original.name),
);

const handleBulkDeactivate = () => {
  openNotification({
    title: 'Automations deactivated',
    description:
      selectedRowCount.value === 1
        ? `"${selectedNames.value[0]}" has been deactivated.`
        : `${selectedRowCount.value} automations have been deactivated.`,
  });
};

const handleBulkDelete = () => {
  openConfirmDialog({
    title: 'Delete automations',
    description:
      selectedRowCount.value === 1
        ? `If you delete "${selectedNames.value[0]}", it can't be undone.`
        : `If you delete these ${selectedRowCount.value} automations, it can't be undone.`,
    confirmLabel: 'Delete automations',
    cancelLabel: 'Go back',
    variant: 'danger',
    onConfirm: () => {
      openNotification({
        title: 'Automations deleted',
        description:
          selectedRowCount.value === 1
            ? `"${selectedNames.value[0]}" has been deleted.`
            : `${selectedRowCount.value} automations have been deleted.`,
      });
    },
  });
};
</script>
