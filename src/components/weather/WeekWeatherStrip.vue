<script setup lang="ts">
/* Hallmark · component: week-weather-strip · horizontal 7-day forecast
 * states: normal · loading · error
 * pre-emit critique: P5 H5 E5 S5 R5 V5
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useWeatherStore } from '@/stores/weather';
import { useSettingsStore } from '@/stores/settings';
import type { SceneTag } from '@/types';
import dayjs from 'dayjs';
import { formatWeekday } from '@/utils/format';
import { weatherMeta } from '@/utils/constants';

const weatherStore = useWeatherStore();
const settingsStore = useSettingsStore();
const { days, loading, error } = storeToRefs(weatherStore);

function scheduleFor(iso: string, s: typeof settingsStore): SceneTag {
  const dow = dayjs(iso).day(); // 0=Sun, 1=Mon ...
  const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const val = s.schedule[keys[dow]];
  return (val as SceneTag) ?? '通勤';
}

function highlightStyle(highlight: boolean): Record<string, string> {
  if (!highlight) return {};
  return {
    background: 'linear-gradient(150deg, var(--color-primary-glow), var(--color-primary-deep))',
    color: 'white',
    boxShadow: 'var(--shadow-primary-out)',
  };
}

function sceneStyle(highlight: boolean): Record<string, string> {
  if (highlight) return { background: 'rgba(255,255,255,0.18)', color: 'white' };
  return { background: 'var(--color-paper-deep)', color: 'var(--color-ink-mute)' };
}

const entries = computed(() => {
  if (days.value.length === 0) return [];
  return days.value.map((d, i) => ({
    index: i,
    date: d.date,
    weekday: formatWeekday(d.date),
    label: i === 0 ? '今天' : `D+${i}`,
    highlight: i === 0,
    tempMax: Math.round(d.tempMax),
    tempMin: Math.round(d.tempMin),
    meta: weatherMeta(d.weatherCode),
    isOverridden: weatherStore.isOverridden(d.date),
    scene: scheduleFor(d.date, settingsStore),
  }));
});

const refreshNow = () => weatherStore.refresh(true);
</script>

<template>
  <div class="relative">
    <!-- Loading -->
    <div v-if="loading && days.length === 0" class="grid grid-cols-7 gap-1.5">
      <div
        v-for="i in 7"
        :key="i"
        class="neu-in-soft h-[104px] animate-pulse"
      ></div>
    </div>

    <!-- Error with retry -->
    <div v-else-if="error && days.length === 0" class="glass px-4 py-3 text-center">
      <p class="text-xs ink-mute">天气数据加载失败</p>
      <button
        class="btn btn-ghost !rounded-full !px-3 !py-1 !text-xs mt-1"
        @click="refreshNow"
      >
        <span>重试</span>
      </button>
    </div>

    <!-- Data -->
    <div v-else class="grid grid-cols-7 gap-1.5">
      <div
        v-for="e in entries"
        :key="e.date"
        class="relative flex flex-col items-center justify-between px-1 py-3"
        :class="e.highlight ? 'rounded-2xl' : 'neu-in-soft'"
        :style="highlightStyle(e.highlight)"
      >
        <span
          v-if="e.highlight"
          class="absolute -top-2 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-widest"
          style="background: linear-gradient(120deg, var(--color-accent-glow), var(--color-accent-deep)); color: white; box-shadow: var(--shadow-accent-out);"
        >TODAY</span>

        <span class="text-[10px] font-semibold tracking-wider" :class="e.highlight ? 'text-white/80' : 'ink-mute'">
          {{ e.weekday }}
        </span>

        <span
          class="my-1 text-2xl leading-none"
          aria-hidden="true"
        >{{ e.meta.icon }}</span>

        <span class="font-mono text-[11px] font-semibold" :class="e.highlight ? 'text-white' : 'text-ink'">
          {{ e.tempMax }}°
        </span>
        <span class="font-mono text-[9px]" :class="e.highlight ? 'text-white/60' : 'ink-mute'">
          / {{ e.tempMin }}°
        </span>

        <span
          class="mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
          :style="sceneStyle(e.highlight)"
        >#{{ e.scene }}</span>
      </div>
    </div>
  </div>
</template>
