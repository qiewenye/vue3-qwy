<script lang="ts" setup>
const props = defineProps({
  item: {
    type: Object,
    default: {},
  },
});
</script>
<template>
  <div class="menu-btn" @click="item.action">
    <slot></slot>
  </div>
</template>
<style lang="scss" scoped>
.menu-btn {
  padding: 8px;
  .shape-icon {
    margin-right: 8px;
    width: 16px;
    height: 16px;
    color: rgb(25, 25, 26);
  }
}
</style>
