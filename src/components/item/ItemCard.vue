<script setup lang="ts">
/* Hallmark · component: item-card · variant: grid · genre: editorial-cool
 * states: default · selected · deleted
 * pre-emit critique: P5 H5 E5 S5 R5 V5
 */
import { onMounted, onBeforeUnmount, ref } from 'vue';
import type { Item } from '@/types';
import { CATEGORY_LABELS } from '@/utils/constants';

const props = withDefaults(
  defineProps<{
    item: Item;
    selected?: boolean;
    showDelete?: boolean;
  }>(),
  { selected: false, showDelete: false },
);

const emit = defineEmits<{
  select: [item: Item];
  delete: [item: Item];
}>();

const thumbUrl = ref<string>('');
let revokeHandle: string | null = null;

onMounted(() => {
  revokeHandle = URL.createObjectURL(props.item.imageThumb);
  thumbUrl.value = revokeHandle;
});
onBeforeUnmount(() => {
  if (revokeHandle) {
    URL.revokeObjectURL(revokeHandle);
    revokeHandle = null;
  }
});

function formatDate(iso: number): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
</script>

<template>
  <div
    class="group relative flex flex-col overflow-hidden"
    :class="selected ? 'rounded-2xl' : 'neu-out rounded-2xl'"
    :style="selected
      ? {
          background: 'var(--color-paper)',
          boxShadow: '0 0 0 2px var(--color-primary), var(--neu-out-strong)',
        }
      : {}"
    @click="emit('select', item)"
  >
    <!-- Thumbnail -->
    <div class="relative aspect-square w-full overflow-hidden">
      <img
        v-if="thumbUrl"
        :src="thumbUrl"
        :alt="`${CATEGORY_LABELS[item.category]} 单品`"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <!-- Category badge -->
      <span
        class="glass-hairline absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide"
      >
        {{ CATEGORY_LABELS[item.category] }}
      </span>
      <!-- Selection check -->
      <span
        v-if="selected"
        class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs text-white"
        style="background: linear-gradient(140deg, var(--color-primary-glow), var(--color-primary-deep)); box-shadow: var(--shadow-primary-out);"
        aria-hidden="true"
      >✓</span>
      <!-- Delete button -->
      <button
        v-if="showDelete"
        class="glass-hairline absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full text-xs"
        aria-label="删除单品"
        @click.stop="emit('delete', item)"
      >
        ✕
      </button>
    </div>

    <!-- Meta -->
    <div class="flex flex-1 flex-col gap-1.5 px-3 py-2">
      <div class="flex flex-wrap gap-1">
        <span
          v-for="s in item.scenes.slice(0, 2)"
          :key="s"
          class="chip !px-1.5 !py-0.5 !text-[10px]"
        >#{{ s }}</span>
        <span
          v-if="item.scenes.length > 2"
          class="chip !px-1.5 !py-0.5 !text-[10px]"
        >+{{ item.scenes.length - 2 }}</span>
      </div>
      <div class="mt-auto flex items-center justify-between">
        <span class="font-mono text-[10px] ink-mute">
          {{ item.tempBands.map((b) => `${b}°`).join(' · ') }}
        </span>
        <span class="font-mono text-[10px] ink-mute">
          {{ formatDate(item.createdAt) }}
        </span>
      </div>
    </div>
  </div>
</template>
