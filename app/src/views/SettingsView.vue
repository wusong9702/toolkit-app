<template>
  <div class="page">
    <h2 class="page-title">设置</h2>

    <!-- 密码本：WebDAV 云同步 -->
    <div class="card">
      <div class="section-label">云同步（WebDAV）</div>
      <p class="hint">
        配置 WebDAV（坚果云 / Nextcloud / 自建 NAS）后，密码本每次编辑会自动把「加密数据」同步到云端。
        云端只有密文，没有主密码无法解密。
      </p>
      <van-field v-model="davUrl" label="WebDAV 地址" placeholder="https://dav.jianguoyun.com/dav/" />
      <van-field v-model="davUser" label="账号" placeholder="坚果云填邮箱" />
      <van-field v-model="davPass" type="password" label="应用密码" placeholder="坚果云填「应用密码」" />
      <van-field v-model="davDir" label="目录名" placeholder="password-vault" />
      <div class="btn-row">
        <van-button size="small" type="primary" @click="onSaveWebdav">保存配置</van-button>
        <van-button size="small" plain :loading="testLoading" @click="onTestConnection">
          测试连通
        </van-button>
        <van-button size="small" plain :loading="syncLoading" @click="onSyncNow">立即同步</van-button>
      </div>

      <!-- 连通测试结果 -->
      <div v-if="testResult" class="test-result" :class="testResult.ok ? 'test-ok' : 'test-fail'">
        {{ testResult.message }}
      </div>

      <div class="btn-row">
        <van-button size="small" plain type="danger" @click="onDeleteRemote">删除云端数据</van-button>
      </div>
      <div v-if="vault.sync.lastSyncAt" class="meta">
        <span>上次同步 {{ new Date(vault.sync.lastSyncAt).toLocaleString('zh-CN') }}</span>
      </div>
      <p v-if="vault.sync.error" class="error">{{ vault.sync.error }}</p>
    </div>

    <!-- 密码本：主密码管理 -->
    <div class="card">
      <div class="section-label">主密码</div>
      <van-cell title="是否已设置" :value="vault.isInitialized ? '已设置' : '未设置'" />
      <van-cell title="当前状态" :value="vault.unlocked ? '已解锁' : '已锁定'" />
      <div class="btn-row">
        <van-button size="small" plain @click="onLockVault">锁定密码本</van-button>
        <van-button size="small" plain type="danger" @click="onResetVault">重置密码本</van-button>
      </div>
      <p class="hint">
        重置会删除本机全部密码数据（不可恢复），慎用。锁定后需输入主密码才能再次查看。
      </p>
    </div>

    <!-- 数据概况 -->
    <div class="card">
      <div class="section-label">数据概况</div>
      <van-cell title="密码条目" :value="String(vault.totalEntries)" />
      <van-cell title="收藏条目" :value="String(vault.favoriteEntries.length)" />
      <van-cell title="分组/标签" :value="String(vault.data.groups.length)" />
      <p class="hint">所有数据加密后存在本机，配置云同步后同时加密备份到云端。</p>
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
        本地密码本：数据端到端加密（AES-256-GCM），支持 WebDAV 云备份。
        同一套代码，既能当网页用，也能打包成 iOS / Android 应用。
      </p>
    </div>

    <!-- 删除云端数据：三选一动作面板 -->
    <van-action-sheet
      v-model:show="deleteSheetShow"
      :actions="deleteActions"
      cancel-text="取消"
      description="删除云端数据后，云端备份将无法恢复"
      close-on-click-action
      @select="onDeleteSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import { useVaultStore } from '@/stores/vault'
import { testConnection, type ConnectionTestResult } from '@/utils/webdav'

const vault = useVaultStore()

// 密码本 WebDAV 配置
const davUrl = ref(vault.webdavConfig.url)
const davUser = ref(vault.webdavConfig.username)
const davPass = ref(vault.webdavConfig.password)
const davDir = ref(vault.webdavConfig.dir || 'password-vault')
const syncLoading = ref(false)
const testLoading = ref(false)
const testResult = ref<ConnectionTestResult | null>(null)

/** 当前表单里的配置（不一定已保存，测试用表单值） */
function currentConfig() {
  return {
    url: davUrl.value.trim(),
    username: davUser.value.trim(),
    password: davPass.value.trim(),
    dir: davDir.value.trim() || 'password-vault',
  }
}

function onSaveWebdav() {
  if (!davUrl.value || !davUser.value || !davPass.value) {
    showToast('请填完整地址、账号和应用密码')
    return
  }
  vault.setWebdav(currentConfig())
  showToast('配置已保存')
}

/** 测试连通：先按表单值测，测通了自动保存 */
async function onTestConnection() {
  testLoading.value = true
  testResult.value = null
  try {
    const result = await testConnection(currentConfig())
    testResult.value = result
    if (result.ok) {
      // 连通成功顺手保存配置，免去用户再点一次保存
      vault.setWebdav(currentConfig())
    }
  } finally {
    testLoading.value = false
  }
}

async function onSyncNow() {
  if (!davUrl.value || !davUser.value || !davPass.value) {
    showToast('请先填写完整的 WebDAV 配置')
    return
  }
  syncLoading.value = true
  try {
    await vault.pushToWebdav()
    showToast('已触发同步（自动推送到云端）')
  } finally {
    syncLoading.value = false
  }
}

/** 删除云端数据：三选一（仅云端 / 云端+本地 / 取消） */
const deleteSheetShow = ref(false)
const deleteActions = [
  { name: '仅删除云端数据（本地保留）', color: '#ee0a24' },
  { name: '删除云端并清空本地（全部删除）', color: '#ee0a24' },
]

function onDeleteRemote() {
  if (!vault.hasWebdav && !davUrl.value) {
    showToast('未配置云同步')
    return
  }
  deleteSheetShow.value = true
}

async function onDeleteSelect(action: { name: string }) {
  if (action.name.startsWith('仅删除')) {
    await vault.clearRemote()
    showToast('云端数据已删除，本地保留')
    return
  }
  // 全删：二次确认，这是最危险的操作
  try {
    await showConfirmDialog({
      title: '全部删除',
      message:
        '将删除云端备份 + 本机全部密码数据（含主密码），且无法恢复。确定继续？',
    })
    await vault.clearRemote()
    vault.resetAll()
    showToast('已全部删除')
  } catch {
    /* 取消 */
  }
}

function onLockVault() {
  vault.lock()
  showToast('密码本已锁定')
}

async function onResetVault() {
  try {
    await showConfirmDialog({
      title: '重置密码本',
      message: '将删除本机全部密码数据（含主密码）并重新初始化，无法恢复。确定继续？',
    })
    vault.resetAll()
    showToast('已重置，请重新创建主密码')
  } catch {
    /* 取消 */
  }
}

const platform = ref('Web')
const isNative = ref(false)
const appVersion = ref('0.1.0')
const buildTime = ref(new Date().toLocaleString('zh-CN'))

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
  flex-wrap: wrap;
}
.test-result {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
}
.test-ok {
  background: #f0f9eb;
  color: #07c160;
}
.test-fail {
  background: #fff1f0;
  color: #ee0a24;
}
.meta {
  display: flex;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid #f2f3f5;
  font-size: 12px;
  color: #c8c9cc;
}
.error {
  color: #ee0a24;
  font-size: 13px;
  margin: 8px 0 0;
}
</style>
