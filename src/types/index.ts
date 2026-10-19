// 全局类型定义

export type Category = 'top' | 'bottom' | 'shoes_bags' | 'accessory';

// 场景标签：字符串类型，具体值由 DEFAULT_SCENES + 用户自定义 决定
export type SceneTag = string;

export interface Item {
  id: string;
  userId: string;
  category: Category;
  scenes: SceneTag[];
  tempBands: number[];
  note?: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  preferenceScore: number;
  aiTags?: Record<string, unknown>;
  imageFull: Blob;
  imageThumb: Blob;
}

export type NewItemPayload = Omit<
  Item,
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'preferenceScore' | 'lastUsedAt' | 'aiTags'
>;

export interface Look {
  id: string;
  userId: string;
  name?: string;
  scene: SceneTag | null;
  tempBand: number | null;
  items: { category: Category; itemId: string | null }[];
  createdAt: number;
  source: 'recommendation' | 'manual';
}

export interface Cooldown {
  itemId: string;
  usedAt: number;
  until: number;
}

export interface WeekSchedule {
  id: string;
  monday: SceneTag;
  tuesday: SceneTag;
  wednesday: SceneTag;
  thursday: SceneTag;
  friday: SceneTag;
  saturday: SceneTag;
  sunday: SceneTag;
}

export interface Settings {
  id: string;
  city: { lat: number; lon: number; name: string };
  customTempBands: number[];
  customScenes: string[];
  coolDownDays: number;
}

export interface WeatherDay {
  date: string;
  tempMax: number;
  tempMin: number;
  tempFeels: number;
  weatherCode: number;
  precipitation: number;
  windSpeed: number;
}

export interface Outfit {
  topId: string | null;
  bottomId: string | null;
  shoesBagsId: string | null;
  accessoryId: string | null;
  missingCategories: Category[];
}

export interface DayPlan {
  date: string;
  outfit: Outfit;
  temp: number;
  band: number;
  scene: SceneTag;
  weather: WeatherDay;
  usedToday?: boolean;
}
