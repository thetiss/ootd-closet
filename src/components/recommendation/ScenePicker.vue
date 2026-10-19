<script setup lang="ts">
/* Hallmark · component: scene-picker · dropdown chip list
 * states: closed · open · disabled
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { SceneTag } from '@/types';

const props = withDefaults(
  defineProps<{
    scenes: SceneTag[];
    modelValue: SceneTag;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  change: [scene: SceneTag];
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

function handleClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) {
    open.value = false;
  }
}

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
}

function select(scene: SceneTag) {
  emit('change', scene);
  open.value = false;
}
</script>

<template>
  <div ref="root" class="relative inline-flex items-center">
    <button
      type="button"
      class="chip-active !rounded-full"
      :class="disabled ? 'cursor-not-allowed opacity-60' : ''"
      :disabled="disabled"
      @click="toggle"
      aria-haspopup="listbox"
      :aria-expanded="open ? 'true' : 'false'"
    >
      <span class="font-mono">#</span>{{ modelValue }}
      <span aria-hidden="true" class="text-[9px] opacity-70">▾</span>
    </button>

    <div
      v-if="open"
      class="glass-strong absolute left-0 z-30 mt-1 w-44 rounded-2xl p-1.5"
      role="listbox"
    >
      <button
        v-for="s in scenes"
        :key="s"
        class="mb-1 flex w-full items-center gap-1 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-colors last:mb-0"
        :class="
          s === modelValue
            ? 'bg-accent/15 text-accent'
            : 'text-ink-soft hover:bg-white/50'
        "
        role="option"
        :aria-selected="s === modelValue ? 'true' : 'false'"
        @click="select(s)"
      >
        <span class="font-mono text-ink-mute">#</span>{{ s }}
        <span
          v-if="s === modelValue"
          aria-hidden="true"
          class="ml-auto text-accent"
        >✓</span>
      </button>
    </div>
  </div>
</template>
