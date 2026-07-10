import type { RouteRecordRaw } from 'vue-router';

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/LoginPage.vue'),
    meta: { title: '管理员登录', public: true },
  },
  {
    path: '/',
    component: () => import('@/components/layout/AppLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/dashboard/DashboardPage.vue'), meta: { title: '仪表盘', icon: 'dashboard' } },
      { path: 'users', name: 'Users', component: () => import('@/views/users/UserPage.vue'), meta: { title: '用户管理', icon: 'team' } },
      { path: 'tenants', name: 'Tenants', component: () => import('@/views/tenants/TenantPage.vue'), meta: { title: '租户管理', icon: 'building' } },
      { path: 'contracts', name: 'Contracts', component: () => import('@/views/contracts/ContractPage.vue'), meta: { title: '合同管理', icon: 'file-text' } },
      { path: 'suppliers', name: 'Suppliers', component: () => import('@/views/suppliers/SupplierPage.vue'), meta: { title: '供应商管理', icon: 'shop' } },
      { path: 'customers', name: 'Customers', component: () => import('@/views/customers/CustomerPage.vue'), meta: { title: '客户管理', icon: 'user' } },
      { path: 'invoices', name: 'Invoices', component: () => import('@/views/invoices/InvoicePage.vue'), meta: { title: '发票管理', icon: 'audit' } },
      { path: 'finance', name: 'Finance', component: () => import('@/views/finance/FinancePage.vue'), meta: { title: '财务管理', icon: 'dollar' } },
      { path: 'versions', name: 'Versions', component: () => import('@/views/versions/VersionPage.vue'), meta: { title: '版本管理', icon: 'tags' } },
      { path: 'audit-logs', name: 'AuditLogs', component: () => import('@/views/logs/LogPage.vue'), meta: { title: '审计日志', icon: 'safety' } },
      { path: 'sessions', name: 'Sessions', component: () => import('@/views/sessions/SessionPage.vue'), meta: { title: '会话管理', icon: 'message' } },
      { path: 'samples', name: 'Samples', component: () => import('@/views/samples/SamplePage.vue'), meta: { title: '样本管理', icon: 'book' } },
      { path: 'recipes', name: 'Recipes', component: () => import('@/views/recipes/RecipePage.vue'), meta: { title: '配方管理', icon: 'experiment' } },
      { path: 'automation', name: 'Automation', component: () => import('@/views/automation/AutomationPage.vue'), meta: { title: '自动化任务', icon: 'thunderbolt' } },
      { path: 'websocket', name: 'WebSocket', component: () => import('@/views/websocket/WebSocketPage.vue'), meta: { title: '在线监控', icon: 'api' } },
    ],
  },
];
