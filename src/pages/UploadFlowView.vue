<script setup lang="ts">
/* Hallmark · component: upload-flow · 3-step wizard · genre: editorial-cool
 * states: idle · selected-category · processing · error
 * pre-emit critique: P5 H5 E5 S5 R5 V5
 */
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_ORDER } from '@/utils/constants';
import { compressImage } from '@/services/image';
import type { Category, SceneTag } from '@/types';
import SceneTagSelector from '@/components/item/SceneTagSelector.vue';
import TempBandSelector from '@/components/item/TempBandSelector.vue';

const router = useRouter();
const itemsStore = useItemsStore();
const settingsStore = useSettingsStore();
const { allTempBands, allScenes } = storeToRefs(settingsStore);

type Step = 'category' | 'photo' | 'tags';
const step = ref<Step>('category');
const steps: { key: Step; label: string }[] = [
  { key: 'category', label: '类目' },
  { key: 'photo', label: '照片' },
  { key: 'tags', label: '标签' },
];

const selectedCategory = ref<Category | null>(null);
const rawFile = ref<File | null>(null);
const previewUrl = ref<string>('');
const processing = ref(false);
const processingMsg = ref('');
const errorMsg = ref<string>('');
const saving = ref(false);
const successItemId = ref<string | null>(null);

const scenes = ref<SceneTag[]>([]);
const tempBands = ref<number[]>([]);
const note = ref('');

function stepIndex(s: Step) { return steps.findIndex((x) => x.key === s); }

watch(step, () => { errorMsg.value = ''; });

function pickCategory(c: Category) {
  selectedCategory.value = c;
  step.value = 'photo';
}

async function onFilePicked(file: File) {
  errorMsg.value = '';
  if (!file.type.startsWith('image/')) {
    errorMsg.value = '请选择图片文件';
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    errorMsg.value = '图片过大（>15MB），请压缩后再上传';
    return;
  }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  rawFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
}

function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void onFilePicked(file);
  input.value = '';
}

function next() {
  if (step.value === 'category' && selectedCategory.value) step.value = 'photo';
  else if (step.value === 'photo' && rawFile.value) step.value = 'tags';
}

function back() {
  if (step.value === 'photo') step.value = 'category';
  else if (step.value === 'tags') step.value = 'photo';
}

async function save() {
  if (!selectedCategory.value || !rawFile.value) return;
  saving.value = true;
  errorMsg.value = '';
  try {
    processing.value = true;
    processingMsg.value = '正在压缩图片…';
    const { full, thumb } = await compressImage(rawFile.value);
    processingMsg.value = '正在保存…';
    const item = await itemsStore.addItem({
      category: selectedCategory.value,
      scenes: [...scenes.value],
      tempBands: [...tempBands.value],
      note: note.value || undefined,
      imageFull: full,
      imageThumb: thumb,
    });
    processingMsg.value = '完成';
    successItemId.value = item.id;
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '保存失败，请重试';
  } finally {
    processing.value = false;
    saving.value = false;
  }
}

function redo() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  rawFile.value = null;
  previewUrl.value = '';
  step.value = 'photo';
}

function finish() {
  router.push('/wardrobe');
}

function resetFlow() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  rawFile.value = null;
  previewUrl.value = '';
  selectedCategory.value = null;
  scenes.value = [];
  tempBands.value = [];
  note.value = '';
  errorMsg.value = '';
  step.value = 'category';
}

function goWardrobe() { router.push('/wardrobe'); }

onMounted(async () => {
  await settingsStore.load();
});
</script>

