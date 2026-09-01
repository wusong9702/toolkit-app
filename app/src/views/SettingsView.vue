<template>
  <div class="page">
    <h2 class="page-title">设置</h2>

    <!-- 云端内容源 -->
    <div class="card">
      <div class="section-label">内容数据源</div>
      <p class="hint">
        填一个返回 JSON 的地址，App 启动时会去拉取。改这里的内容不用重新发版上架。
      </p>
      <van-field v-model="url" label="地址" placeholder="content/categories.json" />
      <div class="btn-row">
        <van-button size="small" type="primary" @click="onSaveUrl">保存</van-button>
        <van-button size="small" plain :loading="store.contentLoading" @click="onRefresh">
          立即刷新
        </van-button>
        <van-button size="small" plain @click="onResetUrl">恢复默认</van-button>
      </div>
      <div class="meta">
        <span>内容版本 {{ store.contentMeta.version }}</span>
        <span>更新于 {{ store.contentMeta.updatedAt }}</span>
      </div>
    </div>

    <!-- 数据管理 -->
    <div class="card">
      <div class="section-label">数据管理</div>
      <van-cell title="记录条数" :value="String(store.records.length)" />
      <van-cell title="占用空间" :value="usedSize" />
      <div class="btn-row">
        <van-button size="small" type="danger" plain @click="onClearRecords">清空所有记录</van-button>
      </div>
      <p class="hint">数据只存在这台设备上，卸载 App 会一起没。需要多设备同步时再上后端。</p>
    </div>

    <!-- 环境信息 -->
    <div class="card">
      <div class="section-label">运行环境</div>
      <van-cell title="运行平台" :value="platform" />
      <van-cell title="是否原生壳" :value="isNative ? '是' : '否（浏览器）'" />
      <van-cell title="应用版本" :value="appVersion" />
      <van-cell title="构建时间" :value="buildTime" />
    </div>

    <div class="card">
      <div class="section-label">关于</div>
      <p class="hint">
        这是一个跨平台应用模板：同一套代码，既能当网页用，也能打包成 iOS / Android 应用。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import { useLedgerStore } from '@/stores/ledger'
import { clearContentCache, getContentUrl, setContentUrl } from '@/api/content'

const store = useLedgerStore()
const url = ref(getContentUrl())

const platform = ref('Web')
const isNative = ref(false)
const appVersion = ref('0.1.0')
const buildTime = ref(new Date().toLocaleString('zh-CN'))

const usedSize = computed(() => {
  const bytes = new Blob([JSON.stringify(store.records)]).size
  return bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(1) + ' KB'
})

onMounted(async () => {
  try {
    const { Capacitor } = await import('@capacitor/core')
    platform.value = Capacitor.getPlatform() // 'web' | 'ios' | 'android'
    isNative.value = Capacitor.isNativePlatform()
  } catch {
    platform.value = 'Web'
  }
  try {
    const { App: CapApp } = await import('@capacitor/app')
    const info = await CapApp.getInfo()
    appVersion.value = info.version || '0.1.0'
    if (info.build) buildTime.value = `构建号 ${info.build}`
  } catch {
    /* 浏览器环境拿不到原生版本号 */
  }
})

async function onSaveUrl() {
  setContentUrl(url.value)
  await store.loadContent(true)
  showToast('已保存并刷新')
}

async function onRefresh() {
  clearContentCache()
  await store.loadContent(true)
  showToast('已刷新')
}

async function onResetUrl() {
  url.value = 'content/categories.json'
  setContentUrl('')
  clearContentCache()
  await store.loadContent(true)
  showToast('已恢复默认')
}

async function onClearRecords() {
  await showConfirmDialog({
    title: '清空记录',
    message: '所有账目会被删除，且无法恢复。',
  })
    .then(() => {
      store.clearAll()
      showToast('已清空')
    })
    .catch(() => {
      /* 取消 */
    })
}
</script>

<style scoped>
.section-label {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}
.hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.7;
  color: #969799;
}
.btn-row {
  display: flex;
  gap: 8px;
  margin: 12px 0 8px;
}
.meta {
  display: flex;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid #f2f3f5;
  font-size: 12px;
  color: #c8c9cc;
}
</style>
