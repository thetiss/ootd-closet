import type { WeatherDay } from '@/types';

const CACHE_KEY = 'ootd.weatherCache';
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

export async function fetchWeekWeatherCached(
  lat: number,
  lon: number,
  forceRefresh = false,
): Promise<{ days: WeatherDay[]; fromCache: boolean }> {
  const cache = readCache();
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { days: cache.days, fromCache: true };
  }
  const days = await fetchWeekWeather(lat, lon);
  writeCache({ days, fetchedAt: Date.now() });
  return { days, fromCache: false };
}

function readCache(): CachedWeather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedWeather) : null;
  } catch {
    return null;
  }
}

function writeCache(payload: CachedWeather): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
}

export function clearWeatherCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