<template>
  <div class="flex flex-col">

    <!-- Header -->
    <header class="glass-strong relative overflow-hidden px-6 py-6">
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full opacity-70 blur-2xl"
        style="background: radial-gradient(circle, color-mix(in oklch, var(--color-primary) 70%, transparent), transparent 68%);"
      />
      <div class="relative flex items-center justify-between">
        <button class="btn btn-ghost !rounded-full !px-2 !py-1.5" @click="back" :disabled="step === 'category'" aria-label="上一步">←</button>
        <div class="text-center">
          <p class="font-mono text-xs uppercase tracking-widest ink-mute">Upload</p>
          <h1 class="display mt-0.5 text-2xl">上传单品</h1>
        </div>
        <button class="btn btn-ghost !rounded-full !px-2 !py-1.5" @click="goWardrobe" aria-label="退出上传">✕</button>
      </div>

      <!-- Progress -->
      <ol class="relative mt-5 flex items-center justify-between">
        <li
          v-for="(s, i) in steps"
          :key="s.key"
          class="flex flex-1 flex-col items-center gap-1"
          :aria-current="step === s.key ? 'step' : undefined"
        >
          <span
            class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
            :class="stepIndex(step) > i ? 'text-white' : (stepIndex(step) === i ? 'text-white' : 'ink-mute')"
            :style="{
              background: stepIndex(step) > i
                ? 'linear-gradient(140deg, var(--color-accent-glow), var(--color-accent-deep))'
                : stepIndex(step) === i
                ? 'linear-gradient(140deg, var(--color-primary-glow), var(--color-primary-deep))'
                : 'oklch(90% 0.005 240)',
              boxShadow: stepIndex(step) === i ? 'var(--shadow-primary-out)' : 'var(--neu-in-soft)',
            }"
          >
            {{ stepIndex(step) > i ? '✓' : i + 1 }}
          </span>
          <span
            class="text-[11px] font-semibold"
            :class="stepIndex(step) === i ? 'text-primary' : 'ink-mute'"
          >{{ s.label }}</span>
        </li>
      </ol>
    </header>

    <!-- Body -->
    <div class="glass mt-4 px-5 py-5">

      <!-- Step 1: Category -->
      <template v-if="step === 'category'">
        <h2 class="display text-xl">选择类目</h2>
        <p class="mt-1 text-sm ink-mute">这件单品属于哪一类？</p>
        <div class="mt-5 grid grid-cols-2 gap-3">
          <button
            v-for="c in CATEGORY_ORDER"
            :key="c"
            type="button"
            class="neu-out flex flex-col items-center gap-2 px-3 py-5"
            @click="pickCategory(c)"
          >
            <span class="text-3xl" aria-hidden="true">{{ CATEGORY_ICONS[c] }}</span>
            <span class="text-sm font-semibold">{{ CATEGORY_LABELS[c] }}</span>
          </button>
        </div>
        <p v-if="errorMsg" class="mt-4 text-sm" style="color: var(--color-primary-deep);">{{ errorMsg }}</p>
      </template>

      <!-- Step 2: Photo -->
      <template v-else-if="step === 'photo'">
        <h2 class="display text-xl">上传照片</h2>
        <p class="mt-1 text-sm ink-mute">
          <span class="font-mono font-semibold text-ink">{{ CATEGORY_LABELS[selectedCategory!] }}</span>
          · 建议清晰正对拍摄，将自动压缩到 800px
        </p>

        <label
          class="mt-5 flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed"
          style="border-color: var(--glass-border-soft);"
        >
          <input
            type="file"
            accept="image/*"
            class="hidden"
            :disabled="processing"
            @change="handleFileInput"
          />
          <template v-if="!previewUrl">
            <span class="text-4xl ink-mute" aria-hidden="true">📷</span>
            <span class="mt-3 text-sm font-semibold">点击选择或拍照</span>
            <span class="mt-1 text-xs ink-mute">支持 JPG / PNG / HEIC，≤15MB</span>
          </template>
          <template v-else>
            <img
              :src="previewUrl"
              alt="单品预览"
              class="max-h-[220px] w-auto rounded-xl object-contain"
            />
            <span class="mt-2 text-xs ink-mute">点击重新选择</span>
          </template>
        </label>

        <p v-if="errorMsg" class="mt-3 text-sm" style="color: var(--color-primary-deep);">{{ errorMsg }}</p>

        <div class="mt-6 flex gap-3">
          <button class="btn btn-primary flex-1" :disabled="!rawFile || processing" @click="next">
            下一步
          </button>
        </div>
      </template>

      <!-- Step 3: Tags -->
      <template v-else-if="step === 'tags'">
        <div class="flex items-start gap-4">
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt="单品预览"
            class="h-16 w-16 rounded-xl object-cover"
            style="box-shadow: var(--neu-out-soft);"
          />
          <div class="flex-1">
            <h2 class="display text-xl">添加标签</h2>
            <p class="mt-0.5 text-sm ink-mute">用于推荐算法匹配</p>
          </div>
        </div>

        <div class="mt-5">
          <p class="text-xs uppercase tracking-widest ink-mute font-mono">场景（最多 4 个）</p>
          <SceneTagSelector
            v-model="scenes"
            :options="allScenes"
            :max="4"
            class="mt-2"
          />
        </div>

        <div class="mt-4">
          <p class="text-xs uppercase tracking-widest ink-mute font-mono">适宜气温（最多 3 档）</p>
          <TempBandSelector
            v-model="tempBands"
            :options="allTempBands"
            :max="3"
            class="mt-2"
          />
        </div>

        <div class="mt-4">
          <label class="text-xs uppercase tracking-widest ink-mute font-mono" for="upload-note">备注（可选）</label>
          <textarea
            id="upload-note"
            v-model="note"
            maxlength="100"
            rows="2"
            placeholder="例如：面料是羊毛、颜色偏深"
            class="mt-2 w-full rounded-xl px-3 py-2 text-sm outline-none"
            style="background: var(--color-paper); box-shadow: var(--neu-in-soft); color: var(--color-ink); border: 1px solid var(--glass-border-soft);"
          ></textarea>
        </div>

        <p v-if="errorMsg" class="mt-3 text-sm" style="color: var(--color-primary-deep);">{{ errorMsg }}</p>

        <div class="mt-6 flex gap-3">
          <button class="btn btn-secondary flex-1" @click="redo" :disabled="saving">重选照片</button>
          <button class="btn btn-primary flex-1" :disabled="saving || processing" @click="save">
            <span v-if="processing">{{ processingMsg }}</span>
            <span v-else>保存单品</span>
          </button>
        </div>
      </template>

      <!-- Success state -->
      <template v-if="successItemId">
        <div class="mt-5 flex flex-col items-center rounded-2xl px-6 py-8 text-center" style="background: linear-gradient(150deg, color-mix(in oklch, var(--color-primary) 12%, var(--color-paper)), color-mix(in oklch, var(--color-accent) 10%, var(--color-paper))); border: 1px solid var(--glass-border-soft);">
          <div
            class="flex h-14 w-14 items-center justify-center rounded-full text-white"
            style="background: linear-gradient(140deg, var(--color-primary-glow), var(--color-primary-deep)); box-shadow: var(--shadow-primary-out);"
          >
            <span class="text-2xl" aria-hidden="true">✓</span>
          </div>
          <p class="display mt-4 text-xl">已保存到衣柜</p>
          <p class="mt-1 text-sm ink-mute">这件单品已加入推荐池</p>
          <div class="mt-5 flex gap-3">
            <button class="btn btn-secondary flex-1" @click="resetFlow">继续上传</button>
            <button class="btn btn-primary flex-1" @click="finish">查看衣柜</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
