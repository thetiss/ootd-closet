import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { db } from '@/db';
import type { Look } from '@/types';
import { DEFAULT_USER_ID } from '@/utils/constants';
import { genId } from '@/utils/id';

export const useLooksStore = defineStore('looks', () => {
  const looks = ref<Look[]>([]);
  const loading = ref(false);

  const count = computed(() => looks.value.length);
  const recLooks = computed(() => looks.value.filter((l) => l.source === 'recommendation'));
  const manualLooks = computed(() => looks.value.filter((l) => l.source === 'manual'));

  async function refresh() {
    loading.value = true;
    try {
      looks.value = await db.looks
        .where('userId')
        .equals(DEFAULT_USER_ID)
        .toArray();
      // 时间倒序
      looks.value.sort((a, b) => b.createdAt - a.createdAt);
    } finally {
      loading.value = false;
    }
  }

  async function createLook(payload: Omit<Look, 'id' | 'createdAt' | 'userId'>): Promise<Look> {
    const look: Look = {
      ...payload,
      id: genId(),
      userId: DEFAULT_USER_ID,
      createdAt: Date.now(),
    };
    await db.looks.put(look);
    looks.value = [look, ...looks.value];
    return look;
  }

  async function deleteLook(id: string): Promise<void> {
    await db.looks.delete(id);
    looks.value = looks.value.filter((l) => l.id !== id);
  }

  async function updateLook(id: string, patch: Partial<Omit<Look, 'id' | 'userId'>>): Promise<void> {
    const idx = looks.value.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const updated: Look = { ...looks.value[idx], ...patch };
    looks.value[idx] = updated;
    await db.looks.put(updated);
  }

  return {
    looks,
    loading,
    count,
    recLooks,
    manualLooks,
    refresh,
    createLook,
    deleteLook,
    updateLook,
  };
});
