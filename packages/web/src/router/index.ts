import { createRouter, createWebHashHistory } from 'vue-router';
import Login from '../pages/Login.vue';
import Accounts from '../pages/Accounts.vue';
import Modules from '../pages/Modules.vue';
import Logs from '../pages/Logs.vue';

const routes = [
  { path: '/login', component: Login },
  { path: '/accounts', component: Accounts },
  { path: '/modules', component: Modules },
  { path: '/logs', component: Logs },
  { path: '/', redirect: '/modules' },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
