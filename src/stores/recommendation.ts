import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { db } from '@/db';
import type {
  Category,
  Cooldown,
  DayPlan,
  Look,
  Outfit,
  SceneTag,
  WeatherDay,
} from '@/types';
import { DEFAULT_USER_ID, DEFAULT_TEMP_BANDS } from '@/utils/constants';
import { genId } from '@/utils/id';
import {
  outfitItemIds,
  recommendDay,
  recommendWeek,
} from '@/services/recommender';
import { useItemsStore } from './items';
import { useSettingsStore } from './settings';
import { useWeatherStore } from './weather';

/** 手动覆盖结构：某日 → { scene?, temp? } */
export type ManualOverride = { scene?: SceneTag; temp?: number };

/**
 * 推荐状态 store。
 * - weekPlan 是"生成后"的结果，用户可 wearToday / regenerate / changeScene / replaceItem 修改
 * - 所有修改保持本地内存 + Dexie（DayPlans 目前不持久化，重新生成即可）
 * - 与 looks 打通：saveLookFromRecommendation
 */
export const useRecommendationStore = defineStore('recommendation', () => {
  const weekPlan = ref<DayPlan[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentDayIndex = ref<number>(0);
  // 手动覆盖：某日的场景（跨天持久化到 localStorage，避免刷新丢失用户操作）
  const sceneOverrides = ref<Record<string, SceneTag>>(loadSceneOverrides());
  // "换一套" 时排除的单品：某日 → 排除 itemId 列表
  const excludedByDate = ref<Record<string, string[]>>({});

  const itemsStore = useItemsStore();
  const settingsStore = useSettingsStore();
  const weatherStore = useWeatherStore();

  const todayPlan = computed<DayPlan | null>(() => {
    const t = new Date();
    const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    return weekPlan.value.find((p) => p.date === iso) ?? weekPlan.value[0] ?? null;
  });

  const planCount = computed(() => weekPlan.value.length);
  const overallMissing = computed<Category[]>(() => {
    const set = new Set<Category>();
    for (const p of weekPlan.value) for (const c of p.outfit.missingCategories) set.add(c);
    return [...set];
  });

  async function ensureDeps() {
    await Promise.all([
      itemsStore.refresh(),
      settingsStore.load(),
    ]);
    const wd = weatherStore.days;
    if (!wd || wd.length === 0) {
      await weatherStore.refresh();
    }
  }

  async function generateWeekPlan() {
    loading.value = true;
    error.value = null;
    try {
      await ensureDeps();
      const cooldowns = await loadCooldowns();
      const recentItemIds = new Map<string, string[]>();
      for (const [d, ids] of Object.entries(excludedByDate.value)) {
        recentItemIds.set(d, ids);
      }

      const rawDays = weatherStore.days;
      // 合并温度 override
      const weatherDays: WeatherDay[] = rawDays.map((d) => {
        const w = weatherStore.getWeatherForDate(d.date);
        return w ?? d;
      });
      const overrides: Record<string, ManualOverride> = {};
      for (const p of rawDays) {
        const w = weatherStore.getWeatherForDate(p.date);
        if (weatherStore.isOverridden(p.date) && w) {
          overrides[p.date] = { temp: w.tempMax };
        }
        if (sceneOverrides.value[p.date]) {
          overrides[p.date] = { ...overrides[p.date], scene: sceneOverrides.value[p.date] };
        }
      }

      const plans = recommendWeek({
        weatherDays,
        schedule: settingsStore.schedule,
        items: itemsStore.items,
        cooldowns,
        tempBands: settingsStore.allTempBands.length > 0 ? settingsStore.allTempBands : DEFAULT_TEMP_BANDS,
        coolDownDays: settingsStore.settings.coolDownDays,
        manualOverrides: overrides,
        recentItemIds,
      });
      weekPlan.value = plans;
      // 定位到"今天"
      currentDayIndex.value = Math.max(
        0,
        plans.findIndex((p) => p.date === todayIso()),
      );
    } catch (err) {
      error.value = err instanceof Error ? err.message : '推荐生成失败';
    } finally {
      loading.value = false;
    }
  }

  async function regenerateDay(index: number) {
    if (!weekPlan.value[index]) return;
    const plan = weekPlan.value[index];
    // 把当前 outfit 的 items 加入排除
    const prevIds = outfitItemIds(plan.outfit);
    const prev = excludedByDate.value[plan.date] ?? [];
    excludedByDate.value[plan.date] = [...new Set([...prev, ...prevIds])];
    await refreshDayPlan(index);
  }

  async function changeScene(index: number, scene: SceneTag) {
    if (!weekPlan.value[index]) return;
    sceneOverrides.value[weekPlan.value[index].date] = scene;
    persistSceneOverrides();
    await refreshDayPlan(index);
  }

  async function replaceItem(index: number, category: Category, newItemId: string) {
    if (!weekPlan.value[index]) return;
    const plan = weekPlan.value[index];
    const outfit: Outfit = { ...plan.outfit };
    let prev: string | null = null;
    switch (category) {
      case 'top': prev = outfit.topId; outfit.topId = newItemId; break;
      case 'bottom': prev = outfit.bottomId; outfit.bottomId = newItemId; break;
      case 'shoes_bags': prev = outfit.shoesBagsId; outfit.shoesBagsId = newItemId; break;
      case 'accessory': prev = outfit.accessoryId; outfit.accessoryId = newItemId; break;
    }
    // 将旧单品加入排除，避免立刻被再选中
    if (prev) {
      const prevList = excludedByDate.value[plan.date] ?? [];
      excludedByDate.value[plan.date] = [...new Set([...prevList, prev])];
    }
    outfit.missingCategories = computeMissing(outfit);
    weekPlan.value[index] = { ...plan, outfit };
  }

  async function wearToday(index: number) {
    if (!weekPlan.value[index]) return;
    const plan = weekPlan.value[index];
    const ids = outfitItemIds(plan.outfit);
    if (ids.length === 0) return;
    const coolDownDays = settingsStore.settings.coolDownDays || 7;
    const until = Date.now() + coolDownDays * 24 * 3600 * 1000;
    // 写入 cooldowns 表（覆盖旧的同一 itemId 记录）
    for (const id of ids) {
      await db.cooldowns.put({
        itemId: id,
        usedAt: Date.now(),
        until,
      });
    }
    await itemsStore.markWorn(ids);
    // 标记已穿
    weekPlan.value[index] = { ...plan, usedToday: true };
  }

  async function overrideTemp(date: string, temp: number | null) {
    weatherStore.overrideTemp(date, temp);
    const idx = weekPlan.value.findIndex((p) => p.date === date);
    if (idx >= 0) await refreshDayPlan(idx);
  }

  async function saveLookFromPlan(index: number, name?: string): Promise<Look | null> {
    if (!weekPlan.value[index]) return null;
    const plan = weekPlan.value[index];
    const look: Look = {
      id: genId(),
      userId: DEFAULT_USER_ID,
      name: name ?? `${plan.scene} · ${plan.date}`,
      scene: plan.scene,
      tempBand: plan.band,
      items: [
        { category: 'top', itemId: plan.outfit.topId },
        { category: 'bottom', itemId: plan.outfit.bottomId },
        { category: 'shoes_bags', itemId: plan.outfit.shoesBagsId },
        { category: 'accessory', itemId: plan.outfit.accessoryId },
      ],
      createdAt: Date.now(),
      source: 'recommendation',
    };
    await db.looks.put(look);
    return look;
  }

  // ---- helpers ----

  async function refreshDayPlan(index: number) {
    if (!weekPlan.value[index]) return;
    await ensureDeps();
    const cooldowns = await loadCooldowns();
    const plan = weekPlan.value[index];
    const exclude = new Set<string>(excludedByDate.value[plan.date] ?? []);
    // 场景优先取 override，否则用当前 plan.scene
    const scene = sceneOverrides.value[plan.date] ?? plan.scene;
    const result = recommendDay({
      items: itemsStore.items,
      cooldowns,
      tempBands: settingsStore.allTempBands.length > 0 ? settingsStore.allTempBands : DEFAULT_TEMP_BANDS,
      date: plan.date,
      weather: plan.weather,
      scene,
      excludeItemIds: exclude,
      coolDownDays: settingsStore.settings.coolDownDays,
    });
    weekPlan.value[index] = {
      ...plan,
      outfit: result.outfit,
      band: result.band,
      scene,
      usedToday: plan.usedToday, // 保留已穿标记
    };
  }

  function computeMissing(outfit: Outfit): Category[] {
    const missing: Category[] = [];
    if (!outfit.topId) missing.push('top');
    if (!outfit.bottomId) missing.push('bottom');
    if (!outfit.shoesBagsId) missing.push('shoes_bags');
    if (!outfit.accessoryId) missing.push('accessory');
    return missing;
  }

  async function loadCooldowns(): Promise<Cooldown[]> {
    return db.cooldowns.toArray();
  }

  function todayIso(): string {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }

  // ---- scene overrides persistence ----
  const SCENE_KEY = 'ootd.sceneOverrides';
  function loadSceneOverrides(): Record<string, SceneTag> {
    try {
      const raw = localStorage.getItem(SCENE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, SceneTag>) : {};
    } catch {
      return {};
    }
  }
  function persistSceneOverrides() {
    localStorage.setItem(SCENE_KEY, JSON.stringify(sceneOverrides.value));
  }

  function clearAll() {
    weekPlan.value = [];
    excludedByDate.value = {};
    currentDayIndex.value = 0;
  }

  return {
    weekPlan,
    loading,
    error,
    currentDayIndex,
    sceneOverrides,
    excludedByDate,
    todayPlan,
    planCount,
    overallMissing,
    generateWeekPlan,
    regenerateDay,
    changeScene,
    replaceItem,
    wearToday,
    overrideTemp,
    saveLookFromPlan,
    clearAll,
  };
});
