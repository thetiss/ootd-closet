<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    options: number[];
    modelValue: number[];
    max?: number;
  }>(),
  { max: 3 },
);

const emit = defineEmits<{
  'update:modelValue': [value: number[]];
}>();

const selected = computed(() => props.modelValue);
const atLimit = computed(() => selected.value.length >= props.max);

function toggle(band: number) {
  const has = selected.value.includes(band);
  if (has) {
    emit('update:modelValue', selected.value.filter((b) => b !== band));
    return;
  }
  if (atLimit.value) return;
  emit('update:modelValue', [...selected.value, band]);
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="band in options"
      :key="band"
      type="button"
      class="chip"
      :class="selected.includes(band) ? 'chip-active' : ''"
      :aria-pressed="selected.includes(band)"
      :disabled="!selected.includes(band) && atLimit"
      @click="toggle(band)"
    >
      <span class="font-mono">{{ band }}°</span>
    </button>
  </div>
</template>
