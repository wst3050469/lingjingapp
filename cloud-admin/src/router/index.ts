import { createRouter, createWebHistory } from 'vue-router';
import { routes } from './routes';

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes,
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('app_admin_token');
  if (to.meta.public) {
    if (token && to.name === 'Login') {
      next({ path: '/' });
      return;
    }
    next();
    return;
  }
  if (!token) {
    next({ path: '/login', query: { redirect: to.fullPath } });
    return;
  }
  next();
});

export default router;