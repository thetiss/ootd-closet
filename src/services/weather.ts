import type { WeatherDay } from '@/types';

const CACHE_PREFIX = 'ootd.weatherCache.v2:';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 小时

interface CachedWeather {
  days: WeatherDay[];
  fetchedAt: number;
}

interface OpenMeteoDailyResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    temperature_2m_apparent_max: number[];
    precipitation_sum: number[];
    wind_speed_10m_max: number[];
    weather_code: number[];
  };
}

// Open-Meteo 免费 API，无需 key
export async function fetchWeekWeather(
  lat: number,
  lon: number,
): Promise<WeatherDay[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  const dailyParams =
    'temperature_2m_max,temperature_2m_min,temperature_2m_apparent_max,precipitation_sum,wind_speed_10m_max,weather_code';
  url.searchParams.set('daily', dailyParams);
  url.searchParams.set('timezone', 'Asia/Shanghai');
  url.searchParams.set('forecast_days', '7');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Weather API failed: ${res.status}`);
  const data = (await res.json()) as OpenMeteoDailyResponse;

  const days: WeatherDay[] = [];
  for (let i = 0; i < data.daily.time.length; i++) {
    days.push({
      date: data.daily.time[i],
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      tempFeels: data.daily.temperature_2m_apparent_max[i],
      weatherCode: data.daily.weather_code[i],
      precipitation: data.daily.precipitation_sum[i],
      windSpeed: data.daily.wind_speed_10m_max[i],
    });
  }
  return days;
}

// Cache 按坐标分片（避免切换城市后仍读到旧城市数据）
function cacheKeyFor(lat: number, lon: number): string {
  return `${CACHE_PREFIX}${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function readCache(lat: number, lon: number): CachedWeather | null {
  try {
    const raw = localStorage.getItem(cacheKeyFor(lat, lon));
    return raw ? (JSON.parse(raw) as CachedWeather) : null;
  } catch {
    return null;
  }
}

function writeCache(lat: number, lon: number, payload: CachedWeather): void {
  localStorage.setItem(cacheKeyFor(lat, lon), JSON.stringify(payload));
}

export async function fetchWeekWeatherCached(
  lat: number,
  lon: number,
  forceRefresh = false,
): Promise<{ days: WeatherDay[]; fromCache: boolean; stale: boolean }> {
  const cache = readCache(lat, lon);
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { days: cache.days, fromCache: true, stale: false };
  }
  try {
    const days = await fetchWeekWeather(lat, lon);
    writeCache(lat, lon, { days, fetchedAt: Date.now() });
    return { days, fromCache: false, stale: false };
  } catch (err) {
    // 网络/API 失败时回退到旧缓存（即使过期），保证 UI 有数据
    if (cache && cache.days.length > 0) {
      return { days: cache.days, fromCache: true, stale: true };
    }
    throw err;
  }
}

export function clearWeatherCache(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  // 兼容旧 key（v1）
  localStorage.removeItem('ootd.weatherCache');
}
