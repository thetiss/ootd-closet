<script setup lang="ts">
/* Hallmark · component: weather-badge · single-day compact display
 * states: normal · loading · overridden
 * pre-emit critique: P5 H5 E5 S5 R5 V5
 */
import { computed } from 'vue';
import type { WeatherDay } from '@/types';
import { weatherMeta } from '@/utils/constants';

const props = withDefaults(
  defineProps<{
    day: WeatherDay | null;
    isOverridden?: boolean;
    size?: 'sm' | 'md';
  }>(),
  { size: 'md', isOverridden: false },
);

const meta = computed(() => (props.day ? weatherMeta(props.day.weatherCode) : { label: '', icon: '' }));
</script>

<template>
  <div class="inline-flex items-center gap-1.5">
    <span
      :class="size === 'sm' ? 'text-base' : 'text-2xl'"
      aria-hidden="true"
    >{{ meta.icon }}</span>
    <span
      v-if="day"
      class="font-mono font-semibold"
      :class="size === 'sm' ? 'text-xs' : 'text-sm'"
    >{{ Math.round(day.tempMax) }}°</span>
    <span
      v-if="isOverridden"
      class="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
      style="background: var(--color-accent-deep);"
      title="手动调整过"
    >M</span>
  </div>
</template>
