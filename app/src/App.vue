<template>
  <router-view v-slot="{ Component }">
    <component :is="Component" />
  </router-view>

  <van-tabbar route placeholder active-color="#1989fa" inactive-color="#7d7e80">
    <van-tabbar-item to="/" icon="home-o">首页</van-tabbar-item>
    <van-tabbar-item to="/vault" icon="apps-o">全部</van-tabbar-item>
  </van-tabbar>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { showToast } from 'vant'
import { useVaultStore } from '@/stores/vault'
import { App as CapApp } from '@capacitor/app'

// 底部导航用 route 模式：点击自动跳转，不用手动处理状态。
// 设置放在首页右上角（不去底部），底部只留首页和全部两个主界面。
// 这里不用 keep-alive：密码数据解锁后需要实时反映增删改，缓存会让列表显示旧内容。

// 后台自动锁定：App 切到后台并超过设定时间后再回到前台，自动锁定。
const vault = useVaultStore()
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
