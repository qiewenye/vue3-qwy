<script setup>
import MenuButton from "./MenuButton.vue";
import IconSelect from "./icons/IconSelect.vue";
import IconCommunity from "./icons/IconCommunity.vue";
import IconDocumentation from "./icons/IconDocumentation.vue";
import IconEcosystem from "./icons/IconEcosystem.vue";
import IconLine from "./icons/IconLine.vue";
const props = defineProps({
  store: {
    type: [Object],
    default: {},
  },
});
const { menuList } = props.store;
</script>
<template>
  <header>
    <div class="tool-left"></div>
    <div class="tool-center">
      <MenuButton>
        <icon-select></icon-select>
      </MenuButton>
      <MenuButton>
        <IconCommunity></IconCommunity>
      </MenuButton>
      <MenuButton>
        <IconDocumentation></IconDocumentation>
      </MenuButton>
      <MenuButton>
        <IconLine></IconLine>
      </MenuButton>
      <MenuButton>
        <IconEcosystem></IconEcosystem>
      </MenuButton>
    </div>
    <div class="tool-right"></div>
  </header>
</template>
