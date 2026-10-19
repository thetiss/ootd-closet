<script setup lang="ts">
/* Hallmark · component: look-editor · 手动新建 Look（bottom sheet 表单）
 * states: open · closed · saving
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import type { Category, Item, Look, SceneTag } from '@/types';
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_ORDER } from '@/utils/constants';
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

const name = ref('');
const scene = ref<SceneTag | ''>('');
const tempBand = ref<number | null>(null);
const slotPickers = ref<Record<Category, string | null>>({
  top: null,
  bottom: null,
  shoes_bags: null,
  accessory: null,
});

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

watch(
  () => props.open,
  (v) => {
    if (v) {
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
});

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close');
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
  return selectedItemCount.value > 0 && !saving.value;
}

async function save() {
  if (!canSave()) return;
  saving.value = true;
  try {
    const look = await looksStore.createLook({
      name: name.value.trim() || undefined,
      scene: scene.value === '' ? null : scene.value,
      tempBand: tempBand.value,
      items: CATEGORY_ORDER.map((cat) => ({
        category: cat,
        itemId: slotPickers.value[cat],
      })),
      source: 'manual',
    });
    emit('saved', look);
    emit('close');
  } finally {
    saving.value = false;
  }
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
          新建<span class="text-accent">Look</span>
        </h3>
        <button
          class="btn btn-ghost !rounded-full !px-2 !py-1 text-lg leading-none"
          aria-label="关闭"
          @click="emit('close')"
        >✕</button>
      </header>

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

      <!-- 4 slots -->
      <div class="mb-5">
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

      <!-- Actions -->
      <div class="flex items-center gap-2 border-t border-line pt-3">
        <button
          class="btn btn-ghost flex-1 !rounded-full !py-2.5"
          @click="emit('close')"
        >取消</button>
        <button
          class="btn btn-primary flex-1 !rounded-full !py-2.5"
          :disabled="!canSave()"
          :aria-busy="saving"
          @click="save"
        >
          <span aria-hidden="true">✓</span>
          <span>{{ saving ? '保存中…' : '保存 Look' }}</span>
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
