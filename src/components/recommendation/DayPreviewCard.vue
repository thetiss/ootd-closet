<script setup lang="ts">
/* Hallmark · component: day-preview-card · 本周推荐横向条里的单日预览卡
 * 用 compositeOutfitImage 把 4 件套合成为一张成套效果图，头部显示日期/场景标签，底部天气。
 * 点击卡片触发 preview-day，由父组件展开完整 DayCard 详情。
 * states: today · past · incomplete（缺单品）· loading（合成中）
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import dayjs from 'dayjs';
import type { DayPlan, Item } from '@/types';
import { weatherMeta } from '@/utils/constants';
import { composeOutfitFlat } from '@/services/image';

const props = defineProps<{
  plan: DayPlan;
  items: Item[];
  index: number;
}>();

const emit = defineEmits<{
  previewDay: [index: number];
}>();

const today = dayjs().format('YYYY-MM-DD');
const isToday = computed(() => props.plan.date === today);
const isPast = computed(() => dayjs(props.plan.date).isBefore(dayjs(), 'day'));

const weekday = computed(() => {
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  return labels[dayjs(props.plan.date).day()];
});
const dateLabel = computed(() => dayjs(props.plan.date).format('M/D'));
const weatherIcon = computed(() => weatherMeta(props.plan.weather.weatherCode).icon);
const tempDisplay = computed(() => `${props.plan.weather.tempMax}°`);
const isComplete = computed(() => props.plan.outfit.missingCategories.length === 0);

// 4 件套键位（顺序 top / bottom / shoes_bags / accessory）
const SLOT_KEYS = ['topId', 'bottomId', 'shoesBagsId', 'accessoryId'] as const;

function itemFor(key: (typeof SLOT_KEYS)[number]): Item | null {
  const id = props.plan.outfit[key];
  if (!id) return null;
  return props.items.find((i) => i.id === id) ?? null;
}

// 成套效果图：Canvas 合成 4 件套 → 单张扁平铺陈图（无分类标签、无分隔线）
const compositeUrl = ref<string>('');
let compositeHandle = '';
const composing = ref(false);
const anyItem = computed(() => SLOT_KEYS.some((k) => itemFor(k) !== null));

async function rebuildComposite() {
  composing.value = true;
  try {
    const slots = SLOT_KEYS.map((k) => {
      const it = itemFor(k);
      return { blob: it?.imageThumb ?? null, label: '', icon: '' };
    });
    const blob = await composeOutfitFlat(slots, { size: 560, quality: 0.78 });
    if (compositeHandle) URL.revokeObjectURL(compositeHandle);
    compositeHandle = URL.createObjectURL(blob);
    compositeUrl.value = compositeHandle;
  } catch {
    compositeUrl.value = '';
  } finally {
    composing.value = false;
  }
}

// 触发 key：outfit 4 个 slot id 或 items 数量变化
const compositeKey = computed(() => {
  const o = props.plan.outfit;
  return [o.topId ?? '', o.bottomId ?? '', o.shoesBagsId ?? '', o.accessoryId ?? '', props.items.length].join('|');
});

watch(compositeKey, rebuildComposite, { immediate: true });

onBeforeUnmount(() => {
  if (compositeHandle) URL.revokeObjectURL(compositeHandle);
});

function onClick() {
  emit('previewDay', props.index);
}

const statusClass = computed(() => {
  if (isToday.value) return 'shadow-[0_0_0_2px_var(--color-accent)]';
  if (isPast.value) return 'opacity-55';
  return '';
});

const todayBadge = computed(() => {
  if (isToday.value) return { text: '今天', cls: 'chip-active !px-1.5 !py-0 !text-[9px]' };
  if (props.plan.usedToday) return { text: '已穿', cls: 'chip !px-1.5 !py-0 !text-[9px]' };
  return null;
});
</script>

<template>
  <button
    type="button"
    class="neu-out glass w-[248px] shrink-0 snap-start p-3 text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-accent)]"
    :class="statusClass"
    :aria-label="`${dateLabel} ${weekday} · ${plan.scene || '未定场景'} 的穿搭预览`"
    @click="onClick"
  >
    <!-- Header: 日期 + 今天/已穿 徽章 -->
    <header class="mb-2 flex items-center justify-between gap-1">
      <div class="flex items-baseline gap-1">
        <span class="display text-base leading-none">{{ dateLabel }}</span>
        <span class="text-xs ink-mute font-semibold">{{ weekday }}</span>
      </div>
      <span v-if="todayBadge" :class="todayBadge.cls">{{ todayBadge.text }}</span>
    </header>

    <!-- 场景标签 -->
    <div class="mb-2">
      <span
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style="background: color-mix(in oklch, var(--color-primary) 12%, transparent); color: var(--color-primary-deep);"
      >
        <span class="font-mono">#</span>
        <span>{{ plan.scene || '未定场景' }}</span>
      </span>
    </div>

    <!-- 成套效果图（单张合成图） -->
    <div
      class="overflow-hidden rounded-lg"
      style="aspect-ratio: 1 / 1; background: var(--color-paper);"
    >
      <img
        v-if="compositeUrl"
        :src="compositeUrl"
        :alt="`${dateLabel} 的成套搭配效果图`"
        class="h-full w-full object-cover"
      />
      <div
        v-else-if="composing"
        class="flex h-full w-full items-center justify-center text-xs ink-mute"
      >
        <span class="animate-pulse">生成中…</span>
      </div>
      <div
        v-else
        class="flex h-full w-full items-center justify-center text-xs ink-mute"
      >
        <span>{{ anyItem ? '生成失败' : '暂无搭配' }}</span>
      </div>
    </div>

    <!-- 天气 + 完整度 -->
    <footer class="mt-2 flex items-center justify-between text-[11px] ink-mute">
      <span class="font-mono">
        <span aria-hidden="true">{{ weatherIcon }}</span>
        <span class="ml-1">{{ tempDisplay }}</span>
      </span>
      <span v-if="!isComplete" class="text-warn">
        缺 {{ plan.outfit.missingCategories.length }} 件
      </span>
      <span v-else class="font-mono opacity-70">4/4</span>
    </footer>
  </button>
</template>
