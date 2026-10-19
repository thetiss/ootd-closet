import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { db } from '@/db';
import type { Category, Item, NewItemPayload } from '@/types';
import { DEFAULT_USER_ID } from '@/utils/constants';
import { genId } from '@/utils/id';

export const useItemsStore = defineStore('items', () => {
  const items = ref<Item[]>([]);
  const loading = ref(false);

  const count = computed(() => items.value.length);
  const grouped = computed(() => ({
    top: items.value.filter((i) => i.category === 'top'),
    bottom: items.value.filter((i) => i.category === 'bottom'),
    shoes_bags: items.value.filter((i) => i.category === 'shoes_bags'),
    accessory: items.value.filter((i) => i.category === 'accessory'),
  }));

  async function refresh() {
    loading.value = true;
    try {
      items.value = await db.items
        .where('userId')
        .equals(DEFAULT_USER_ID)
        .toArray();
    } finally {
      loading.value = false;
    }
  }

  async function addItem(payload: NewItemPayload): Promise<Item> {
    const now = Date.now();
    const item: Item = {
      id: genId(),
      userId: DEFAULT_USER_ID,
      category: payload.category,
      scenes: [...payload.scenes],
      tempBands: [...payload.tempBands],
      note: payload.note,
      createdAt: now,
      updatedAt: now,
      preferenceScore: 0,
      imageFull: payload.imageFull,
      imageThumb: payload.imageThumb,
    };
    await db.items.put(item);
    items.value = [...items.value, item];
    return item;
  }

  async function deleteItem(id: string): Promise<void> {
    await db.items.delete(id);
    items.value = items.value.filter((i) => i.id !== id);
  }

  async function markWorn(itemIds: string[]) {
    const now = Date.now();
    for (const id of itemIds) {
      const it = items.value.find((i) => i.id === id);
      if (!it) continue;
      it.lastUsedAt = now;
      it.updatedAt = now;
      await db.items.put(it);
    }
  }

  function byCategory(category: Category): Item[] {
    return items.value.filter((i) => i.category === category);
  }

  return {
    items,
    loading,
    count,
    grouped,
    refresh,
    addItem,
    deleteItem,
    markWorn,
    byCategory,
  };
});
