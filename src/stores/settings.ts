import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { db } from '@/db';
import type { Settings, WeekSchedule, SceneTag } from '@/types';
import {
  DEFAULT_TEMP_BANDS,
  DEFAULT_SCENES,
  DEFAULT_USER_ID,
  defaultSettings,
  defaultWeekSchedule,
} from '@/utils/constants';

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>(defaultSettings());
  const schedule = ref<WeekSchedule>(defaultWeekSchedule());
  const loading = ref(false);

  const allTempBands = computed<number[]>(() => [
    ...DEFAULT_TEMP_BANDS,
    ...settings.value.customTempBands.filter(
      (b) => !DEFAULT_TEMP_BANDS.includes(b),
    ),
  ]);

  const allScenes = computed<SceneTag[]>(() => [
    ...DEFAULT_SCENES,
    ...settings.value.customScenes.filter(
      (sc) => !DEFAULT_SCENES.includes(sc),
    ),
  ]);

  async function load() {
    loading.value = true;
    try {
      const [stored, storedSchedule] = await Promise.all([
        db.settings.get(DEFAULT_USER_ID),
        db.schedule.get(DEFAULT_USER_ID),
      ]);
      if (stored) settings.value = stored;
      if (storedSchedule) schedule.value = storedSchedule;
    } finally {
      loading.value = false;
    }
  }

  async function saveSettings(patch: Partial<Settings>) {
    settings.value = { ...settings.value, ...patch };
    await db.settings.put(settings.value);
  }

  async function saveSchedule(patch: Partial<WeekSchedule>) {
    schedule.value = { ...schedule.value, ...patch };
    await db.schedule.put(schedule.value);
  }

  function addTempBand(band: number) {
    if (allTempBands.value.includes(band)) return;
    settings.value.customTempBands = [
      ...settings.value.customTempBands,
      band,
    ];
    void saveSettings({ customTempBands: [...settings.value.customTempBands] });
  }

  function removeTempBand(band: number) {
    settings.value.customTempBands = settings.value.customTempBands.filter(
      (b) => b !== band,
    );
    void saveSettings({ customTempBands: [...settings.value.customTempBands] });
  }

  function addScene(name: string) {
    if (allScenes.value.includes(name)) return;
    settings.value.customScenes = [...settings.value.customScenes, name];
    void saveSettings({ customScenes: [...settings.value.customScenes] });
  }

  function removeScene(name: string) {
    settings.value.customScenes = settings.value.customScenes.filter(
      (s) => s !== name,
    );
    void saveSettings({ customScenes: [...settings.value.customScenes] });
  }

  async function resetDefaults() {
    settings.value = defaultSettings();
    schedule.value = defaultWeekSchedule();
    await Promise.all([
      db.settings.put(settings.value),
      db.schedule.put(schedule.value),
    ]);
  }

  return {
    settings,
    schedule,
    loading,
    allTempBands,
    allScenes,
    load,
    saveSettings,
    saveSchedule,
    addTempBand,
    removeTempBand,
    addScene,
    removeScene,
    resetDefaults,
  };
});
