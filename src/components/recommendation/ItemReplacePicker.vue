<script setup lang="ts">
/* Hallmark · component: item-replace-picker · bottom-sheet modal
 * states: open · closed · empty
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Category, Item } from '@/types';
import { CATEGORY_LABELS } from '@/utils/constants';

const props = defineProps<{
  open: boolean;
  category: Category;
  candidates: Item[];
}>();

const emit = defineEmits<{
  close: [];
  select: [item: Item];
}>();

const scene = ref<string>('');
const urlHandles = ref<string[]>([]);
const thumbUrls = ref<Record<string, string>>({});

const scenes = computed<string[]>(() => {
  const set = new Set<string>();
  for (const c of props.candidates) for (const s of c.scenes) set.add(s);
  return [...set];
});

const visibleCandidates = computed<Item[]>(() => {
  if (!scene.value) return props.candidates;
  return props.candidates.filter((c) => c.scenes.includes(scene.value));
});

const label = computed(() => CATEGORY_LABELS[props.category]);

function buildUrls() {
  for (const h of urlHandles.value) URL.revokeObjectURL(h);
  urlHandles.value = [];
  const next: Record<string, string> = {};
  const handles: string[] = [];
  for (const c of visibleCandidates.value) {
    const url = URL.createObjectURL(c.imageThumb);
    next[c.id] = url;
    handles.push(url);
  }
  thumbUrls.value = next;
  urlHandles.value = handles;
}

watch(visibleCandidates, buildUrls);

watch(
  () => props.open,
  (v) => {
    if (v) {
      document.body.style.overflow = 'hidden';
      scene.value = '';
      buildUrls();
    } else {
      document.body.style.overflow = '';
    }
  },
);

function urlFor(id: string): string {
  return thumbUrls.value[id] ?? '';
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close');
}

function close() {
  emit('close');
}

function pick(item: Item) {
  emit('select', item);
}

function filterScene(s: string) {
  scene.value = s;
}

onMounted(() => {
  document.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
  for (const h of urlHandles.value) URL.revokeObjectURL(h);
  urlHandles.value = [];
});
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-end justify-center"
    role="dialog"
    aria-modal="true"
    :aria-label="'选择' + label"
  >
    <button
      class="absolute inset-0 bg-black/40 backdrop-blur-sm"
      aria-label="关闭"
      @click="close"
    />

    <div
      class="glass-strong relative z-10 max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl p-5 pb-8"
    >
      <div class="mb-4 flex items-center justify-between">
        <h3 class="display text-xl">
          选择<span class="text-accent">{{ label }}</span>
        </h3>
        <button
          class="btn btn-ghost !rounded-full !px-2 !py-1 text-lg leading-none"
          aria-label="关闭"
          @click="close"
        >
          ✕
        </button>
      </div>

      <div v-if="scenes.length > 0" class="mb-4">
        <p class="mb-2 text-xs font-bold tracking-widest uppercase text-ink-mute">
          按场景筛选
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            class="chip"
            :class="!scene ? 'chip-active' : ''"
            @click="filterScene('')"
          >
            全部
          </button>
          <button
            v-for="s in scenes"
            :key="s"
            class="chip"
            :class="scene === s ? 'chip-active' : ''"
            @click="filterScene(s)"
          >
            <span class="font-mono">#</span>{{ s }}
          </button>
        </div>
      </div>

      <div
        v-if="visibleCandidates.length > 0"
        class="grid grid-cols-4 gap-3 md:grid-cols-6"
      >
        <button
          v-for="c in visibleCandidates"
          :key="c.id"
          class="neu-out group overflow-hidden rounded-xl p-1 transition-transform hover:-translate-y-0.5"
          @click="pick(c)"
        >
          <img
            :src="urlFor(c.id)"
            :alt="label"
            class="h-24 w-full rounded-lg object-cover"
          />
          <div class="flex flex-wrap gap-0.5 p-1">
            <span
              v-for="s in c.scenes.slice(0, 2)"
              :key="s"
              class="chip !px-1 !py-0 !text-[9px]"
            >
              #{{ s }}
            </span>
          </div>
        </button>
      </div>

      <div
        v-else
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <div class="mb-3 text-5xl opacity-30" aria-hidden="true">🔍</div>
        <p class="display text-lg ink-soft">
          没有符合条件的{{ label }}
        </p>
        <p class="mt-1 text-xs ink-mute">
          {{ scene ? '该场景下无' + label : '衣柜里还没有' + label }}
        </p>
      </div>
    </div>
  </div>
</template>
