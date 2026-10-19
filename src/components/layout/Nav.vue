<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const tabs = computed(() => [
  { to: '/',          name: '今日',   icon: '◐' },
  { to: '/wardrobe',  name: '衣柜',   icon: '◈' },
  { to: '/lookbook',  name: 'Look',   icon: '❋' },
  { to: '/settings',  name: '设置',   icon: '⚙' },
]);

function isActive(path: string): boolean {
  return route.path === path;
}
</script>

<template>
  <nav
    class="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2"
    aria-label="主导航"
  >
    <div
      class="glass-strong relative flex items-end justify-around rounded-[28px] px-3 pt-3 pb-3 safe-bottom"
    >
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="group relative flex w-[72px] flex-col items-center gap-1 py-1"
        :class="isActive(tab.to) ? 'is-active' : ''"
        :aria-current="isActive(tab.to) ? 'page' : undefined"
      >
        <!-- Active indicator pill — bold prussian indigo -->
        <span
          class="absolute -top-1 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full transition-opacity"
          :class="isActive(tab.to) ? 'opacity-100' : 'opacity-0'"
          style="background: linear-gradient(90deg, var(--color-primary-glow), var(--color-primary-deep));"
        />
        <!-- Icon well — SOLID indigo when active -->
        <span
          class="flex h-11 w-11 items-center justify-center rounded-full text-[22px] leading-none transition-all"
          :class="isActive(tab.to) ? '' : 'text-[var(--color-ink-mute)]'"
          :style="{
            background: isActive(tab.to)
              ? 'linear-gradient(150deg, var(--color-accent-glow), var(--color-accent-deep))'
              : 'var(--color-paper)',
            boxShadow: isActive(tab.to)
              ? 'var(--shadow-accent-out)'
              : '-3px -3px 8px oklch(100% 0.003 240 / 0.70), 3px 3px 8px oklch(82% 0.020 240 / 0.32)',
            color: isActive(tab.to) ? 'white' : '',
          }"
        >
          {{ tab.icon }}
        </span>
        <span
          class="text-[11px] font-semibold tracking-wide"
          :class="isActive(tab.to) ? 'text-primary' : 'text-[var(--color-ink-mute)]'"
        >
          {{ tab.name }}
        </span>
      </RouterLink>
    </div>
  </nav>
</template>
