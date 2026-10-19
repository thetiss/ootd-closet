<script setup lang="ts">
/* Hallmark · component: page-shell · genre: editorial-cool · theme: custom (prussian indigo × mid-blue · monochrome)
 * states (upload button): default · hover · focus · active · disabled
 * pre-emit critique: P5 H5 E5 S4 R4 V5
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/stores/settings';
import { useItemsStore } from '@/stores/items';
import { useWeatherStore } from '@/stores/weather';
import { useRecommendationStore } from '@/stores/recommendation';
import { useLooksStore } from '@/stores/looks';
import WeekWeatherStrip from '@/components/weather/WeekWeatherStrip.vue';
import DayCard from '@/components/recommendation/DayCard.vue';
import { CATEGORY_LABELS, weatherMeta } from '@/utils/constants';
import dayjs from 'dayjs';
import type { Category, SceneTag } from '@/types';

const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const itemsStore = useItemsStore();
const weatherStore = useWeatherStore();
const recoStore = useRecommendationStore();
const looksStore = useLooksStore();
const { settings } = storeToRefs(settingsStore);
const { count } = storeToRefs(itemsStore);
const { city: weatherCity, geoState, days: weatherDays, error: weatherError } = storeToRefs(weatherStore);
const { weekPlan, loading: generating } = storeToRefs(recoStore);

const isHome = computed(() => route.name === 'home');
const pageTitle = computed(() => {
  switch (route.name) {
    case 'wardrobe': return '衣柜';
    case 'lookbook': return 'Lookbook';
    case 'settings': return '设置';
    case 'upload':   return '上传单品';
    default:         return '推荐';
  }
});

const greeting = computed(() => {
  const h = dayjs().hour();
  if (h < 6)  return '夜深了';
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
});

const cityDisplay = computed(() => weatherCity.value.name || settings.value.city.name);
const geoStatusText = computed(() => {
  switch (geoState.value) {
    case 'granted': return null;
    case 'denied':  return '定位权限未授予，使用默认城市';
    case 'unsupported': return '浏览器不支持定位';
    default: return null;
  }
});
const weatherErrorText = computed(() => {
  if (weatherError.value && weatherDays.value.length === 0) {
    return '天气数据暂不可用';
  }
  return null;
});

const sceneChips = computed(() => settingsStore.allScenes.slice(0, 5));
const todayWeather = computed(() => weatherStore.today);
const todayScene = computed<SceneTag | null>(() => {
  if (!todayWeather.value) return null;
  const iso = todayWeather.value.date;
  const plan = weekPlan.value.find((p) => p.date === iso);
  return plan?.scene ?? null;
});
const todayWeatherMeta = computed(() => {
  if (!todayWeather.value) return null;
  return weatherMeta(todayWeather.value.weatherCode);
});

// ── Toast ─────────────────────────────────────────────────────────────
const toast = ref<{ msg: string; ts: number } | null>(null);
function showToast(msg: string) {
  toast.value = { msg, ts: Date.now() };
}

// ── Recommendation lifecycle ──────────────────────────────────────────
async function bootstrapRecommendation() {
  if (weekPlan.value.length === 0) {
    await recoStore.generateWeekPlan();
  }
}

async function refreshAll() {
  await recoStore.generateWeekPlan();
  showToast('本周推荐已刷新');
}

// ── DayCard handlers ──────────────────────────────────────────────────
function onRegenerate(i: number) {
  void recoStore.regenerateDay(i);
}
function onWear(i: number) {
  void recoStore.wearToday(i);
  showToast('已记录今日穿着');
}
function onSceneChange(i: number, scene: SceneTag) {
  void recoStore.changeScene(i, scene);
}
function onReplace(i: number, cat: Category, itemId: string) {
  void recoStore.replaceItem(i, cat, itemId);
}
async function onSaveLook(i: number) {
  const saved = await recoStore.saveLookFromPlan(i);
  if (saved) showToast('已收藏 Look');
  else showToast('保存失败');
}
function onGoUpload() { router.push('/wardrobe/upload'); }
function onGoWardrobe() { router.push('/wardrobe'); }
function goUpload() { router.push('/wardrobe/upload'); }

const showEmptyCta = computed(() => itemsStore.items.length === 0);
const showNotTodayCta = computed(() => weekPlan.value.length === 0 && !generating.value);

// ── Look strip ────────────────────────────────────────────────────────
const recentLooks = computed(() => looksStore.recLooks.slice(0, 8));

function missingLabelsList() {
  return recoStore.overallMissing.map((c) => CATEGORY_LABELS[c]);
}

onMounted(async () => {
  await Promise.all([
    settingsStore.load(),
    itemsStore.refresh(),
    weatherStore.initLocation(),
    looksStore.refresh(),
  ]);
  if (isHome.value) {
    await bootstrapRecommendation();
  }
});
</script>

<template>
  <div class="flex flex-col h-full relative">

    <!-- Toast -->
    <transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="toast"
        class="glass-strong pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2 px-4 py-2 text-sm shadow-lg"
        role="status"
        aria-live="polite"
      >{{ toast.msg }}</div>
    </transition>

    <!-- ───────────── HOME ───────────── -->
    <template v-if="isHome">

      <!-- HERO -->
      <header class="glass-strong relative overflow-hidden px-6 pt-6 pb-5">
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-80 blur-2xl"
          style="background: radial-gradient(circle, color-mix(in oklch, var(--color-primary) 70%, transparent), transparent 68%);"
        />
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -left-24 bottom-0 h-44 w-44 rounded-full opacity-70 blur-2xl"
          style="background: radial-gradient(circle, color-mix(in oklch, var(--color-accent) 55%, transparent), transparent 68%);"
        />

        <div class="relative">
          <div class="flex items-center justify-between">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide"
              style="background: linear-gradient(140deg, var(--color-accent-glow), var(--color-accent-deep)); color: white; box-shadow: var(--shadow-accent-out);"
              :title="geoStatusText ?? undefined"
            >
              <span aria-hidden="true" class="text-[8px]">◉</span>
              <span class="font-mono">{{ cityDisplay }}</span>
            </span>
            <button
              class="btn btn-ghost !px-2 !py-1 !rounded-full"
              @click="goUpload"
              aria-label="上传单品"
            >
              <span class="text-lg leading-none">＋</span>
              <span>上传</span>
            </button>
          </div>

          <h1 class="display mt-4 text-[2.75rem] leading-[1.02]">
            <span class="block">{{ greeting }}，</span>
            <span class="accent-text block" style="background: linear-gradient(120deg, var(--color-primary-deep), var(--color-primary-glow)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">今天想穿什么？</span>
          </h1>

          <div class="mt-5 grid grid-cols-3 gap-3">
            <div class="neu-in-soft px-3 py-2 text-center">
              <p class="text-[10px] uppercase tracking-widest ink-mute">今日单品</p>
              <p class="display text-2xl leading-tight">{{ count }}</p>
            </div>
            <div class="neu-in-soft px-3 py-2 text-center">
              <p class="text-[10px] uppercase tracking-widest ink-mute">气温档</p>
              <p class="display text-2xl leading-tight">{{ settingsStore.allTempBands.length }}</p>
            </div>
            <div class="neu-in-soft px-3 py-2 text-center">
              <p class="text-[10px] uppercase tracking-widest ink-mute">场景</p>
              <p class="display text-2xl leading-tight">{{ settingsStore.allScenes.length }}</p>
            </div>
          </div>
        </div>
      </header>

      <!-- TODAY HERO WEATHER -->
      <section class="mt-5">
        <div class="mb-3 flex items-baseline justify-between px-1">
          <h2 class="display text-lg">今日天气</h2>
          <button
            class="text-xs ink-mute tracking-wider font-mono hover:text-ink transition-colors"
            @click="weatherStore.refresh(true)"
            aria-label="刷新天气"
          >↻ 刷新</button>
        </div>
        <p v-if="geoStatusText" class="mb-2 px-1 text-xs ink-mute">
          <span aria-hidden="true">⚠</span> {{ geoStatusText }}
        </p>
        <p v-if="weatherErrorText" class="mb-2 px-1 text-xs ink-mute">
          <span aria-hidden="true">⚠</span> {{ weatherErrorText }}
        </p>

        <div v-if="todayWeather && todayWeatherMeta" class="neu-out glass grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
          <div class="flex items-center gap-2 col-span-2 md:col-span-1">
            <span aria-hidden="true" class="text-5xl">{{ todayWeatherMeta.icon }}</span>
            <div>
              <p class="display text-3xl leading-none">{{ todayWeather.tempMax }}°</p>
              <p class="text-xs ink-mute font-mono">/ {{ todayWeather.tempMin }}°</p>
            </div>
          </div>
          <div class="col-span-2 md:col-span-2 md:justify-self-end">
            <p class="text-xs uppercase tracking-widest ink-mute mb-1">今日场景</p>
            <div class="flex flex-wrap gap-1.5">
              <span v-if="todayScene" class="chip-active">#{{ todayScene }}</span>
              <span v-else class="chip">—</span>
            </div>
          </div>
        </div>
      </section>

      <!-- WEEK STRIP -->
      <section class="mt-5">
        <div class="mb-3 flex items-baseline justify-between px-1">
          <h2 class="display text-lg">未来 7 天</h2>
        </div>
        <WeekWeatherStrip />
      </section>

      <!-- DAY PLANS -->
      <section class="mt-5">
        <div class="mb-3 flex items-baseline justify-between px-1">
          <h2 class="display text-lg">本周穿搭</h2>
          <button
            v-if="weekPlan.length > 0"
            class="text-xs ink-mute tracking-wider font-mono hover:text-ink transition-colors"
            @click="refreshAll"
            :disabled="generating"
            :aria-busy="generating"
          >
            <span v-if="generating" class="animate-pulse">生成中…</span>
            <span v-else>↻ 换一套</span>
          </button>
        </div>

        <!-- Empty state: no items -->
        <div
          v-if="showEmptyCta"
          class="neu-out glass p-6 text-center"
        >
          <div
            class="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
            style="background: linear-gradient(150deg, var(--color-accent-glow), var(--color-accent-deep)); box-shadow: var(--shadow-accent-out);"
          >
            <span class="text-2xl text-white" aria-hidden="true">✦</span>
          </div>
          <p class="display mt-3 text-lg">衣柜还是空的</p>
          <p class="mt-1 text-xs ink-mute">先上传几件单品，我就能开始推荐了。</p>
          <button
            class="btn btn-accent mt-4 !rounded-full"
            @click="onGoUpload"
          >＋ 去上传</button>
        </div>

        <!-- Empty state: no plans generated yet -->
        <div
          v-else-if="showNotTodayCta"
          class="neu-out glass p-6 text-center"
        >
          <p class="display text-lg">暂无推荐</p>
          <p class="mt-1 text-xs ink-mute">点击下方按钮生成今日穿搭。</p>
          <button
            class="btn btn-primary mt-4 !rounded-full"
            @click="bootstrapRecommendation"
            :disabled="generating"
          >
            <span v-if="generating" class="animate-pulse">生成中…</span>
            <span v-else>生成今日推荐</span>
          </button>
        </div>

        <!-- Day cards -->
        <template v-else>
          <p
            v-if="recoStore.overallMissing.length > 0"
            class="mb-2 rounded-lg bg-warn/10 px-3 py-2 text-xs ink-soft"
          >
            <span aria-hidden="true">⚠</span>
            本周缺{{ missingLabelsList().join('、') }}
          </p>
          <DayCard
            v-for="(p, i) in weekPlan"
            :key="p.date"
            :plan="p"
            :index="i"
            @regenerate="onRegenerate"
            @wear="onWear"
            @change-scene="onSceneChange"
            @replace-item="onReplace"
            @save-look="onSaveLook"
            @go-to-upload="onGoUpload"
            @go-to-wardrobe="onGoWardrobe"
          />
        </template>
      </section>

      <!-- SCENE SHORTCUTS -->
      <section class="mt-5">
        <h2 class="display mb-3 px-1 text-lg">热门场景</h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="(s, i) in sceneChips" :key="s" :class="i === 0 ? 'chip-active' : 'chip'">
            <span class="font-mono">#</span>{{ s }}
          </span>
        </div>
      </section>

      <!-- RECENT LOOKS -->
      <section v-if="recentLooks.length > 0" class="mt-5">
        <h2 class="display mb-3 px-1 text-lg">最近收藏</h2>
        <div class="grid grid-cols-4 gap-2">
          <div
            v-for="lk in recentLooks"
            :key="lk.id"
            class="neu-out overflow-hidden rounded-xl"
          >
            <div class="grid grid-cols-2 gap-0.5">
              <div
                v-for="itemEntry in lk.items.slice(0, 4)"
                :key="itemEntry.category"
                class="aspect-square bg-primary/10 p-1"
              >
                <span
                  class="display block text-center text-2xl"
                  aria-hidden="true"
                >{{ CATEGORY_LABELS[itemEntry.category]?.[0] }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="mt-5 pb-4">
        <div class="flex gap-3">
          <button
            class="btn btn-primary flex-1 !px-5 !py-4 !text-base"
            @click="goUpload"
          >
            <span aria-hidden="true">✦</span>
            <span>开始整理</span>
          </button>
          <button
            class="btn btn-accent flex-1 !px-5 !py-4 !text-base"
            @click="onGoWardrobe"
          >
            <span aria-hidden="true">☼</span>
            <span>逛衣柜</span>
          </button>
        </div>
      </section>

    </template>

    <!-- ───────────── Other pages ───────────── -->
    <template v-else>
      <header class="glass-strong relative overflow-hidden px-6 py-6">
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full opacity-70 blur-2xl"
          style="background: radial-gradient(circle, color-mix(in oklch, var(--color-primary) 70%, transparent), transparent 68%);"
        />
        <div class="relative">
          <p class="text-xs tracking-widest ink-mute font-mono uppercase">{{ pageTitle }}</p>
          <h1 class="display mt-1 text-3xl">{{ pageTitle }}</h1>
        </div>
      </header>

      <div class="glass mt-5 flex flex-col items-center justify-center px-8 py-14 text-center">
        <div
          class="flex h-20 w-20 items-center justify-center rounded-full"
          style="background: linear-gradient(150deg, var(--color-accent-glow), var(--color-accent-deep)); box-shadow: var(--shadow-accent-out);"
        >
          <span class="display text-3xl text-white" aria-hidden="true">✦</span>
        </div>
        <p class="display mt-5 text-xl">{{ pageTitle }} 页面</p>
        <p class="mt-2 text-sm ink-mute">此页面将在后续阶段实现。</p>
      </div>
    </template>

  </div>
</template>
