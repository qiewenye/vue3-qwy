<script lang="ts" setup>
const props = defineProps({
  item: {
    type: Object,
    default: {},
  },
});
</script>
<template>
  <div class="menu-button" @click="item.action">
    <slot></slot>
  </div>
</template>
