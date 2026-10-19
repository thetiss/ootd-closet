<script setup lang="ts">
/* Hallmark · component: wardrobe-page · genre: editorial-cool · theme: custom
 * pre-emit critique: P5 H5 E5 S5 R5 V5
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/utils/constants';
import type { Category, Item } from '@/types';
import ItemCard from '@/components/item/ItemCard.vue';

const router = useRouter();
const itemsStore = useItemsStore();
const settingsStore = useSettingsStore();
const { items, loading } = storeToRefs(itemsStore);

type TabKey = 'all' | Category;
const activeCategory = ref<TabKey>('all');
const activeScene = ref<string | null>(null);
const showDeleteMode = ref(false);

const visibleItems = computed<Item[]>(() => {
  let list = items.value;
  if (activeCategory.value !== 'all') {
    list = list.filter((i) => i.category === activeCategory.value);
  }
  if (activeScene.value) {
    const scene = activeScene.value;
    list = list.filter((i) => i.scenes.includes(scene));
  }
  return list;
});

const categoryTabs = computed(() => [
  { key: 'all' as TabKey, label: `全部 ${items.value.length}` },
  ...CATEGORY_ORDER.map((c) => ({
    key: c as TabKey,
    label: `${CATEGORY_LABELS[c]} ${items.value.filter((i) => i.category === c).length}`,
  })),
]);

const sceneFilters = computed(() => settingsStore.allScenes.slice(0, 8));

function onDeleteItem(item: Item) {
  if (confirm('确定要删除这件单品吗？此操作不可撤销。')) {
    void itemsStore.deleteItem(item.id);
  }
}

function goUpload() { router.push('/wardrobe/upload'); }

function toggleDeleteMode() {
  showDeleteMode.value = !showDeleteMode.value;
}

onMounted(async () => {
  await Promise.all([settingsStore.load(), itemsStore.refresh()]);
});
</script>

<template>
  <div class="flex flex-col">

    <!-- Header -->
    <header class="glass-strong relative overflow-hidden px-6 py-6">
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full opacity-70 blur-2xl"
        style="background: radial-gradient(circle, color-mix(in oklch, var(--color-primary) 70%, transparent), transparent 68%);"
      />
      <div class="relative">
        <p class="font-mono text-xs uppercase tracking-widest ink-mute">Wardrobe</p>
        <h1 class="display mt-1 text-3xl">衣柜</h1>
        <div class="mt-3 flex items-center justify-between">
          <p class="text-sm ink-mute">
            共 <span class="font-mono font-semibold text-ink">{{ items.length }}</span> 件 · 已显示
            <span class="font-mono font-semibold text-ink">{{ visibleItems.length }}</span>
          </p>
          <button class="btn btn-ghost !rounded-full !px-3 !py-1.5 !text-xs" @click="toggleDeleteMode">
            <span>{{ showDeleteMode ? '取消' : '整理' }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Category tabs -->
    <div class="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1">
      <button
        v-for="tab in categoryTabs"
        :key="tab.key"
        type="button"
        class="chip shrink-0"
        :class="activeCategory === tab.key ? 'chip-active' : ''"
        :aria-pressed="activeCategory === tab.key"
        @click="activeCategory = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Scene filters -->
    <div v-if="sceneFilters.length > 0" class="mt-3 flex flex-wrap gap-1.5">
      <button
        type="button"
        class="chip !px-2 !py-0.5 !text-[10px]"
        :class="activeScene === null ? 'chip-active' : ''"
        :aria-pressed="activeScene === null"
        @click="activeScene = null"
      >全部场景</button>
      <button
        v-for="s in sceneFilters"
        :key="s"
        type="button"
        class="chip !px-2 !py-0.5 !text-[10px]"
        :class="activeScene === s ? 'chip-active' : ''"
        :aria-pressed="activeScene === s"
        @click="activeScene = activeScene === s ? null : s"
      >
        <span class="font-mono">#</span>{{ s }}
      </button>
    </div>

    <!-- Grid / Loading / Empty -->
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
        v-else-if="visibleItems.length === 0"
        class="glass flex flex-col items-center justify-center px-8 py-14 text-center"
      >
        <div
          class="flex h-16 w-16 items-center justify-center rounded-full"
          style="background: linear-gradient(150deg, var(--color-accent-glow), var(--color-accent-deep)); box-shadow: var(--shadow-accent-out);"
        >
          <span class="display text-2xl text-white" aria-hidden="true">◈</span>
        </div>
        <p class="display mt-4 text-lg">
          {{ items.length === 0 ? '衣柜还是空的' : '当前筛选下没有单品' }}
        </p>
        <p class="mt-1.5 text-sm ink-mute">
          {{ items.length === 0 ? '点击"上传"添加第一件' : '试试切换类目或清除筛选' }}
        </p>
        <button
          v-if="items.length === 0"
          class="btn btn-primary mt-5 !px-5 !py-2.5"
          @click="goUpload"
        >
          <span aria-hidden="true">＋</span>
          <span>上传单品</span>
        </button>
      </div>

      <!-- Grid -->
      <div
        v-else
        class="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <ItemCard
          v-for="item in visibleItems"
          :key="item.id"
          :item="item"
          :show-delete="showDeleteMode"
          @select="(it) => router.push(`/wardrobe/${it.id}`)"
          @delete="onDeleteItem"
        />
      </div>
    </div>

    <!-- Floating upload button -->
    <button
      class="btn btn-primary fixed bottom-24 right-4 z-30 !rounded-full !p-4 !px-0 !py-0"
      style="width: 56px; height: 56px;"
      aria-label="上传单品"
      @click="goUpload"
    >
      <span class="text-xl leading-none" aria-hidden="true">＋</span>
    </button>
  </div>
</template>
