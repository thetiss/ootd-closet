import { describe, expect, it, beforeEach, vi } from 'vitest';
import type {
  Category,
  Cooldown,
  Item,
  SceneTag,
  WeekSchedule,
  WeatherDay,
} from '@/types';
import {
  CATEGORY_ORDER,
  DEFAULT_SCENES,
  DEFAULT_TEMP_BANDS,
  defaultWeekSchedule,
} from '@/utils/constants';
import { recommendDay, recommendWeek, outfitItemIds } from './recommender';

let itemSeq = 0;
function makeItem(overrides: Partial<Item> & { category: Category; id?: string }): Item {
  return {
    id: overrides.id ?? `it-${++itemSeq}`,
    userId: 'local',
    scenes: [] as SceneTag[],
    tempBands: [] as number[],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    preferenceScore: 0.5,
    imageFull: new Blob(),
    imageThumb: new Blob(),
    ...overrides,
  };
}

function todayWeather(temp = 22): WeatherDay {
  return {
    date: '2026-10-16',
    tempMax: temp,
    tempMin: temp - 6,
    tempFeels: temp,
    weatherCode: 0,
    precipitation: 0,
    windSpeed: 5,
  };
}

describe('recommendDay', () => {
  beforeEach(() => {
    // 固定随机：always pick the first item
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('fills all 4 categories when all pools are non-empty', () => {
    const items = [
      makeItem({ category: 'top', scenes: ['通勤'], tempBands: [18, 25] }),
      makeItem({ category: 'bottom', scenes: ['通勤'], tempBands: [18, 25] }),
      makeItem({ category: 'shoes_bags', scenes: ['通勤'], tempBands: [18, 25] }),
      makeItem({ category: 'accessory', scenes: ['通勤'], tempBands: [18, 25] }),
    ];
    const res = recommendDay({
      items,
      cooldowns: [],
      tempBands: DEFAULT_TEMP_BANDS,
      date: '2026-10-16',
      weather: todayWeather(22),
      scene: '通勤',
    });
    expect(res.outfit.missingCategories).toEqual([]);
    expect(res.outfit.topId).toBe(items[0].id);
    expect(res.outfit.bottomId).toBe(items[1].id);
    expect(res.outfit.shoesBagsId).toBe(items[2].id);
    expect(res.outfit.accessoryId).toBe(items[3].id);
    expect(res.band).toEqual(25);
  });

  it('collects missingCategories for empty pools', () => {
    const items = [
      makeItem({ category: 'top', scenes: ['通勤'] }),
    ];
    const res = recommendDay({
      items,
      cooldowns: [],
      tempBands: DEFAULT_TEMP_BANDS,
      date: '2026-10-16',
      weather: todayWeather(22),
      scene: '通勤',
    });
    expect(res.outfit.missingCategories).toEqual(['bottom', 'shoes_bags', 'accessory']);
    expect(res.poolPerCategory.bottom).toEqual(0);
  });

  it('filters items by scene tag', () => {
    const commuting = makeItem({ category: 'top', scenes: ['通勤'] });
    const hiking = makeItem({ category: 'top', scenes: ['徒步'] });
    const res = recommendDay({
      items: [commuting, hiking],
      cooldowns: [],
      tempBands: DEFAULT_TEMP_BANDS,
      date: '2026-10-16',
      weather: todayWeather(22),
      scene: '通勤',
    });
    expect(res.outfit.topId).toBe(commuting.id);
  });

  it('treats an empty scene tag list as universal', () => {
    const universal = makeItem({ category: 'top', scenes: [] });
    const commuting = makeItem({ category: 'top', scenes: ['通勤'] });
    const res = recommendDay({
      items: [universal, commuting],
      cooldowns: [],
      tempBands: DEFAULT_TEMP_BANDS,
      date: '2026-10-16',
      weather: todayWeather(22),
      scene: '通勤',
    });
    // 两个都匹配；随机选一个（本测试固定为第 0 个）
    expect(res.outfit.topId).toBe(universal.id);
  });

  it('filters by temperature band when the item has bands set', () => {
    // temp=22 → primaryBand=25；winter 覆盖 25 档，summer 覆盖 30+ 档，只有 winter 命中
    const summer = makeItem({ category: 'top', scenes: ['通勤'], tempBands: [30, 40] });
    const winter = makeItem({ category: 'top', scenes: ['通勤'], tempBands: [18, 25] });
    const res = recommendDay({
      items: [summer, winter],
      cooldowns: [],
      tempBands: DEFAULT_TEMP_BANDS,
      date: '2026-10-16',
      weather: todayWeather(22),
      scene: '通勤',
    });
    expect(res.outfit.topId).toBe(winter.id);
  });

  it('excludes items in cooldown', () => {
    const a = makeItem({ category: 'top' });
    const b = makeItem({ category: 'top' });
    const cooldowns: Cooldown[] = [{
      itemId: a.id,
      usedAt: Date.now(),
      until: Date.now() + 86_400_000,
    }];
    const res = recommendDay({
      items: [a, b],
      cooldowns,
      tempBands: DEFAULT_TEMP_BANDS,
      date: '2026-10-16',
      weather: todayWeather(22),
      scene: '通勤',
    });
    expect(res.outfit.topId).toBe(b.id);
  });

  it('relaxes cooldown when pool has fewer than 2 items', () => {
    const a = makeItem({ category: 'top' });
    const cooldowns: Cooldown[] = [{
      itemId: a.id,
      usedAt: Date.now(),
      until: Date.now() + 86_400_000,
    }];
    const res = recommendDay({
      items: [a],
      cooldowns,
      tempBands: DEFAULT_TEMP_BANDS,
      date: '2026-10-16',
      weather: todayWeather(22),
      scene: '通勤',
    });
    // 库存不足 → 允许复用
    expect(res.outfit.topId).toBe(a.id);
  });

  it('respects excludeItemIds for "换一套"', () => {
    const a = makeItem({ category: 'top' });
    const b = makeItem({ category: 'top' });
    const res = recommendDay({
      items: [a, b],
      cooldowns: [],
      tempBands: DEFAULT_TEMP_BANDS,
      date: '2026-10-16',
      weather: todayWeather(22),
      scene: '通勤',
      excludeItemIds: new Set([a.id]),
    });
    expect(res.outfit.topId).toBe(b.id);
  });

  it('returns candidate bands from temp mapping', () => {
    const res = recommendDay({
      items: [],
      cooldowns: [],
      tempBands: DEFAULT_TEMP_BANDS,
      date: '2026-10-16',
      weather: todayWeather(22),
      scene: '通勤',
    });
    expect(res.bands).toContain(25);
    expect(res.band).toEqual(25);
  });
});

describe('outfitItemIds', () => {
  it('returns only non-null ids in canonical order', () => {
    const ids = outfitItemIds({
      topId: 't',
      bottomId: null,
      shoesBagsId: 's',
      accessoryId: 'a',
      missingCategories: [],
    });
    expect(ids).toEqual(['t', 's', 'a']);
  });

  it('returns empty array for fully missing outfit', () => {
    expect(outfitItemIds({
      topId: null,
      bottomId: null,
      shoesBagsId: null,
      accessoryId: null,
      missingCategories: [...CATEGORY_ORDER],
    })).toEqual([]);
  });
});

describe('recommendWeek', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('produces one plan per weather day', () => {
    const items = [
      makeItem({ category: 'top', scenes: DEFAULT_SCENES }),
      makeItem({ category: 'bottom', scenes: DEFAULT_SCENES }),
      makeItem({ category: 'shoes_bags', scenes: DEFAULT_SCENES }),
      makeItem({ category: 'accessory', scenes: DEFAULT_SCENES }),
    ];
    const days = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-10-${String(16 + i).padStart(2, '0')}`,
      tempMax: 22 + i,
      tempMin: 15 + i,
      tempFeels: 22 + i,
      weatherCode: 0,
      precipitation: 0,
      windSpeed: 5,
    }));
    const schedule: WeekSchedule = defaultWeekSchedule();
    const plans = recommendWeek({
      weatherDays: days,
      schedule,
      items,
      cooldowns: [],
      tempBands: DEFAULT_TEMP_BANDS,
      coolDownDays: 7,
      manualOverrides: {},
    });
    expect(plans).toHaveLength(7);
    for (const p of plans) {
      expect(p.outfit.missingCategories).toEqual([]);
      // 所有周模板场景都属于默认场景集
      expect(DEFAULT_SCENES).toContain(p.scene);
    }
  });

  it('applies per-day manual override for scene', () => {
    const items = [
      makeItem({ category: 'top', scenes: ['通勤', '徒步'] }),
      makeItem({ category: 'bottom', scenes: ['通勤', '徒步'] }),
      makeItem({ category: 'shoes_bags', scenes: ['通勤', '徒步'] }),
      makeItem({ category: 'accessory', scenes: ['通勤', '徒步'] }),
    ];
    const days = [{
      date: '2026-10-16',
      tempMax: 22,
      tempMin: 15,
      tempFeels: 22,
      weatherCode: 0,
      precipitation: 0,
      windSpeed: 5,
    }];
    const plans = recommendWeek({
      weatherDays: days,
      schedule: defaultWeekSchedule(),
      items,
      cooldowns: [],
      tempBands: DEFAULT_TEMP_BANDS,
      coolDownDays: 7,
      manualOverrides: { '2026-10-16': { scene: '徒步' } },
    });
    expect(plans[0].scene).toBe('徒步');
  });
});
