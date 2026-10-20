<script setup lang="ts">
/* Hallmark · component: lookbook-page · genre: editorial-cool · theme: custom
 * states: loading · empty · has-looks · editor-open
 */
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useLooksStore } from '@/stores/looks';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import LookCard from '@/components/look/LookCard.vue';
import LookEditor from '@/components/look/LookEditor.vue';
import type { Look } from '@/types';

const looksStore = useLooksStore();
const itemsStore = useItemsStore();
const settingsStore = useSettingsStore();
const { looks, loading } = storeToRefs(looksStore);
const { items } = storeToRefs(itemsStore);

type SourceFilter = 'all' | 'recommendation' | 'manual';
const sourceFilter = ref<SourceFilter>('all');
const sceneFilter = ref<string | null>(null);

const editorOpen = ref(false);
const editorInitial = ref<Partial<Look> | null>(null);
const toast = ref<{ msg: string; ts: number } | null>(null);

const sceneOptions = computed(() => settingsStore.allScenes);

const visibleLooks = computed<Look[]>(() => {
  let list = looks.value;
  if (sourceFilter.value !== 'all') {
    list = list.filter((l) => l.source === sourceFilter.value);
  }
  if (sceneFilter.value) {
    list = list.filter((l) => l.scene === sceneFilter.value);
  }
  return list;
});

const recCount = computed(() => looks.value.filter((l) => l.source === 'recommendation').length);
const manualCount = computed(() => looks.value.filter((l) => l.source === 'manual').length);

function showToast(msg: string) {
  toast.value = { msg, ts: Date.now() };
}

function openEditor(look?: Look) {
  editorInitial.value = look ?? null;
  editorOpen.value = true;
}

function closeEditor() {
  editorOpen.value = false;
}

async function onSaved() {
  showToast('Look 已保存');
  await looksStore.refresh();
}

async function onDelete(look: Look) {
  if (!confirm('确定要删除这条 Look 吗？')) return;
  await looksStore.deleteLook(look.id);
  showToast('Look 已删除');
}

function onEdit(look: Look) {
  openEditor(look);
}

onMounted(async () => {
  await Promise.all([
    settingsStore.load(),
    itemsStore.refresh(),
    looksStore.refresh(),
  ]);
});
</script>

