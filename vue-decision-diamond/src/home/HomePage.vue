<script setup lang="ts">
import { DexText, DexInline, DexBox } from '@thryvlabs/dex-vue';
import MetricCard from './MetricCard.vue';

defineOptions({
  name: 'DexHomePage',
});
</script>

<template>
  <div
    class="h-full overflow-y-hidden flex flex-col"
    :style="{
      backgroundColor: 'var(--dex-surface-recessed-bgColor)',
    }"
  >
    <div
      class="h-full overflow-y-auto flex-1"
      :style="{
        padding: 'var(--dex-spacing-200)',
      }"
    >
      <DexBox padding-bottom="200">
        <DexText variant="display-2" as="h2">Dashboard</DexText>
      </DexBox>

      <DexInline gap="200">
        <MetricCard
          title="New leads"
          description="Total new leads"
          range="Last 30 days"
          :trend="100"
          :value="35"
        />

        <MetricCard
          title="Contacts"
          description="Total contacts"
          range="All time"
          :value="7039"
        />

        <MetricCard
          title="New clients"
          description="Total new clients"
          range="Last 30 days"
          :trend="-10"
          :value="-2"
        />

        <MetricCard
          title="Sales"
          description="Total sales"
          range="Last 30 days"
          :value="2500"
          format="currency"
        />

        <MetricCard
          title="Invoices"
          description="Total invoices"
          range="Last 30 days"
          :value="5000"
          format="currency"
        />

        <MetricCard
          title="Quotes"
          description="Total quotes"
          range="Last 30 days"
          :value="12000"
          format="currency"
        />
      </DexInline>
    </div>
  </div>
</template>
