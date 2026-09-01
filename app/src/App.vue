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
// 底部导航用 route 模式：点击自动跳转，不用手动处理状态。
// 设置放在首页右上角（不去底部），底部只留首页和全部两个主界面。
// 这里不用 keep-alive：密码数据解锁后需要实时反映增删改，缓存会让列表显示旧内容。
</script>
