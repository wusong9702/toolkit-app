<template>
  <van-config-provider :theme="themeClass" :theme-vars="themeVars">
    <div class="app-root" :class="{ dark: ui.isDark }" :style="{ '--accent': ui.accent }">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>

      <van-tabbar route placeholder :active-color="ui.accent" inactive-color="#7d7e80">
        <van-tabbar-item to="/" icon="home-o">首页</van-tabbar-item>
        <van-tabbar-item to="/vault" icon="apps-o">全部</van-tabbar-item>
      </van-tabbar>
    </div>
  </van-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { showToast } from 'vant'
import { useVaultStore } from '@/stores/vault'
import { useUiStore } from '@/stores/ui'
import { App as CapApp } from '@capacitor/app'

// 底部导航用 route 模式：点击自动跳转，不用手动处理状态。
// 设置放在首页右上角（不去底部），底部只留首页和全部两个主界面。
// 这里不用 keep-alive：密码数据解锁后需要实时反映增删改，缓存会让列表显示旧内容。

const vault = useVaultStore()
const ui = useUiStore()

// 把深色模式同步到 <html>，让原生滚动条/输入框也跟随（color-scheme）。
watch(
  () => ui.isDark,
  (dark) => {
    document.documentElement.classList.toggle('dark', dark)
  },
  { immediate: true },
)

// Vant 组件主题 + 强调色：config-provider 的 theme-vars 覆盖 Vant 的 CSS 变量
const themeClass = computed(() => (ui.isDark ? 'dark' : 'light'))
const themeVars = computed(() => ({
  'primary-color': ui.accent,
  'button-primary-background-color': ui.accent,
  'button-primary-border-color': ui.accent,
  'radio-checked-icon-color': ui.accent,
  'tabbar-item-active-color': ui.accent,
}))

// 后台自动锁定：App 切到后台并超过设定时间后再回到前台，自动锁定。
let backgroundAt = 0

function checkAutoLock() {
  const limit = vault.autoLockSeconds
  if (limit > 0 && backgroundAt && vault.unlocked && Date.now() - backgroundAt > limit * 1000) {
    vault.lock()
    backgroundAt = 0
    showToast('已后台自动锁定')
  }
}

onMounted(() => {
  // 原生端：应用前后台切换
  try {
    CapApp.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
      if (!isActive) backgroundAt = Date.now()
      else checkAutoLock()
    })
  } catch {
    /* 浏览器环境无原生生命周期，走下面的 visibilitychange */
  }
  // Web 端：标签页隐藏/显示
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) backgroundAt = Date.now()
    else checkAutoLock()
  })
})
</script>
