import type { Category, SceneTag, WeekSchedule, Settings } from '@/types';

export const DEFAULT_USER_ID = 'local';

export const DEFAULT_TEMP_BANDS = [0, 18, 25, 30, 40];

export const DEFAULT_SCENES: SceneTag[] = ['通勤', '徒步', '约会', '健身', '散步'];

// 天气场景池：与 WEATHER_CODES 匹配的天气状况可映射到的场景候选
export const WEATHER_SCENES: SceneTag[] = ['通勤', '徒步', '约会', '健身', '散步', '日常'];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: '上装',
  bottom: '下装',
  shoes_bags: '鞋包',
  accessory: '配饰',
};

export const CATEGORY_ORDER: Category[] = ['top', 'bottom', 'shoes_bags', 'accessory'];

export const CATEGORY_ICONS: Record<Category, string> = {
  top: '👕',
  bottom: '👖',
  shoes_bags: '👟',
  accessory: '🎒',
};

// Open-Meteo WMO 代码 → 中文描述 & 图标
export const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: '晴', icon: '☀️' },
  1: { label: '大部晴', icon: '🌤️' },
  2: { label: '多云', icon: '⛅' },
  3: { label: '阴', icon: '☁️' },
  45: { label: '雾', icon: '🌫️' },
  48: { label: '雾凇', icon: '🌫️' },
  51: { label: '小毛毛雨', icon: '🌦️' },
  53: { label: '毛毛雨', icon: '🌦️' },
  55: { label: '大毛毛雨', icon: '🌧️' },
  61: { label: '小雨', icon: '🌦️' },
  63: { label: '中雨', icon: '🌧️' },
  65: { label: '大雨', icon: '🌧️' },
  71: { label: '小雪', icon: '🌨️' },
  73: { label: '中雪', icon: '🌨️' },
  75: { label: '大雪', icon: '❄️' },
  80: { label: '阵雨', icon: '🌦️' },
  81: { label: '阵雨', icon: '🌧️' },
  82: { label: '强阵雨', icon: '🌧️' },
  95: { label: '雷雨', icon: '⛈️' },
  96: { label: '雷雨+小冰雹', icon: '⛈️' },
  99: { label: '雷雨+大冰雹', icon: '⛈️' },
};

export function weatherMeta(code: number): { label: string; icon: string } {
  return WEATHER_CODES[code] ?? { label: '未知', icon: '❓' };
}

// 默认周模板：工作日通勤，周六公园散步，周日徒步
export function defaultWeekSchedule(): WeekSchedule {
  return {
    id: DEFAULT_USER_ID,
    monday: '通勤',
    tuesday: '通勤',
    wednesday: '通勤',
    thursday: '通勤',
    friday: '通勤',
    saturday: '散步',
    sunday: '徒步',
  };
}

// 默认设置
export function defaultSettings(): Settings {
  return {
    id: DEFAULT_USER_ID,
    city: { lat: 31.2304, lon: 121.4737, name: '上海（默认）' },
    customTempBands: [],
    customScenes: [],
    coolDownDays: 7,
  };
}
