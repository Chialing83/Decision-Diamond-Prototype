<template>
  <div
    class="h-full overflow-y-hidden flex flex-col"
    :style="{ backgroundColor: 'var(--dex-surface-flat-bgColor)' }"
  >
    <div class="h-full overflow-y-auto flex-1">
      <router-view />
    </div>
  </div>
</template>
