<script setup lang="ts">
/* Hallmark · component: settings-page · genre: editorial-cool · theme: custom
 * sections: location · temp bands · scenes · cool down · backup · about
 */
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/stores/settings';
import { useItemsStore } from '@/stores/items';
import { useLooksStore } from '@/stores/looks';
import { useWeatherStore } from '@/stores/weather';
import { DEFAULT_SCENES, DEFAULT_TEMP_BANDS } from '@/utils/constants';
import {
  downloadBackup,
  exportAllData,
  importAllData,
  readBackupFile,
} from '@/services/backup';
import type { SceneTag } from '@/types';

const settingsStore = useSettingsStore();
const itemsStore = useItemsStore();
const looksStore = useLooksStore();
const weatherStore = useWeatherStore();
const { settings, allTempBands, allScenes } = storeToRefs(settingsStore);

const toast = ref<{ msg: string; ts: number } | null>(null);
function showToast(msg: string) {
  toast.value = { msg, ts: Date.now() };
}

// ── City ──────────────────────────────────────────────────────────────
const cityName = ref(settings.value.city.name);
const cityLat = ref(String(settings.value.city.lat));
const cityLon = ref(String(settings.value.city.lon));

function syncFromStore() {
  cityName.value = settings.value.city.name;
  cityLat.value = String(settings.value.city.lat);
  cityLon.value = String(settings.value.city.lon);
}

function useGeolocation() {
  if (!navigator.geolocation) {
    showToast('当前浏览器不支持定位');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      cityName.value = '（我的位置）';
      cityLat.value = String(+pos.coords.latitude.toFixed(4));
      cityLon.value = String(+pos.coords.longitude.toFixed(4));
      await saveCity();
      showToast('已使用当前定位');
    },
    () => showToast('定位失败，请手动输入'),
  );
}

async function saveCity() {
  const lat = parseFloat(cityLat.value);
  const lon = parseFloat(cityLon.value);
  if (!isFinite(lat) || !isFinite(lon)) {
    showToast('坐标必须是数字');
    return;
  }
  const name = cityName.value.trim() || '自定义城市';
  await settingsStore.saveSettings({ city: { lat, lon, name } });
  weatherStore.refresh(true);
  showToast('城市已保存');
}

// ── Temp bands ────────────────────────────────────────────────────────
const newBand = ref('');
function addBand() {
  const v = parseInt(newBand.value, 10);
  if (!isFinite(v) || v < -40 || v > 60) {
    showToast('温度需在 -40 ~ 60 之间');
    return;
  }
  settingsStore.addTempBand(v);
  newBand.value = '';
  showToast(`已添加温度档 ${v}°`);
}
function removeBand(b: number) {
  if (DEFAULT_TEMP_BANDS.includes(b)) {
    showToast('默认档位不可删除');
    return;
  }
  settingsStore.removeTempBand(b);
}

