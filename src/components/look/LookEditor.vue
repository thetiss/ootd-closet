<script setup lang="ts">
/* Hallmark · component: look-editor · 手动新建 / 编辑 Look（bottom sheet 表单）
 * states: open · closed · saving · create | edit（由 initial.id 推断）
 * modes: picker（从衣柜 4 件套挑选） · photo（上传整套搭配照）
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import type { Category, Item, Look, SceneTag } from '@/types';
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_ORDER } from '@/utils/constants';
import { compressImage, compositeOutfitImage } from '@/services/image';
import { useItemsStore } from '@/stores/items';
import { useLooksStore } from '@/stores/looks';
import { useSettingsStore } from '@/stores/settings';
import ItemThumb from '@/components/item/ItemThumb.vue';

const props = defineProps<{
  open: boolean;
  initial?: Partial<Look> | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [look: Look];
}>();

const itemsStore = useItemsStore();
const looksStore = useLooksStore();
const settingsStore = useSettingsStore();
const { items } = storeToRefs(itemsStore);

type Mode = 'picker' | 'photo';
const mode = ref<Mode>('picker');

// 是否编辑模式（initial 带 id 即视为编辑）
const isEdit = computed(() => !!props.initial?.id);

const name = ref('');
const scene = ref<SceneTag | ''>('');
const tempBand = ref<number | null>(null);
const slotPickers = ref<Record<Category, string | null>>({
  top: null,
  bottom: null,
  shoes_bags: null,
  accessory: null,
});

// 整套照状态：sourceFile = 用户新上传的 File；sourceBlob = 当前生效图（可能是旧图）
const sourceFile = ref<File | null>(null);
const sourceBlob = ref<Blob | null>(null);
const sourcePreviewUrl = ref<string>('');
const processing = ref(false);
const processingMsg = ref('');
const errorMsg = ref('');

const pickerFor = ref<Category | null>(null);
const saving = ref(false);

const sceneOptions = computed<SceneTag[]>(() => settingsStore.allScenes);
const bandOptions = computed<number[]>(() => settingsStore.allTempBands);

const itemsById = computed(() => {
  const m = new Map<string, Item>();
  for (const it of items.value) m.set(it.id, it);
  return m;
});

const selectedItemCount = computed(() =>
  Object.values(slotPickers.value).filter(Boolean).length,
);

// URL handles for editor slot previews
const previewUrls = ref<Record<Category, string>>({
  top: '',
  bottom: '',
  shoes_bags: '',
  accessory: '',
});
const previewHandles = ref<Record<Category, string | null>>({
  top: null,
  bottom: null,
  shoes_bags: null,
  accessory: null,
});

function syncPreview(cat: Category) {
  const old = previewHandles.value[cat];
  if (old) URL.revokeObjectURL(old);
  previewHandles.value[cat] = null;
  previewUrls.value[cat] = '';
  const id = slotPickers.value[cat];
  if (!id) return;
  const it = itemsById.value.get(id);
  if (!it) return;
  const url = URL.createObjectURL(it.imageThumb);
  previewUrls.value[cat] = url;
  previewHandles.value[cat] = url;
}

function resetSource() {
  if (sourcePreviewUrl.value) {
    URL.revokeObjectURL(sourcePreviewUrl.value);
    sourcePreviewUrl.value = '';
  }
  sourceFile.value = null;
  sourceBlob.value = null;
  errorMsg.value = '';
}

function loadInitialSourcePhoto(blob: Blob | undefined) {
  resetSource();
  if (!blob) return;
  // 编辑模式：把旧图作为当前生效图（不再压缩）
  sourceBlob.value = blob;
  sourcePreviewUrl.value = URL.createObjectURL(blob);
}

async function handleSourceFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  errorMsg.value = '';
  if (!file.type.startsWith('image/')) {
    errorMsg.value = '请选择图片文件';
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    errorMsg.value = '图片过大（>15MB），请压缩后再上传';
    return;
  }
  if (sourcePreviewUrl.value) URL.revokeObjectURL(sourcePreviewUrl.value);
  sourceFile.value = file;
  sourceBlob.value = null;
  sourcePreviewUrl.value = URL.createObjectURL(file);
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      // 模式推断：
      // 新建（无 id）→ 默认 picker
      // 编辑（有 id）→ 按已有 sourceKind 判断；无 sourceKind 时按有无单品判断
      if (!props.initial?.id) {
        mode.value = 'picker';
      } else if (props.initial.sourceKind === 'photo') {
        mode.value = 'photo';
      } else if (props.initial.sourceKind === 'composed') {
        mode.value = 'picker';
      } else {
        const hasSlots = (props.initial?.items ?? []).some((s) => s.itemId);
        mode.value = hasSlots ? 'picker' : 'photo';
      }
      name.value = props.initial?.name ?? '';
      scene.value = props.initial?.scene ?? '';
      tempBand.value = props.initial?.tempBand ?? null;
      const init = props.initial?.items;
      slotPickers.value = {
        top: null,
        bottom: null,
        shoes_bags: null,
        accessory: null,
      };
      if (init) {
        for (const s of init) {
          if (s.itemId) slotPickers.value[s.category] = s.itemId;
        }
      }
      // 编辑 photo 模式：把旧图作为当前生效图，用户可选择保留或重传
      if (mode.value === 'photo' && props.initial?.sourceKind === 'photo') {
        loadInitialSourcePhoto(props.initial?.sourcePhoto);
      } else {
        resetSource();
      }
      for (const cat of CATEGORY_ORDER) syncPreview(cat);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  },
);

watch(
  () => slotPickers.value,
  () => {
    for (const cat of CATEGORY_ORDER) syncPreview(cat);
  },
  { deep: true },
);

onMounted(() => {
  document.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
  for (const cat of CATEGORY_ORDER) {
    const h = previewHandles.value[cat];
    if (h) URL.revokeObjectURL(h);
  }
  resetSource();
});

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close');
}

function switchMode(next: Mode) {
  if (next === mode.value) return;
  if (isEdit.value) {
    // 编辑模式下不允许切换，避免数据丢失；如需换源请删除后重建
    errorMsg.value = '编辑模式下不能切换方式。若要更换，请先删除该 Look 后重新创建。';
    return;
  }
  mode.value = next;
  errorMsg.value = '';
}

function openPicker(cat: Category) {
  pickerFor.value = cat;
}

function closePicker() {
  pickerFor.value = null;
}

function pickFor(cat: Category, item: Item) {
  slotPickers.value[cat] = item.id;
  pickerFor.value = null;
}

function removeSlot(cat: Category) {
  slotPickers.value[cat] = null;
}

function toggleBand(b: number) {
  tempBand.value = tempBand.value === b ? null : b;
}

function toggleScene(s: SceneTag) {
  scene.value = scene.value === s ? '' : s;
}

function canSave(): boolean {
  if (saving.value || processing.value) return false;
  if (mode.value === 'photo') {
    // 编辑模式下允许保留旧图（无新上传也视为有效）
    if (isEdit.value) return true;
    return sourceFile.value != null;
  }
  return selectedItemCount.value > 0;
}

async function save() {
  if (!canSave()) return;
  saving.value = true;
  errorMsg.value = '';
  try {
    let sourcePhoto: Blob | undefined;
    let sourceKind: 'composed' | 'photo' | undefined;
    processing.value = true;

    if (mode.value === 'photo') {
      if (sourceFile.value) {
        // 新上传（或替换旧图）：压缩后作为效果图
        processingMsg.value = '正在压缩图片…';
        const { thumb } = await compressImage(sourceFile.value, {
          fullLongEdge: 640,
          thumbLongEdge: 480,
          quality: 0.72,
        });
        sourcePhoto = thumb;
        sourceKind = 'photo';
      } else if (isEdit.value && sourceBlob.value) {
        // 编辑模式下保留旧整套照
        sourcePhoto = sourceBlob.value;
        sourceKind = 'photo';
      }
    } else if (mode.value === 'picker') {
      // 从衣柜挑选：合成 4 件套效果图
      processingMsg.value = '正在生成效果图…';
      const slots = CATEGORY_ORDER.map((cat) => {
        const id = slotPickers.value[cat];
        const it = id ? itemsById.value.get(id) : undefined;
        return {
          blob: it?.imageThumb ?? null,
          label: CATEGORY_LABELS[cat],
          icon: CATEGORY_ICONS[cat],
        };
      });
      sourcePhoto = await compositeOutfitImage(slots);
      sourceKind = 'composed';
    }

    processingMsg.value = '正在保存…';
    const payload = {
      name: name.value.trim() || undefined,
      scene: scene.value === '' ? null : scene.value,
      tempBand: tempBand.value,
      items: CATEGORY_ORDER.map((cat) => ({
        category: cat,
        itemId: slotPickers.value[cat],
      })),
      sourcePhoto,
      sourceKind,
      source: 'manual' as const,
    };
    const look = isEdit.value && props.initial?.id
      ? await looksStore.updateLook(props.initial.id, payload)
      : await looksStore.createLook(payload);
    emit('saved', look);
    emit('close');
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '保存失败，请重试';
  } finally {
    saving.value = false;
    processing.value = false;
  }
}

async function deleteCurrent() {
  if (!isEdit.value || !props.initial?.id) return;
  if (!confirm('确定要删除这条 Look 吗？')) return;
  await looksStore.deleteLook(props.initial.id);
  emit('close');
}

// Picker candidates: 所有该类目单品
const pickerCandidates = computed<Item[]>(() => {
  if (!pickerFor.value) return [];
  return items.value.filter((i) => i.category === pickerFor.value);
});
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-end justify-center"
    role="dialog"
    aria-modal="true"
    aria-label="新建 Look"
  >
    <button
      class="absolute inset-0 bg-black/40 backdrop-blur-sm"
      aria-label="关闭"
      @click="emit('close')"
    />

    <div
      class="glass-strong relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl p-5 pb-8"
    >
      <header class="mb-4 flex items-center justify-between">
        <h3 class="display text-xl">
          {{ isEdit ? '编辑' : '新建' }}<span class="text-accent">Look</span>
        </h3>
        <button
          class="btn btn-ghost !rounded-full !px-2 !py-1 text-lg leading-none"
          aria-label="关闭"
          @click="emit('close')"
        >✕</button>
      </header>

      <!-- Mode switch -->
      <div
        class="mb-4 grid grid-cols-2 gap-1.5 p-1"
        style="background: var(--color-paper); box-shadow: var(--neu-in-soft); border: 1px solid var(--glass-border-soft); border-radius: 16px;"
      >
        <button
          type="button"
          class="flex flex-col items-start rounded-xl px-3 py-2 text-left transition-colors"
          :class="mode === 'picker' ? 'text-white' : 'text-ink-mute hover:text-ink'"
          :style="mode === 'picker' ? 'background: linear-gradient(140deg, var(--color-primary-glow), var(--color-primary-deep)); box-shadow: var(--shadow-primary-out);' : ''"
          :aria-pressed="mode === 'picker'"
          @click="switchMode('picker')"
        >
          <span class="text-sm font-semibold">从衣柜挑选</span>
          <span class="text-[10px] opacity-90">合成 4 件套效果图</span>
        </button>
        <button
          type="button"
          class="flex flex-col items-start rounded-xl px-3 py-2 text-left transition-colors"
          :class="mode === 'photo' ? 'text-white' : 'text-ink-mute hover:text-ink'"
          :style="mode === 'photo' ? 'background: linear-gradient(140deg, var(--color-primary-glow), var(--color-primary-deep)); box-shadow: var(--shadow-primary-out);' : ''"
          :aria-pressed="mode === 'photo'"
          @click="switchMode('photo')"
        >
          <span class="text-sm font-semibold">上传整套照</span>
          <span class="text-[10px] opacity-90">上传即所得</span>
        </button>
      </div>

      <!-- Name -->
      <label class="mb-3 block">
        <span class="mb-1 block text-xs font-bold tracking-widest uppercase text-ink-mute">
          名称
        </span>
        <input
          v-model="name"
          type="text"
          class="neu-in-soft w-full rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="例如：通勤·秋日"
        />
      </label>

      <!-- Scene -->
      <div class="mb-3">
        <p class="mb-1.5 text-xs font-bold tracking-widest uppercase text-ink-mute">场景</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="s in sceneOptions"
            :key="s"
            class="chip"
            :class="scene === s ? 'chip-active' : ''"
            :aria-pressed="scene === s"
            @click="toggleScene(s)"
          >
            <span class="font-mono">#</span>{{ s }}
          </button>
        </div>
      </div>

      <!-- Temp band -->
      <div class="mb-4">
        <p class="mb-1.5 text-xs font-bold tracking-widest uppercase text-ink-mute">
          温度档 <span class="text-ink-mute/70">（可选）</span>
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="b in bandOptions"
            :key="b"
            class="chip"
            :class="tempBand === b ? 'chip-active' : ''"
            :aria-pressed="tempBand === b"
            @click="toggleBand(b)"
          >
            {{ b }}°
          </button>
        </div>
      </div>

      <!-- Mode: picker（4 件套） -->
      <div v-if="mode === 'picker'" class="mb-5">
        <p class="mb-2 text-xs font-bold tracking-widest uppercase text-ink-mute">
          4 件套
          <span class="ml-1 font-mono text-[10px] text-ink-mute/80">
            {{ selectedItemCount }} / 4
          </span>
        </p>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="cat in CATEGORY_ORDER"
            :key="cat"
            type="button"
            class="neu-out group relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition-transform hover:-translate-y-0.5"
            @click="openPicker(cat)"
          >
            <div
              class="relative aspect-square w-full overflow-hidden rounded-lg"
              :class="previewUrls[cat] ? 'neu-in-soft' : 'neu-in-soft border-2 border-dashed'"
              :style="!previewUrls[cat] ? { borderColor: 'var(--color-line-strong)' } : {}"
            >
              <img
                v-if="previewUrls[cat]"
                :src="previewUrls[cat]"
                :alt="CATEGORY_LABELS[cat]"
                class="h-full w-full object-cover"
              />
              <div
                v-else
                class="flex h-full w-full flex-col items-center justify-center text-center"
              >
                <span class="text-sm opacity-60" aria-hidden="true">{{ CATEGORY_ICONS[cat] }}</span>
                <span class="text-[9px] font-semibold ink-mute">选</span>
              </div>
              <button
                v-if="slotPickers[cat]"
                class="glass-hairline absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                aria-label="移除"
                @click.stop="removeSlot(cat)"
              >✕</button>
            </div>
            <span class="text-[10px] font-semibold tracking-wide ink">
              {{ CATEGORY_LABELS[cat] }}
            </span>
          </button>
        </div>
      </div>

      <!-- Mode: photo（整套照上传） -->
      <div v-else class="mb-5">
        <p class="mb-2 text-xs font-bold tracking-widest uppercase text-ink-mute">
          整套搭配照
          <span class="ml-1 font-mono text-[10px] text-ink-mute/80">
            单张 · 建议 4:5 / 3:4
          </span>
        </p>

        <label
          class="flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center"
          style="border-color: var(--glass-border-soft);"
        >
          <input
            type="file"
            accept="image/*"
            class="hidden"
            :disabled="saving || processing"
            @change="handleSourceFileInput"
          />
          <template v-if="!sourcePreviewUrl">
            <span class="text-4xl ink-mute" aria-hidden="true">📷</span>
            <span class="mt-3 text-sm font-semibold">点击选择或拍照</span>
            <span class="mt-1 text-xs ink-mute">
              一张照片记录整套搭配，无需逐个单品
            </span>
            <span class="mt-1 text-xs ink-mute">支持 JPG / PNG / HEIC，≤15MB</span>
          </template>
          <template v-else>
            <img
              :src="sourcePreviewUrl"
              alt="整套搭配预览"
              class="max-h-[260px] w-auto rounded-xl object-contain"
            />
            <span class="mt-2 text-xs ink-mute">点击重新选择</span>
          </template>
        </label>
        <p v-if="sourceFile || sourceBlob" class="mt-2 text-xs ink-mute">
          提示：这条 Look 保存后以整套照展示，4 件套槽位为空。
        </p>
      </div>

      <!-- Error -->
      <p v-if="errorMsg" class="mb-3 text-sm" style="color: var(--color-primary-deep);">
        {{ errorMsg }}
      </p>

      <!-- Actions -->
      <div class="flex items-center gap-2 border-t border-line pt-3">
        <button
          v-if="isEdit"
          class="btn btn-ghost flex-1 !rounded-full !py-2.5"
          style="color: var(--color-primary-deep);"
          :disabled="saving || processing"
          @click="deleteCurrent"
        >删除</button>
        <button
          class="btn btn-ghost flex-1 !rounded-full !py-2.5"
          :disabled="saving || processing"
          @click="emit('close')"
        >取消</button>
        <button
          class="btn btn-primary flex-1 !rounded-full !py-2.5"
          :disabled="!canSave()"
          :aria-busy="saving || processing"
          @click="save"
        >
          <span aria-hidden="true">✓</span>
          <span v-if="processing">{{ processingMsg }}</span>
          <span v-else-if="saving">保存中…</span>
          <span v-else>{{ isEdit ? '保存修改' : '保存 Look' }}</span>
        </button>
      </div>

      <!-- Slot picker -->
      <div
        v-if="pickerFor"
        class="fixed inset-0 z-50 flex items-end justify-center"
        role="dialog"
        aria-modal="true"
        :aria-label="'选择' + (pickerFor ? CATEGORY_LABELS[pickerFor] : '')"
      >
        <button
          class="absolute inset-0 bg-black/50"
          aria-label="关闭"
          @click="closePicker"
        />
        <div
          class="glass-strong relative z-10 max-h-[70vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl p-5 pb-8"
        >
          <header class="mb-3 flex items-center justify-between">
            <h4 class="display text-lg">
              选择<span class="text-accent">{{ pickerFor ? CATEGORY_LABELS[pickerFor] : '' }}</span>
            </h4>
            <button
              class="btn btn-ghost !rounded-full !px-2 !py-1 text-lg leading-none"
              aria-label="关闭"
              @click="closePicker"
            >✕</button>
          </header>

          <div
            v-if="pickerCandidates.length > 0"
            class="grid grid-cols-4 gap-2 md:grid-cols-6"
          >
            <button
              v-for="it in pickerCandidates"
              :key="it.id"
              class="neu-out group overflow-hidden rounded-xl p-1"
              :class="slotPickers[pickerFor!] === it.id ? 'ring-2 ring-primary' : ''"
              @click="pickFor(pickerFor!, it)"
            >
              <ItemThumb :item="it" className="h-20 w-full rounded-lg object-cover" />
              <div class="flex flex-wrap gap-0.5 p-1">
                <span
                  v-for="s in it.scenes.slice(0, 2)"
                  :key="s"
                  class="chip !px-1 !py-0 !text-[9px]"
                >#{{ s }}</span>
              </div>
            </button>
          </div>
          <div
            v-else
            class="flex flex-col items-center justify-center py-10 text-center"
          >
            <div class="mb-2 text-4xl opacity-30" aria-hidden="true">🔍</div>
            <p class="text-sm ink-soft">
              衣柜里还没有{{ pickerFor ? CATEGORY_LABELS[pickerFor] : '该类目' }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
