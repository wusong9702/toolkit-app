import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * 用 hash 模式而不是 history 模式，原因很重要：
 * Capacitor 打包成 App 后，页面是 file:// 协议加载的，
 * history 模式的 /vault 这种路径会找不到资源，hash 模式（/#/vault）不会。
 * 这一步如果一开始选错，后面打包完打开就是白屏，很难排查。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      // 首页：搜索栏 + 收藏 + 分组，右上角进设置
      path: '/',
      name: 'Home',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: '密码本' },
    },
    {
      // 全部密码列表，支持 ?group=xxx 按分组/标签筛选
      path: '/vault',
      name: 'Vault',
      component: () => import('@/views/PasswordVaultView.vue'),
      meta: { title: '全部密码' },
    },
    {
      path: '/vault/edit',
      name: 'VaultEdit',
      component: () => import('@/views/VaultEditView.vue'),
      meta: { title: '密码条目' },
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '设置' },
    },
    {
      path: '/generator',
      name: 'Generator',
      component: () => import('@/views/GeneratorView.vue'),
      meta: { title: '密码生成器' },
    },
    {
      path: '/trash',
      name: 'Trash',
      component: () => import('@/views/TrashView.vue'),
      meta: { title: '回收站' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.afterEach((to) => {
  const title = (to.meta.title as string) || '密码本'
  document.title = title
})

export default router
