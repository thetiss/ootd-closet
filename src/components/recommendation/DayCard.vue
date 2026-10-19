<script setup lang="ts">
/* Hallmark · component: day-card · the core recommendation unit
 * states: today · today-worn · future · past · empty
 * pre-emit critique: P5 H4 E5 S5 R5 V5
 */
import { computed, ref } from 'vue';
import dayjs from 'dayjs';
import type { Category, DayPlan, Item, SceneTag } from '@/types';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { WEATHER_SCENES, CATEGORY_LABELS, weatherMeta } from '@/utils/constants';
import { mapTempToBands } from '@/services/temperature';
import OutfitSlot from './OutfitSlot.vue';
import ScenePicker from './ScenePicker.vue';
import ItemReplacePicker from './ItemReplacePicker.vue';

const props = defineProps<{
  plan: DayPlan;
  index: number;
}>();

const emit = defineEmits<{
  regenerate: [index: number];
  wear: [index: number];
  changeScene: [index: number, scene: SceneTag];
  replaceItem: [index: number, category: Category, itemId: string];
  saveLook: [index: number];
  goToUpload: [];
  goToWardrobe: [];
}>();

const itemsStore = useItemsStore();
const settingsStore = useSettingsStore();

const today = dayjs().format('YYYY-MM-DD');
const isToday = computed(() => props.plan.date === today);
const isFuture = computed(() => dayjs(props.plan.date).isAfter(dayjs(), 'day'));
const isPast = computed(() => dayjs(props.plan.date).isBefore(dayjs(), 'day'));

const weekday = computed(() => {
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return labels[dayjs(props.plan.date).day()];
});
const dateLabel = computed(() => dayjs(props.plan.date).format('M/D'));
const dateShort = computed(() => dayjs(props.plan.date).format('M月D日'));

const sceneOptions = computed<SceneTag[]>(() => {
  const all = settingsStore.allScenes;
  const wscenes = WEATHER_SCENES.filter((s) => all.includes(s));
  return wscenes.length > 0
    ? wscenes
    : [...WEATHER_SCENES, ...all].filter((v, i, a) => a.indexOf(v) === i);
});

const weather = computed(() => props.plan.weather);
const weatherIcon = computed(() => weatherMeta(weather.value.weatherCode).icon);

const isFullyRecommended = computed(() => props.plan.outfit.missingCategories.length === 0);
const isTodayWorn = computed(() => Boolean(props.plan.usedToday));

const hasAnyItem = computed(() => {
  const o = props.plan.outfit;
  return Boolean(o.topId || o.bottomId || o.shoesBagsId || o.accessoryId);
});

// ── Outfit slots (4) ──────────────────────────────────────────────────
const OUTFIT_KEYS: Array<{ cat: Category; key: 'topId' | 'bottomId' | 'shoesBagsId' | 'accessoryId' }> = [
  { cat: 'top', key: 'topId' },
  { cat: 'bottom', key: 'bottomId' },
  { cat: 'shoes_bags', key: 'shoesBagsId' },
  { cat: 'accessory', key: 'accessoryId' },
];

function itemFor(key: 'topId' | 'bottomId' | 'shoesBagsId' | 'accessoryId'): Item | null {
  const id = props.plan.outfit[key];
  if (!id) return null;
  return itemsStore.items.find((i) => i.id === id) ?? null;
}

// ── Replace picker state ──────────────────────────────────────────────
const replacePickerOpen = ref(false);
const replaceTarget = ref<Category | null>(null);

function openReplace(cat: Category) {
  if (!isToday.value && !isFuture.value) return;
  replaceTarget.value = cat;
  replacePickerOpen.value = true;
}

const replaceCandidates = computed<Item[]>(() => {
  if (!replaceTarget.value) return [];
  const target = replaceTarget.value;
  const exclude = new Set(
    [
      props.plan.outfit.topId,
      props.plan.outfit.bottomId,
      props.plan.outfit.shoesBagsId,
      props.plan.outfit.accessoryId,
    ].filter((x): x is string => Boolean(x)),
  );
  const bands = mapTempToBands(props.plan.weather.tempFeels);
  return itemsStore.items.filter((i) => {
    if (i.category !== target) return false;
    if (exclude.has(i.id)) return false;
    if (!i.scenes.includes(props.plan.scene)) return false;
    if (bands && !i.tempBands.some((t) => bands.includes(t))) return false;
    return true;
  });
});

function onPickReplace(item: Item) {
  if (!replaceTarget.value) return;
  emit('replaceItem', props.index, replaceTarget.value, item.id);
  replacePickerOpen.value = false;
  replaceTarget.value = null;
}

function onCloseReplace() {
  replacePickerOpen.value = false;
  replaceTarget.value = null;
}