// ── Scenes ────────────────────────────────────────────────────────────
const newScene = ref('');
function addScene() {
  const v = newScene.value.trim().replace(/^#/, '');
  if (!v) return;
  settingsStore.addScene(v);
  newScene.value = '';
  showToast(`已添加场景 #${v}`);
}
function removeScene(s: SceneTag) {
  if (DEFAULT_SCENES.includes(s)) {
    showToast('默认场景不可删除');
    return;
  }
  settingsStore.removeScene(s);
}

// ── Cool down ─────────────────────────────────────────────────────────
const coolDownDays = ref(settings.value.coolDownDays);
async function saveCoolDown() {
  const v = Math.max(0, Math.min(60, parseInt(String(coolDownDays.value), 10) || 0));
  await settingsStore.saveSettings({ coolDownDays: v });
  coolDownDays.value = v;
  showToast(`冷却期已设为 ${v} 天`);
}

// ── Week schedule ─────────────────────────────────────────────────────
const DAY_KEYS = [
  { key: 'monday', label: '周一' },
  { key: 'tuesday', label: '周二' },
  { key: 'wednesday', label: '周三' },
  { key: 'thursday', label: '周四' },
  { key: 'friday', label: '周五' },
  { key: 'saturday', label: '周六' },
  { key: 'sunday', label: '周日' },
] as const;

const dayDrafts = ref<Record<typeof DAY_KEYS[number]['key'], SceneTag>>({
  monday: settingsStore.schedule.monday,
  tuesday: settingsStore.schedule.tuesday,
  wednesday: settingsStore.schedule.wednesday,
  thursday: settingsStore.schedule.thursday,
  friday: settingsStore.schedule.friday,
  saturday: settingsStore.schedule.saturday,
  sunday: settingsStore.schedule.sunday,
});

async function saveSchedule() {
  await settingsStore.saveSchedule({ ...dayDrafts.value });
  showToast('周模板已保存');
}

// ── Backup ────────────────────────────────────────────────────────────
const importing = ref(false);
const fileRef = ref<HTMLInputElement | null>(null);

async function onExport() {
  const payload = await exportAllData();
  downloadBackup(payload);
  showToast('备份已下载');
}

function onPickImportFile(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (!file) return;
  void doImport(file);
}

async function doImport(file: File) {
  importing.value = true;
  try {
    const json = await readBackupFile(file);
    const mode = confirm('点击"确定"合并导入；点击"取消"完全替换。') ? 'merge' : 'replace';
    const result = await importAllData(json, { mode });
    const parts: string[] = [];
    parts.push(`单品 ${result.items}`);
    parts.push(`Look ${result.looks}`);
    if (result.settings) parts.push('设置');
    if (result.schedule) parts.push('周模板');
    showToast(`导入完成：${parts.join(' · ')}`);
    if (result.errors.length > 0) {
      alert('导入警告：\n' + result.errors.join('\n'));
    }
    await Promise.all([settingsStore.load(), itemsStore.refresh(), looksStore.refresh()]);
  } catch (err) {
    showToast(err instanceof Error ? err.message : '导入失败');
  } finally {
    importing.value = false;
  }
}

// ── Reset ─────────────────────────────────────────────────────────────
async function onResetDefaults() {
  if (!confirm('确定要恢复默认设置吗？此操作会覆盖当前设置与周模板。')) return;
  await settingsStore.resetDefaults();
  syncFromStore();
  coolDownDays.value = settings.value.coolDownDays;
  dayDrafts.value = {
    monday: settingsStore.schedule.monday,
    tuesday: settingsStore.schedule.tuesday,
    wednesday: settingsStore.schedule.wednesday,
    thursday: settingsStore.schedule.thursday,
    friday: settingsStore.schedule.friday,
    saturday: settingsStore.schedule.saturday,
    sunday: settingsStore.schedule.sunday,
  };
  showToast('已恢复默认');
}

const isCustomBand = (b: number) => !DEFAULT_TEMP_BANDS.includes(b);
const isCustomScene = (s: SceneTag) => !DEFAULT_SCENES.includes(s);

const itemCount = computed(() => itemsStore.items.length);
const lookCount = computed(() => looksStore.looks.length);

onMounted(async () => {
  await settingsStore.load();
  syncFromStore();
  coolDownDays.value = settings.value.coolDownDays;
  dayDrafts.value = {
    monday: settingsStore.schedule.monday,
    tuesday: settingsStore.schedule.tuesday,
    wednesday: settingsStore.schedule.wednesday,
    thursday: settingsStore.schedule.thursday,
    friday: settingsStore.schedule.friday,
    saturday: settingsStore.schedule.saturday,
    sunday: settingsStore.schedule.sunday,
  };
});
</script>

<template>
  <div class="flex flex-col">

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

    <!-- Header -->
    <header class="glass-strong relative overflow-hidden px-6 py-6">
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full opacity-70 blur-2xl"
        style="background: radial-gradient(circle, color-mix(in oklch, var(--color-primary) 70%, transparent), transparent 68%);"
      />
      <div class="relative">
        <p class="font-mono text-xs uppercase tracking-widest ink-mute">Settings</p>
        <h1 class="display mt-1 text-3xl">设置</h1>
        <div class="mt-3 flex items-center gap-3 text-sm ink-mute">
          <span>
            单品 <span class="font-mono font-semibold text-ink">{{ itemCount }}</span>
          </span>
          <span class="font-mono">·</span>
          <span>
            Look <span class="font-mono font-semibold text-ink">{{ lookCount }}</span>
          </span>
        </div>
      </div>
    </header>

    <!-- City -->
    <section class="glass mt-4 p-4">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="display text-base">城市 / 定位</h2>
        <button
          class="btn btn-ghost !rounded-full !px-2.5 !py-1 !text-xs"
          @click="useGeolocation"
        >
          <span aria-hidden="true">◎</span>
          <span>使用定位</span>
        </button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <label class="col-span-2 block">
          <span class="mb-1 block text-xs font-bold tracking-widest uppercase text-ink-mute">
            城市名
          </span>
          <input
            v-model="cityName"
            type="text"
            class="neu-in-soft w-full rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-bold tracking-widest uppercase text-ink-mute">
            纬度
          </span>
          <input
            v-model="cityLat"
            type="text"
            inputmode="decimal"
            class="neu-in-soft w-full rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-bold tracking-widest uppercase text-ink-mute">
            经度
          </span>
          <input
            v-model="cityLon"
            type="text"
            inputmode="decimal"
            class="neu-in-soft w-full rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
      </div>
      <button
        class="btn btn-primary mt-3 w-full !rounded-full !py-2.5"
        @click="saveCity"
      >保存城市</button>
    </section>

    <!-- Temp bands -->
    <section class="glass mt-3 p-4">
      <h2 class="display mb-1 text-base">温度档</h2>
      <p class="mb-3 text-xs ink-mute">推荐器会按这些档位给单品归类</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="b in allTempBands"
          :key="b"
          type="button"
          class="chip"
          :class="isCustomBand(b) ? 'chip-active' : ''"
          :disabled="!isCustomBand(b)"
          :title="isCustomBand(b) ? '点击删除' : '默认档位不可删除'"
          @click="removeBand(b)"
        >
          {{ b }}°
          <span v-if="isCustomBand(b)" class="ml-0.5" aria-hidden="true">✕</span>
        </button>
      </div>
      <div class="mt-3 flex gap-2">
        <input
          v-model="newBand"
          type="number"
          min="-40"
          max="60"
          placeholder="新增温度，如 12"
          class="neu-in-soft flex-1 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          @keydown.enter="addBand"
        />
        <button
          class="btn btn-primary !rounded-full !px-4 !py-2"
          @click="addBand"
        >添加</button>
      </div>
    </section>

    <!-- Scenes -->
    <section class="glass mt-3 p-4">
      <h2 class="display mb-1 text-base">场景</h2>
      <p class="mb-3 text-xs ink-mute">推荐与筛选使用的场景标签</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="s in allScenes"
          :key="s"
          type="button"
          class="chip"
          :class="isCustomScene(s) ? 'chip-active' : ''"
          :disabled="!isCustomScene(s)"
          :title="isCustomScene(s) ? '点击删除' : '默认场景不可删除'"
          @click="removeScene(s)"
        >
          <span class="font-mono">#</span>{{ s }}
          <span v-if="isCustomScene(s)" class="ml-0.5" aria-hidden="true">✕</span>
        </button>
      </div>
      <div class="mt-3 flex gap-2">
        <input
          v-model="newScene"
          type="text"
          placeholder="新增场景，如 婚礼"
          class="neu-in-soft flex-1 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          @keydown.enter="addScene"
        />
        <button
          class="btn btn-primary !rounded-full !px-4 !py-2"
          @click="addScene"
        >添加</button>
      </div>
    </section>

    <!-- Cool down -->
    <section class="glass mt-3 p-4">
      <h2 class="display mb-1 text-base">冷却期</h2>
      <p class="mb-3 text-xs ink-mute">同一件单品最近穿过后，多少天内不重复推荐</p>
      <div class="flex items-center gap-3">
        <input
          v-model="coolDownDays"
          type="range"
          min="0"
          max="30"
          class="flex-1"
          aria-label="冷却天数"
        />
        <span class="font-mono text-lg font-semibold text-primary min-w-[60px] text-right">
          {{ coolDownDays }} 天
        </span>
      </div>
      <button
        class="btn btn-primary mt-3 w-full !rounded-full !py-2.5"
        @click="saveCoolDown"
      >保存冷却期</button>
    </section>

    <!-- Week schedule -->
    <section class="glass mt-3 p-4">
      <h2 class="display mb-1 text-base">周模板</h2>
      <p class="mb-3 text-xs ink-mute">每天默认使用的场景，可覆盖推荐逻辑</p>
      <div class="grid grid-cols-2 gap-2">
        <label
          v-for="day in DAY_KEYS"
          :key="day.key"
          class="flex flex-col gap-1"
        >
          <span class="text-xs font-bold tracking-widest uppercase text-ink-mute">
            {{ day.label }}
          </span>
          <select
            v-model="dayDrafts[day.key]"
            class="neu-in-soft w-full rounded-xl px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option v-for="s in allScenes" :key="s" :value="s">#{{ s }}</option>
          </select>
        </label>
      </div>
      <button
        class="btn btn-primary mt-3 w-full !rounded-full !py-2.5"
        @click="saveSchedule"
      >保存周模板</button>
    </section>

    <!-- Backup -->
    <section class="glass mt-3 p-4">
      <h2 class="display mb-1 text-base">数据备份</h2>
      <p class="mb-3 text-xs ink-mute">
        导出 JSON 包含全部单品图片（可能较大）；导入支持合并或替换
      </p>
      <div class="flex flex-col gap-2">
        <button
          class="btn btn-primary w-full !rounded-full !py-2.5"
          @click="onExport"
        >
          <span aria-hidden="true">↓</span>
          <span>导出全部数据</span>
        </button>
        <button
          class="btn btn-accent w-full !rounded-full !py-2.5"
          :disabled="importing"
          :aria-busy="importing"
          @click="fileRef?.click()"
        >
          <span aria-hidden="true">↑</span>
          <span>{{ importing ? '导入中…' : '导入备份文件' }}</span>
        </button>
        <input
          ref="fileRef"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="onPickImportFile"
        />
      </div>
    </section>

    <!-- Danger zone -->
    <section class="glass mt-3 p-4">
      <h2 class="display mb-1 text-base">危险操作</h2>
      <p class="mb-3 text-xs ink-mute">恢复默认设置与周模板，不影响单品与 Look</p>
      <button
        class="btn btn-ghost w-full !rounded-full !py-2.5 text-danger"
        @click="onResetDefaults"
      >
        恢复默认设置
      </button>
    </section>

    <div class="h-6"></div>
  </div>
</template>
