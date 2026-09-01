import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

import 'vant/lib/index.css'
import './styles/global.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// 原生环境下（打包成 App 后）额外做的初始化
// 网页里跑时这些模块不存在，用动态导入避免报错
async function initNative() {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Light })
  } catch {
    // 浏览器环境，忽略
  }
}
initNative()

app.mount('#app')
