import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from 'unplugin-vue-components/resolvers'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  /**
   * GitHub Pages 的地址带仓库名（/仓库名/），不配这个前缀会白屏。
   * 本地开发不用管，自动走根路径。
   */
  base: process.env.BASE_PATH || '/',

  plugins: [
    vue(),

    // Vant 组件按需自动引入：模板里直接写 <van-button /> 即可，不用手动 import
    Components({
      resolvers: [VantResolver()],
      dts: 'src/components.d.ts',
    }),

    // PWA：让 H5 能"安装到桌面"，离线也能打开
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: '工具箱',
        short_name: '工具箱',
        description: '一个轻量好用的随身工具箱',
        theme_color: '#1989fa',
        background_color: '#f7f8fa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // 云端只读内容：网络优先，取不到就用缓存兜底（离线可用）
            urlPattern: /^https:\/\/.*\/(content|data)\/.*\.json$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'remote-content',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // 开发时关闭，避免缓存干扰调试
      },
    }),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  /**
   * 把用到的 Vant 组件写死进预构建列表。
   * 不写的话，每用到一个新组件 Vite 才现场预构建，页面会闪一下
   * "new dependencies optimized, reloading"，开发体验差。
   * 新增 Vant 组件时记得同步加到这里。
   */
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      'vant/es/button',
      'vant/es/cell',
      'vant/es/field',
      'vant/es/grid',
      'vant/es/grid-item',
      'vant/es/icon',
      'vant/es/popup',
      'vant/es/swipe-cell',
      'vant/es/tab',
      'vant/es/tabbar',
      'vant/es/tabbar-item',
      'vant/es/tabs',
    ],
  },

  server: {
    host: true, // 允许手机连同一 WiFi 用局域网 IP 访问，方便真机调试
    port: 5173,
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
})
