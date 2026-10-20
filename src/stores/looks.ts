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

  async function updateLook(
    id: string,
    patch: Partial<Omit<Look, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<Look> {
    const existing = looks.value.find((l) => l.id === id);
    if (!existing) throw new Error('Look 不存在或已删除');
    const updated: Look = { ...existing, ...patch, id: existing.id, userId: existing.userId, createdAt: existing.createdAt };
    await db.looks.put(updated);
    const idx = looks.value.findIndex((l) => l.id === id);
    if (idx >= 0) looks.value[idx] = updated;
    return updated;
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
