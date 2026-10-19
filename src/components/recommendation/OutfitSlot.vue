<script setup lang="ts">
/* Hallmark · component: outfit-slot · variant: compact
 * states: default · missing · replaceable
 * pre-emit critique: P5 H4 E4 S5 R5 V5
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Category, Item } from '@/types';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '@/utils/constants';

const props = withDefaults(
  defineProps<{
    category: Category;
    item: Item | null;
    replaceable?: boolean;
  }>(),
  { replaceable: true },
);

const emit = defineEmits<{
  replace: [category: Category];
}>();

const thumbUrl = ref<string>('');
let revokeHandle: string | null = null;

onMounted(syncUrl);
onBeforeUnmount(() => {
  if (revokeHandle) {
    URL.revokeObjectURL(revokeHandle);
    revokeHandle = null;
  }
});

watch(() => props.item, syncUrl);

function syncUrl() {
  if (revokeHandle) {
    URL.revokeObjectURL(revokeHandle);
    revokeHandle = null;
  }
  thumbUrl.value = '';
  if (props.item) {
    revokeHandle = URL.createObjectURL(props.item.imageThumb);
    thumbUrl.value = revokeHandle;
  }
}

const label = computed(() => CATEGORY_LABELS[props.category]);
const icon = computed(() => CATEGORY_ICONS[props.category]);
const scenePreview = computed(() => (props.item?.scenes ?? []).slice(0, 2));
</script>

<template>
  <div
    class="group relative flex flex-col items-center gap-1"
    :class="item ? 'cursor-pointer' : 'cursor-default'"
    :role="item ? 'button' : undefined"
    :tabindex="item ? 0 : undefined"
    :aria-label="item ? `${label}，点击替换` : `缺${label}`"
    @click="item && replaceable && emit('replace', category)"
    @keydown.enter="item && replaceable && emit('replace', category)"
  >
    <!-- Thumbnail / placeholder -->
    <div
      class="relative h-16 w-16 overflow-hidden rounded-xl"
      :class="item ? 'neu-in-soft' : 'neu-in-soft border-2 border-dashed'"
      :style="!item ? { borderColor: 'var(--color-line-strong)' } : {}"
    >
      <img
        v-if="item && thumbUrl"
        :src="thumbUrl"
        :alt="label"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div
        v-else
        class="flex h-full w-full flex-col items-center justify-center text-center"
      >
        <span class="text-base opacity-60" aria-hidden="true">{{ icon }}</span>
        <span class="text-[9px] font-semibold tracking-wide ink-mute">缺</span>
      </div>
      <!-- Replace hint -->
      <button
        v-if="item && replaceable"
        class="glass-hairline absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[8px]"
        aria-label="替换此单品"
        @click.stop="emit('replace', category)"
      >↻</button>
    </div>

    <!-- Label -->
    <span class="text-[10px] font-semibold tracking-wide" :class="item ? 'ink' : 'ink-mute'">
      {{ label }}
    </span>
    <!-- Scene preview -->
    <div v-if="item && scenePreview.length > 0" class="flex flex-wrap justify-center gap-0.5">
      <span
        v-for="s in scenePreview"
        :key="s"
        class="chip !px-1 !py-0 !text-[8px]"
      >#{{ s }}</span>
    </div>
  </div>
</template>