// ── Action visibility ────────────────────────────────────────────────
const showRegenerate = computed(() => {
  if (!isToday.value && !isFuture.value) return false;
  return isFullyRecommended.value;
});
const showWear = computed(() => isToday.value && hasAnyItem.value && !isTodayWorn.value);
const showSaveLook = computed(() => isToday.value && hasAnyItem.value);

const cardClass = computed(() => {
  if (isToday.value) {
    return 'bg-gradient-to-br from-accent/12 to-primary/6 shadow-[var(--shadow-accent-out)]';
  }
  if (isPast.value) return 'opacity-55';
  return '';
});

const tempDisplay = computed(() => `${weather.value.tempMax}°`);

function missingLabels() {
  return props.plan.outfit.missingCategories.map((c: Category) => CATEGORY_LABELS[c]);
}

function onRegenerate() {
  emit('regenerate', props.index);
}

function onWear() {
  emit('wear', props.index);
}

function onSceneChange(scene: SceneTag) {
  emit('changeScene', props.index, scene);
}

function onSaveLook() {
  emit('saveLook', props.index);
}

function onGoUpload() {
  emit('goToUpload');
}

function onGoWardrobe() {
  emit('goToWardrobe');
}
</script>

<template>
  <div
    class="neu-out glass mt-3 p-4 transition-shadow"
    :class="cardClass"
    :aria-label="`${dateShort} · ${weekday} 的穿搭推荐`"
  >
    <!-- Header -->
    <header class="mb-3 flex items-start justify-between gap-2">
      <div class="flex flex-col">
        <div class="flex items-baseline gap-2">
          <span class="display text-xl">{{ dateLabel }}</span>
          <span class="text-sm font-semibold ink-soft">{{ weekday }}</span>
          <span
            v-if="isToday"
            class="chip-active !px-1.5 !py-0 !text-[9px]"
          >今天</span>
          <span
            v-if="isTodayWorn"
            class="chip !px-1.5 !py-0 !text-[9px]"
          >已穿</span>
        </div>
        <div class="mt-1 flex items-center gap-2 text-xs ink-mute">
          <span aria-hidden="true">{{ weatherIcon }}</span>
          <span class="font-mono">{{ tempDisplay }}</span>
          <span v-if="weather.tempMin != null" class="font-mono opacity-70">
            / {{ weather.tempMin }}°
          </span>
          <span v-if="isFuture" class="font-mono opacity-80">
            code {{ weather.weatherCode }}
          </span>
        </div>
      </div>

      <div v-if="isToday || isFuture">
        <ScenePicker
          :scenes="sceneOptions"
          :model-value="plan.scene"
          @change="onSceneChange"
        />
      </div>
    </header>

    <!-- Outfit slots -->
    <div class="grid grid-cols-4 gap-3">
      <OutfitSlot
        v-for="{ cat, key } in OUTFIT_KEYS"
        :key="cat"
        :category="cat"
        :item="itemFor(key)"
        :replaceable="isToday || isFuture"
        @replace="openReplace"
      />
    </div>

    <!-- Missing warning -->
    <p
      v-if="!isFullyRecommended"
      class="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-xs ink-soft"
    >
      <span aria-hidden="true">⚠</span>
      <span class="font-semibold">缺{{ missingLabels().join('、') }}</span>
      <button
        v-if="isToday || isFuture"
        class="ml-1 text-accent underline underline-offset-2 hover:text-accent-hover"
        @click="onGoUpload"
      >去上传</button>
      <button
        v-else
        class="ml-1 text-ink-mute underline underline-offset-2"
        @click="onGoWardrobe"
      >看衣柜</button>
    </p>

    <!-- Actions row -->
    <footer
      v-if="showRegenerate || showWear || showSaveLook"
      class="mt-3 flex items-center gap-2 border-t border-line pt-3"
    >
      <button
        v-if="showWear"
        class="btn btn-accent !rounded-full !px-3 !py-1.5 !text-xs"
        @click="onWear"
      >
        <span aria-hidden="true">✓</span>今天就穿
      </button>

      <button
        v-if="showRegenerate"
        class="btn btn-secondary !rounded-full !px-3 !py-1.5 !text-xs"
        @click="onRegenerate"
        aria-label="换一套"
      >
        <span aria-hidden="true">↻</span>换一套
      </button>

      <button
        v-if="showSaveLook"
        class="btn btn-ghost !rounded-full !px-3 !py-1.5 !text-xs"
        @click="onSaveLook"
      >
        <span aria-hidden="true">♥</span>收藏 Look
      </button>
    </footer>

    <!-- Replace picker modal -->
    <ItemReplacePicker
      :open="replacePickerOpen"
      :category="replaceTarget ?? 'top'"
      :candidates="replaceCandidates"
      @close="onCloseReplace"
      @select="onPickReplace"
    />
  </div>
</template>
