import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { WeatherDay } from '@/types';
import { fetchWeekWeatherCached } from '@/services/weather';
import { useSettingsStore } from '@/stores/settings';

// City 结构复用 Settings.city
type CityInfo = { lat: number; lon: number; name: string };

const DEFAULT_CITY: CityInfo = { lat: 31.2304, lon: 121.4737, name: '上海' };

export const useWeatherStore = defineStore('weather', () => {
  const city = ref<CityInfo>({ ...DEFAULT_CITY });
  const days = ref<WeatherDay[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const geoState = ref<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown');
  const lastFetchedAt = ref<number | null>(null);
  // 手动覆盖某日气温（date → temp）
  const manualOverrides = ref<Record<string, number>>({});
  // 防止并发 refresh
  let inflightRefresh: Promise<void> | null = null;

  const today = computed<WeatherDay | null>(() => {
    const t = new Date();
    const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    return days.value.find((d) => d.date === iso) ?? days.value[0] ?? null;
  });

  async function initLocation() {
    const settingsStore = useSettingsStore();
    // 1. 从 settings 加载已保存的 city（默认上海）
    await settingsStore.load();
    city.value = { ...settingsStore.settings.city };

    // 2. 立即用当前 city 拉天气（默认上海），不阻塞用户
    void refresh();

    // 3. 浏览器支持定位才尝试升级城市；不支持 / 拒绝都保留当前 city
    if (!('geolocation' in navigator)) {
      geoState.value = 'unsupported';
      return;
    }
    geoState.value = 'unknown';
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // 用逆地理坐标拿到城市名（best-effort）
        const name = await lookupCityName(latitude, longitude).catch(() => null);
        const newCity: CityInfo = {
          lat: latitude,
          lon: longitude,
          name: name ?? `${latitude.toFixed(1)}°N ${longitude.toFixed(1)}°E`,
        };
        if (newCity.lat !== city.value.lat || newCity.lon !== city.value.lon) {
          city.value = newCity;
          await settingsStore.saveSettings({ city: newCity });
        }
        geoState.value = 'granted';
        await refresh();
      },
      () => {
        geoState.value = 'denied';
        // 保持 city 为默认/用户上次保存的城市，不主动刷（refresh 已在步骤 2 触发）
      },
      { timeout: 5000, maximumAge: 60 * 60 * 1000 },
    );
  }

  async function refresh(forceRefresh = false) {
    if (inflightRefresh) return inflightRefresh;
    loading.value = true;
    inflightRefresh = (async () => {
      try {
        const { days: fetched } = await fetchWeekWeatherCached(
          city.value.lat,
          city.value.lon,
          forceRefresh,
        );
        days.value = fetched;
        lastFetchedAt.value = Date.now();
        // 有新数据了，清掉错误提示
        if (fetched.length > 0) error.value = null;
      } catch (err) {
        error.value = err instanceof Error ? err.message : '天气获取失败';
      } finally {
        loading.value = false;
        inflightRefresh = null;
      }
    })();
    return inflightRefresh;
  }

  async function setCity(newCity: CityInfo) {
    city.value = newCity;
    const settingsStore = useSettingsStore();
    await settingsStore.saveSettings({ city: newCity });
    await refresh(true);
  }

  function overrideTemp(date: string, temp: number | null) {
    if (temp === null) {
      delete manualOverrides.value[date];
    } else {
      manualOverrides.value[date] = temp;
    }
  }

  function getWeatherForDate(date: string): WeatherDay | null {
    const d = days.value.find((x) => x.date === date);
    if (!d) return null;
    const override = manualOverrides.value[date];
    if (override === undefined) return d;
    return {
      ...d,
      tempMax: override,
      tempMin: Math.round(override - 5),
      tempFeels: override,
    };
  }

  function isOverridden(date: string): boolean {
    return date in manualOverrides.value;
  }

  return {
    city,
    days,
    loading,
    error,
    geoState,
    lastFetchedAt,
    today,
    initLocation,
    refresh,
    setCity,
    overrideTemp,
    getWeatherForDate,
    isOverridden,
  };
});

// 逆地理坐标拿城市名（Open-Meteo 无此接口，用免费的 Nominatim，可能受 CORS 影响则降级）
async function lookupCityName(lat: number, lon: number): Promise<string | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('format', 'json');
    url.searchParams.set('zoom', '10');
    url.searchParams.set('addressdetails', '1');
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: { city?: string; town?: string; county?: string; state?: string };
      name?: string;
    };
    return (
      data.address?.city ??
      data.address?.town ??
      data.address?.county ??
      data.address?.state ??
      data.name ??
      null
    );
  } catch {
    return null;
  }
}

// 保持类型导出一致性
export type { CityInfo };
