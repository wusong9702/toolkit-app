<template>
  <router-view v-slot="{ Component }">
    <keep-alive>
      <component :is="Component" />
    </keep-alive>
  </router-view>

  <van-tabbar route placeholder active-color="#1989fa" inactive-color="#7d7e80">
    <van-tabbar-item to="/" icon="apps-o">工具</van-tabbar-item>
    <van-tabbar-item to="/ledger" icon="records">记账</van-tabbar-item>
    <van-tabbar-item to="/settings" icon="setting-o">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script setup lang="ts">
// 底部导航用 route 模式：点击自动跳转，不用手动处理状态
</script>
