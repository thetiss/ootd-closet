import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/pages/HomeView.vue';
import WardrobeView from '@/pages/WardrobeView.vue';
import UploadFlowView from '@/pages/UploadFlowView.vue';
import LookbookView from '@/pages/LookbookView.vue';
import SettingsView from '@/pages/SettingsView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/wardrobe', name: 'wardrobe', component: WardrobeView },
    { path: '/wardrobe/upload', name: 'upload', component: UploadFlowView },
    { path: '/wardrobe/:id', name: 'item-detail', component: WardrobeView, meta: { placeholder: '单品详情' } },
    { path: '/lookbook', name: 'lookbook', component: LookbookView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
});

export default router;
