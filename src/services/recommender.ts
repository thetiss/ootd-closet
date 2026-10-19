// 推荐引擎 v1：纯规则
// 依据 implementation-plan.md §4.3
import type {
  Category,
  Cooldown,
  DayPlan,
  Item,
  Outfit,
  SceneTag,
  WeekSchedule,
  WeatherDay,
} from '@/types';
import { CATEGORY_ORDER } from '@/utils/constants';
import { mapTempToBands, primaryBand } from './temperature';

export interface RecommendContext {
  items: Item[];
  cooldowns: Cooldown[];
  tempBands: number[]; // 用户可用档位（默认 DEFAULT_TEMP_BANDS）
  date: string;
  weather: WeatherDay;
  scene: SceneTag;
  excludeItemIds?: Set<string>; // "换一套"时排除
  coolDownDays?: number;
}

export interface RecommendResult {
  outfit: Outfit;
  band: number;
  bands: number[]; // 候选档位
  poolPerCategory: Record<Category, number>; // 各候选池数量（用于降级/提示）
}

function nowMs(): number {
  return Date.now();
}

/**
 * 单日推荐：按场景 + 温度档过滤候选池 → 每类目挑一件。
 * 空池 → missingCategories；>2 空类目 → 允许 outfit 部分为空，caller 决定是否显示空态。
 */
export function recommendDay(ctx: RecommendContext): RecommendResult {
  const { items, cooldowns, tempBands, weather, scene, excludeItemIds } = ctx;
  void ctx.coolDownDays; // 冷却期写入 cooldowns 表，供 wearToday 触发；本函数只读 cooldowns
  const now = nowMs();

  // 温度档候选
  const feels = weather.tempFeels ?? weather.tempMax;
  const bands = mapTempToBands(feels, tempBands);
  const band = primaryBand(feels, tempBands);

  // 冷却中 itemId 集合
  const onCooldown = new Set<string>();
  for (const c of cooldowns) {
    if (c.until >= now) onCooldown.add(c.itemId);
  }
  // 排除项（换一套）
  const excluded = excludeItemIds ?? new Set<string>();

  // 分类目筛选候选池
  const pools: Record<Category, Item[]> = {
    top: [],
    bottom: [],
    shoes_bags: [],
    accessory: [],
  };

  for (const it of items) {
    // 类目
    if (!pools[it.category]) continue;
    // 冷却排除（accessory 也冷却）
    if (onCooldown.has(it.id)) continue;
    // 手动排除
    if (excluded.has(it.id)) continue;
    // 场景匹配
    if (it.scenes.length > 0 && !it.scenes.includes(scene)) continue;
    // 温度档匹配（未标记 = 通用）
    if (
      it.tempBands.length > 0 &&
      !it.tempBands.some((b) => bands.includes(b))
    ) {
      continue;
    }
    pools[it.category].push(it);
  }

  // 库存紧张时放宽冷却（< 3 件则允许复用，避免空态）
  const relaxedPools: Record<Category, Item[]> = {
    top: pools.top,
    bottom: pools.bottom,
    shoes_bags: pools.shoes_bags,
    accessory: pools.accessory,
  };
  for (const cat of CATEGORY_ORDER) {
    if (relaxedPools[cat].length < 2) {
      // 允许冷却中未使用的复用（保持其他过滤条件）
      const extra: Item[] = [];
      for (const it of items) {
        if (!extra.includes(it) && !pools[cat].includes(it)) {
          if (it.category !== cat) continue;
          if (excluded.has(it.id)) continue;
          if (it.scenes.length > 0 && !it.scenes.includes(scene)) continue;
          if (it.tempBands.length > 0 && !it.tempBands.some((b) => bands.includes(b))) continue;
          extra.push(it);
        }
      }
      if (extra.length > 0 && relaxedPools[cat].length === 0) {
        relaxedPools[cat] = extra;
      }
    }
  }

  // 每类目挑一件（有则随机，避免连续同一件）
  const outfit: Outfit = {
    topId: pickOne(relaxedPools.top),
    bottomId: pickOne(relaxedPools.bottom),
    shoesBagsId: pickOne(relaxedPools.shoes_bags),
    accessoryId: pickOne(relaxedPools.accessory),
    missingCategories: [] as Category[],
  };

  // 收集空池
  for (const cat of CATEGORY_ORDER) {
    const id = pickItemId(outfit, cat);
    if (!id) outfit.missingCategories.push(cat);
  }

  return {
    outfit,
    band,
    bands,
    poolPerCategory: {
      top: relaxedPools.top.length,
      bottom: relaxedPools.bottom.length,
      shoes_bags: relaxedPools.shoes_bags.length,
      accessory: relaxedPools.accessory.length,
    },
  };
}

function pickItemId(outfit: Outfit, cat: Category): string | null {
  switch (cat) {
    case 'top': return outfit.topId;
    case 'bottom': return outfit.bottomId;
    case 'shoes_bags': return outfit.shoesBagsId;
    case 'accessory': return outfit.accessoryId;
  }
}

function pickOne(pool: Item[]): string | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

/**
 * 从 Outfit 中提取使用的 itemIds（供 wearToday 触发冷却）
 */
export function outfitItemIds(outfit: Outfit): string[] {
  const ids: string[] = [];
  for (const id of [outfit.topId, outfit.bottomId, outfit.shoesBagsId, outfit.accessoryId]) {
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * 周计划生成：逐日使用 recommendDay，按周模板分配场景。
 * 同日手动覆盖 scene / temp。
 */
export function recommendWeek(opts: {
  weatherDays: WeatherDay[];
  schedule: WeekSchedule;
  items: Item[];
  cooldowns: Cooldown[];
  tempBands: number[];
  coolDownDays: number;
  manualOverrides: Record<string, { scene?: SceneTag; temp?: number }>;
  // 排除：本日已生成过 outfit 的单品（"换一套"跨日避免重复）
  recentItemIds?: Map<string, string[]>;
}): DayPlan[] {
  const { weatherDays, schedule, items, cooldowns, tempBands, coolDownDays, manualOverrides, recentItemIds } = opts;
  const plans: DayPlan[] = [];

  for (const day of weatherDays) {
    const scene = manualOverrides[day.date]?.scene ?? sceneForDate(day.date, schedule);
    const weather: WeatherDay = {
      ...day,
      tempMax: manualOverrides[day.date]?.temp ?? day.tempMax,
      tempMin: day.tempMin,
      tempFeels: manualOverrides[day.date]?.temp ?? day.tempFeels ?? day.tempMax,
    };
    const exclude = new Set<string>(recentItemIds?.get(day.date) ?? []);
    const result = recommendDay({
      items,
      cooldowns,
      tempBands,
      date: day.date,
      weather,
      scene,
      excludeItemIds: exclude,
      coolDownDays,
    });
    plans.push({
      date: day.date,
      outfit: result.outfit,
      temp: Math.round(weather.tempMax),
      band: result.band,
      scene,
      weather,
    });
  }

  return plans;
}

function sceneForDate(iso: string, s: WeekSchedule): SceneTag {
  const d = new Date(iso + 'T00:00:00+08:00').getDay(); // 0=Sun ... 6=Sat
  switch (d) {
    case 0: return s.sunday;
    case 1: return s.monday;
    case 2: return s.tuesday;
    case 3: return s.wednesday;
    case 4: return s.thursday;
    case 5: return s.friday;
    case 6: return s.saturday;
    default: return s.monday;
  }
}
