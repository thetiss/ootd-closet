<script setup lang="ts">
import { RouterView } from 'vue-router';
import AppNav from '@/components/layout/Nav.vue';
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-2xl flex-col pb-28">
    <main class="flex-1 overflow-visible px-5 pt-5">
      <RouterView />
    </main>
    <AppNav />
  </div>
</template>
