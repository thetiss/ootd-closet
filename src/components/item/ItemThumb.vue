<script setup lang="ts">
/* Hallmark · component: item-thumb · 单品缩略图（URL 生命周期管理）
 * 高度由父容器 aspect-square / h-* 控制
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Item } from '@/types';

const props = defineProps<{
  item: Item;
  alt?: string;
  className?: string;
}>();

const url = ref('');
let handle: string | null = null;

function build() {
  if (handle) URL.revokeObjectURL(handle);
  handle = URL.createObjectURL(props.item.imageThumb);
  url.value = handle;
}

onMounted(build);
watch(() => props.item, build);
onBeforeUnmount(() => {
  if (handle) URL.revokeObjectURL(handle);
});
</script>

<template>
  <img
    v-if="url"
    :src="url"
    :alt="alt || props.item.category"
    :class="className || 'h-full w-full object-cover'"
  />
</template>
