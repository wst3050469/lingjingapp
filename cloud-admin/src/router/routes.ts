import type { RouteRecordRaw } from 'vue-router';

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/components/layout/AppLayout.vue'),
    children: [
      { path: '', name: 'Dashboard', component: () => import('@/views/dashboard/DashboardPage.vue') },
      { path: 'devices', name: 'Devices', component: () => import('@/views/devices/DevicePage.vue') },
      { path: 'sessions', name: 'Sessions', component: () => import('@/views/sessions/SessionPage.vue') },
      { path: 'skills', name: 'Skills', component: () => import('@/views/skills/SkillPage.vue') },
      { path: 'memories', name: 'Memories', component: () => import('@/views/memories/MemoryPage.vue') },
      { path: 'push', name: 'Push', component: () => import('@/views/push/PushPage.vue') },
      { path: 'defects', name: 'Defects', component: () => import('@/views/defects/DefectPage.vue') },
      { path: 'config', name: 'Config', component: () => import('@/views/config/ConfigPage.vue') },
      { path: 'logs', name: 'Logs', component: () => import('@/views/logs/LogPage.vue') },
      { path: 'versions', name: 'Versions', component: () => import('@/views/versions/VersionPage.vue') },
      { path: 'users', name: 'Users', component: () => import('@/views/users/UserPage.vue') },
      { path: 'subscriptions', name: 'Subscriptions', component: () => import('@/views/subscriptions/SubscriptionPage.vue') },
      { path: 'payments', name: 'Payments', component: () => import('@/views/payments/PaymentPage.vue') },
    ],
  },
];