<template>
  <div class="flex flex-col">

    <!-- Toast -->
    <transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="toast"
        class="glass-strong pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2 px-4 py-2 text-sm shadow-lg"
        role="status"
        aria-live="polite"
      >{{ toast.msg }}</div>
    </transition>

    <!-- Header -->
    <header class="glass-strong relative overflow-hidden px-6 py-6">
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full opacity-70 blur-2xl"
        style="background: radial-gradient(circle, color-mix(in oklch, var(--color-primary) 70%, transparent), transparent 68%);"
      />
      <div class="relative">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-mono text-xs uppercase tracking-widest ink-mute">Lookbook</p>
            <h1 class="display mt-1 text-3xl">
              穿搭<span class="text-accent">收藏夹</span>
            </h1>
          </div>
          <button
            class="btn btn-primary !rounded-full !px-3 !py-2 text-sm"
            aria-label="新建 Look"
            @click="openEditor()"
          >
            <span class="text-lg leading-none" aria-hidden="true">＋</span>
            <span>新建</span>
          </button>
        </div>
        <p class="mt-3 text-sm ink-mute">
          共 <span class="font-mono font-semibold text-ink">{{ looks.length }}</span> 条
          <span class="font-mono">·</span>
          推荐 <span class="font-mono font-semibold text-ink">{{ recCount }}</span>
          <span class="font-mono">·</span>
          手动 <span class="font-mono font-semibold text-ink">{{ manualCount }}</span>
        </p>
      </div>
    </header>

    <!-- Source filter -->
    <div class="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1">
      <button
        type="button"
        class="chip shrink-0"
        :class="sourceFilter === 'all' ? 'chip-active' : ''"
        :aria-pressed="sourceFilter === 'all'"
        @click="sourceFilter = 'all'"
      >
        全部 {{ looks.length }}
      </button>
      <button
        type="button"
        class="chip shrink-0"
        :class="sourceFilter === 'recommendation' ? 'chip-active' : ''"
        :aria-pressed="sourceFilter === 'recommendation'"
        @click="sourceFilter = 'recommendation'"
      >
        推荐 {{ recCount }}
      </button>
      <button
        type="button"
        class="chip shrink-0"
        :class="sourceFilter === 'manual' ? 'chip-active' : ''"
        :aria-pressed="sourceFilter === 'manual'"
        @click="sourceFilter = 'manual'"
      >
        手动 {{ manualCount }}
      </button>
    </div>

    <!-- Scene filter -->
    <div v-if="sceneOptions.length > 0" class="mt-3 flex flex-wrap gap-1.5">
      <button
        type="button"
        class="chip !px-2 !py-0.5 !text-[10px]"
        :class="sceneFilter === null ? 'chip-active' : ''"
        :aria-pressed="sceneFilter === null"
        @click="sceneFilter = null"
      >全部场景</button>
      <button
        v-for="s in sceneOptions"
        :key="s"
        type="button"
        class="chip !px-2 !py-0.5 !text-[10px]"
        :class="sceneFilter === s ? 'chip-active' : ''"
        :aria-pressed="sceneFilter === s"
        @click="sceneFilter = sceneFilter === s ? null : s"
      >
        <span class="font-mono">#</span>{{ s }}
      </button>
    </div>

    <!-- Content -->
    <div class="mt-4 flex-1">

      <!-- Loading -->
      <div v-if="loading" class="glass flex flex-col items-center justify-center px-8 py-14 text-center">
        <div
          class="h-10 w-10 animate-spin rounded-full"
          style="background: conic-gradient(from 0deg, var(--color-primary), transparent 70%);"
        ></div>
        <p class="mt-3 text-sm ink-mute">加载中…</p>
      </div>

      <!-- Empty -->
      <div
        v-else-if="looks.length === 0"
        class="glass flex flex-col items-center justify-center px-8 py-14 text-center"
      >
        <div
          class="flex h-16 w-16 items-center justify-center rounded-full"
          style="background: linear-gradient(150deg, var(--color-accent-glow), var(--color-accent-deep)); box-shadow: var(--shadow-accent-out);"
        >
          <span class="display text-2xl text-white" aria-hidden="true">❋</span>
        </div>
        <p class="display mt-4 text-lg">还没有收藏的 Look</p>
        <p class="mt-1.5 text-sm ink-mute">手动创建一条，或在首页推荐中点"收藏"。</p>
        <button
          class="btn btn-primary mt-5 !rounded-full !px-5 !py-2.5"
          @click="openEditor()"
        >
          <span aria-hidden="true">＋</span>
          <span>新建 Look</span>
        </button>
      </div>

      <!-- Filtered empty -->
      <div
        v-else-if="visibleLooks.length === 0"
        class="glass flex flex-col items-center justify-center px-8 py-10 text-center"
      >
        <p class="display text-base">当前筛选下没有 Look</p>
        <p class="mt-1 text-sm ink-mute">试试切换来源或清除场景筛选</p>
      </div>

      <!-- Grid -->
      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LookCard
          v-for="look in visibleLooks"
          :key="look.id"
          :look="look"
          :items="items"
          show-edit
          show-delete
          @edit="onEdit"
          @delete="onDelete"
        />
      </div>
    </div>

    <!-- Floating new button (仅空状态隐藏；有内容时靠底部 Nav 上方) -->
    <button
      v-if="looks.length > 0"
      class="btn btn-primary fixed bottom-28 right-4 z-30 !rounded-full !p-4 !px-0 !py-0"
      style="width: 52px; height: 52px;"
      aria-label="新建 Look"
      @click="openEditor()"
    >
      <span class="text-xl leading-none" aria-hidden="true">＋</span>
    </button>

    <!-- Editor bottom sheet -->
    <LookEditor
      :open="editorOpen"
      :initial="editorInitial"
      @close="closeEditor"
      @saved="onSaved"
    />
  </div>
</template>
