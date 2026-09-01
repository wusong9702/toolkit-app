import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * 用 hash 模式而不是 history 模式，原因很重要：
 * Capacitor 打包成 App 后，页面是 file:// 协议加载的，
 * history 模式的 /ledger 这种路径会找不到资源，hash 模式（/#/ledger）不会。
 * 这一步如果一开始选错，后面打包完打开就是白屏，很难排查。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: '工具箱', keepAlive: true },
    },
    {
      path: '/ledger',
      name: 'Ledger',
      component: () => import('@/views/LedgerView.vue'),
      meta: { title: '记一笔' },
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '设置' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.afterEach((to) => {
  const title = (to.meta.title as string) || '工具箱'
  document.title = title
})

export default router
