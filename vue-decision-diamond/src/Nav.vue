<script setup lang="ts">
import { DexStack } from '@thryvlabs/dex-vue';
import NavLink from './NavLink.vue';

defineOptions({
  name: 'DexNav',
});
</script>

<template>
  <nav class="nav">
    <DexStack as="ul" gap="050">
      <!--
        Home and Contacts are temporarily hidden — the routes/components are
        kept in the build but are not accessible while we focus the prototype
        on the Automation builder flow. Re-enable when ready.
      -->
      <!-- <NavLink to="/">Home</NavLink> -->
      <!-- <NavLink to="/contacts">Contacts</NavLink> -->
      <NavLink to="/automations">Automations</NavLink>
    </DexStack>
  </nav>
</template>
