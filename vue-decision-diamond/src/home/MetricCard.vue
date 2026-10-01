<script setup lang="ts">
import {
  DexText,
  DexCard,
  DexBox,
  DexStack,
  DexDropdownMenu,
  DexDropdownMenuItem,
  DexIcon,
  DexIconButton,
  DexInline,
} from '@thryvlabs/dex-vue';

defineOptions({
  name: 'DexMetricCard',
});

interface Props {
  title: string;
  description: string;
  value: number;
  trend?: number;
  range: string;
  format?: 'number' | 'currency';
}

withDefaults(defineProps<Props>(), {
  format: 'number',
  trend: undefined,
});

function formatNumber(value: number, format?: 'number' | 'currency'): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US').format(value);
}
</script>

<template>
  <DexCard elevation="subtle" :style="{ width: '200px' }">
    <div :style="{ height: '200px' }">
      <DexStack stretch align-y="spread">
        <DexStack>
          <DexBox padding-left="200" padding-right="100" padding-top="100">
            <DexInline stretch align-x="spread" align-y="center">
              <DexText variant="headline-4">{{ title }}</DexText>
              <DexDropdownMenu align="end">
                <template #default>
                  <DexIconButton
                    size="dense"
                    label="More options"
                    name="more-vertical"
                  />
                </template>
                <template #content>
                  <DexDropdownMenuItem>Manage widgets</DexDropdownMenuItem>
                  <DexDropdownMenuItem>Move widgets</DexDropdownMenuItem>
                </template>
              </DexDropdownMenu>
            </DexInline>
          </DexBox>

          <DexBox padding-x="200">
            <DexStack gap="050">
              <DexText variant="caption" color="subtle">
                {{ range }}
              </DexText>

              <DexText variant="caption" color="subtle">
                {{ description }}
              </DexText>
            </DexStack>

            <DexText variant="display-2">
              {{ formatNumber(value, format) }}
            </DexText>

            <DexInline v-if="trend" gap="025" align-y="center">
              <DexIcon
                :name="trend > 0 ? 'arrow-up-fill' : 'arrow-down-fill'"
                size="sm"
                :color="trend > 0 ? 'success' : 'danger'"
              />
              <DexText
                variant="body-2"
                :color="trend > 0 ? 'success' : 'danger'"
              >
                {{ Math.abs(trend) }}%
              </DexText>
            </DexInline>
          </DexBox>
        </DexStack>

        <DexBox padding-x="100" padding-bottom="100">
          <DexInline stretch align-x="spread">
            <DexIconButton size="dense" label="Add item">
              <DexIcon name="add-circle" size="sm" color="primary" />
            </DexIconButton>
            <DexIconButton size="dense" label="Go to item">
              <DexIcon name="arrow-right" size="sm" color="primary" />
            </DexIconButton>
          </DexInline>
        </DexBox>
      </DexStack>
    </div>
  </DexCard>
</template>
