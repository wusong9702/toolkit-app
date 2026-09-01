<template>
  <div class="page">
    <div class="hero">
      <div class="hero-title">随身工具箱</div>
      <div class="hero-sub">轻量、离线可用、随时扩展</div>
    </div>

    <!-- 云端公告：内容来自云端 JSON，改文件即可换文案，不用发版 -->
    <div v-if="store.contentMeta.notice" class="card notice">
      <van-icon name="volume-o" />
      <span>{{ store.contentMeta.notice }}</span>
    </div>

    <div class="card">
      <div class="section-label">常用工具</div>
      <van-grid :column-num="3" :gutter="8" clickable>
        <van-grid-item
          v-for="tool in tools"
          :key="tool.name"
          :icon="tool.icon"
          :text="tool.name"
          :to="tool.to || undefined"
          @click="onToolClick(tool)"
        />
      </van-grid>
    </div>

    <div class="card">
      <div class="section-label">今日一览</div>
      <div class="stat-row">
        <div class="stat">
          <div class="stat-value">¥{{ todayExpense.toFixed(2) }}</div>
          <div class="stat-label">今日支出</div>
        </div>
        <div class="stat">
          <div class="stat-value">{{ todayCount }}</div>
          <div class="stat-label">今日笔数</div>
        </div>
        <div class="stat">
          <div class="stat-value">{{ store.records.length }}</div>
          <div class="stat-label">累计记录</div>
        </div>
      </div>
    </div>

    <div class="card tip-card">
      <div class="section-label">小贴士</div>
      <p class="tip-text">
        在浏览器里点右上角「安装」，可以把这个网页装到手机桌面，
        图标和原生 App 一样，断网也能打开。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { showToast } from 'vant'
import { useLedgerStore } from '@/stores/ledger'

const store = useLedgerStore()

interface Tool {
  name: string
  icon: string
  to: string
  coming?: boolean
}

const tools: Tool[] = [
  { name: '记一笔', icon: 'records', to: '/ledger' },
  { name: '设置', icon: 'setting-o', to: '/settings' },
  { name: '待开发', icon: 'add-o', to: '', coming: true },
]

function onToolClick(tool: Tool) {
  if (tool.coming) showToast('这里放你自己的功能')
}

const today = new Date().toLocaleDateString('zh-CN')

const todayRecords = computed(() =>
  store.records.filter((r) => new Date(r.createdAt).toLocaleDateString('zh-CN') === today),
)
const todayExpense = computed(() =>
  todayRecords.value.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
)
const todayCount = computed(() => todayRecords.value.length)

onMounted(() => {
  if (!store.categories.length) store.loadContent()
})
</script>

<style scoped>
.hero {
  padding: 28px 20px 20px;
  background: linear-gradient(135deg, #1989fa 0%, #4facfe 100%);
  color: #fff;
}
.hero-title {
  font-size: 24px;
  font-weight: 700;
}
.hero-sub {
  margin-top: 6px;
  font-size: 13px;
  opacity: 0.85;
}
.section-label {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}
.notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 13px;
  color: #ed6a0c;
  background: #fff7e8;
}
.stat-row {
  display: flex;
}
.stat {
  flex: 1;
  text-align: center;
}
.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #323233;
}
.stat-label {
  margin-top: 4px;
  font-size: 12px;
  color: #969799;
}
.tip-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: #646566;
}
</style>
