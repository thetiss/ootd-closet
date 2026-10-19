<script setup lang="ts">
import { computed } from 'vue';
import type { SceneTag } from '@/types';

const props = withDefaults(
  defineProps<{
    options: SceneTag[];
    modelValue: SceneTag[];
    max?: number;
  }>(),
  { max: 4 },
);

const emit = defineEmits<{
  'update:modelValue': [value: SceneTag[]];
}>();

const selected = computed(() => props.modelValue);
const atLimit = computed(() => selected.value.length >= props.max);

function toggle(tag: SceneTag) {
  const has = selected.value.includes(tag);
  if (has) {
    emit('update:modelValue', selected.value.filter((t) => t !== tag));
    return;
  }
  if (atLimit.value) return;
  emit('update:modelValue', [...selected.value, tag]);
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="tag in options"
      :key="tag"
      type="button"
      class="chip"
      :class="selected.includes(tag) ? 'chip-active' : ''"
      :aria-pressed="selected.includes(tag)"
      :disabled="!selected.includes(tag) && atLimit"
      @click="toggle(tag)"
    >
      <span class="font-mono">#</span>{{ tag }}
    </button>
  </div>
</template>
