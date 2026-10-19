<script setup lang="ts">
/* Hallmark · component: look-card · Look 收藏夹主卡片
 * states: default · has-deleted-item · source: recommendation | manual
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Item, Look } from '@/types';
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_ORDER } from '@/utils/constants';

const props = defineProps<{
  look: Look;
  items: Item[];
  showDelete?: boolean;
}>();

const emit = defineEmits<{
  delete: [look: Look];
}>();

const urlHandles = ref<string[]>([]);
const thumbUrls = ref<Record<string, string>>({});

const itemsById = computed(() => {
  const m = new Map<string, Item>();
  for (const it of props.items) m.set(it.id, it);
  return m;
});

function buildUrls() {
  for (const h of urlHandles.value) URL.revokeObjectURL(h);
  urlHandles.value = [];
  const next: Record<string, string> = {};
  const handles: string[] = [];
  for (const slot of props.look.items) {
    if (!slot.itemId) continue;
    const it = itemsById.value.get(slot.itemId);
    if (!it) continue;
    const url = URL.createObjectURL(it.imageThumb);
    next[slot.itemId] = url;
    handles.push(url);
  }
  thumbUrls.value = next;
  urlHandles.value = handles;
}

onMounted(buildUrls);
watch(() => props.look.items, buildUrls);
watch(() => props.items, buildUrls);
onBeforeUnmount(() => {
  for (const h of urlHandles.value) URL.revokeObjectURL(h);
  urlHandles.value = [];
});

function slotFor(cat: (typeof CATEGORY_ORDER)[number]) {
  return props.look.items.find((s) => s.category === cat) ?? null;
}

function itemFor(cat: (typeof CATEGORY_ORDER)[number]): Item | null {
  const slot = slotFor(cat);
  if (!slot?.itemId) return null;
  return itemsById.value.get(slot.itemId) ?? null;
}

const sourceLabel = computed(() => (props.look.source === 'recommendation' ? '推荐' : '手动'));

function formatDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function onDelete() {
  emit('delete', props.look);
}
</script>

<template>
  <article
    class="neu-out glass group relative flex flex-col rounded-2xl p-3 transition-shadow"
    :aria-label="look.name || `Look · ${sourceLabel}`"
  >
    <!-- Header -->
    <header class="mb-2 flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <h3 class="display truncate text-base">
          {{ look.name || '未命名 Look' }}
        </h3>
        <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] ink-mute">
          <span class="chip !px-1.5 !py-0 !text-[9px]">{{ sourceLabel }}</span>
          <span
            v-if="look.scene"
            class="chip !px-1.5 !py-0 !text-[9px]"
          >
            <span class="font-mono">#</span>{{ look.scene }}
          </span>
          <span v-if="look.tempBand != null" class="font-mono">
            {{ look.tempBand }}°
          </span>
          <span class="font-mono">·</span>
          <span class="font-mono">{{ formatDate(look.createdAt) }}</span>
        </div>
      </div>
      <button
        v-if="showDelete"
        class="glass-hairline flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs transition-opacity"
        aria-label="删除 Look"
        @click="onDelete"
      >✕</button>
    </header>

    <!-- Grid of 4 slots -->
    <div class="grid grid-cols-4 gap-2">
      <div
        v-for="cat in CATEGORY_ORDER"
        :key="cat"
        class="flex flex-col items-center gap-1"
      >
        <div
          class="relative aspect-square w-full overflow-hidden rounded-lg"
          :class="itemFor(cat) ? 'neu-in-soft' : 'neu-in-soft border-2 border-dashed'"
          :style="!itemFor(cat) ? { borderColor: 'var(--color-line-strong)' } : {}"
        >
          <img
            v-if="itemFor(cat)"
            :src="thumbUrls[itemFor(cat)!.id] ?? ''"
            :alt="CATEGORY_LABELS[cat]"
            class="h-full w-full object-cover"
          />
          <div
            v-else
            class="flex h-full w-full flex-col items-center justify-center text-center"
          >
            <span class="text-sm opacity-60" aria-hidden="true">{{ CATEGORY_ICONS[cat] }}</span>
            <span class="text-[8px] font-semibold ink-mute">空</span>
          </div>
        </div>
        <span
          class="text-[9px] font-semibold tracking-wide"
          :class="itemFor(cat) ? 'ink' : 'ink-mute'"
        >{{ CATEGORY_LABELS[cat] }}</span>
      </div>
    </div>
  </article>
</template>
