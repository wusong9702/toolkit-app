<template>
  <div class="page">
    <!-- 未初始化：首次设置主密码 -->
    <div v-if="!vault.isInitialized" class="card unlock-card">
      <h2 class="page-title">创建主密码</h2>
      <p class="hint">
        主密码用于加密保管所有密码条目，<b>不会上传云端</b>。
        请牢记：忘记主密码 = 数据无法恢复（没有任何找回通道）。
      </p>
      <van-field
        v-model="master1"
        type="password"
        label="主密码"
        placeholder="至少 8 位"
        autocomplete="new-password"
      />
      <van-field
        v-model="master2"
        type="password"
        label="确认主密码"
        placeholder="再输一遍"
        autocomplete="new-password"
      />
      <div class="btn-row">
        <van-button type="primary" block :loading="busy" @click="onSetup">创建密码本</van-button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <!-- 已初始化但锁定：输入主密码解锁 -->
    <div v-else-if="vault.isLocked" class="card unlock-card">
      <h2 class="page-title">解锁密码本</h2>
      <p class="hint">输入主密码解锁，才能查看和编辑密码。</p>
      <van-field
        v-model="master1"
        type="password"
        label="主密码"
        placeholder="输入主密码"
        autocomplete="current-password"
        @keyup.enter="onUnlock"
      />
      <div class="btn-row">
        <van-button type="primary" block :loading="busy" @click="onUnlock">解锁</van-button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <!-- 已解锁：密码本主页 -->
    <template v-else>
      <!-- 顶部：搜索栏 + 右上角设置 -->
      <div class="home-top">
        <van-search
          v-model="keyword"
          class="home-search"
          placeholder="搜索名称 / 密码 / 备注 / 标签"
          shape="round"
          clearable
        />
        <van-icon name="setting-o" class="setting-icon" @click="goSettings" />
      </div>

      <!-- 同步状态条 -->
      <div v-if="vault.hasWebdav" class="sync-status">
        <span :class="syncClass">{{ syncText }}</span>
        <span v-if="vault.sync.lastSyncAt" class="sync-time">
          上次 {{ fmtTime(vault.sync.lastSyncAt) }}
        </span>
      </div>

      <!-- 搜索结果模式 -->
      <template v-if="searching">
        <van-empty v-if="!searchResults.length" description="没有匹配的条目" />
        <div v-else class="entry-list">
          <div
            v-for="entry in searchResults"
            :key="entry.id"
            class="entry-card"
            :class="{ expired: isExpired(entry) }"
            @click="goEdit(entry)"
          >
            <div class="entry-name">
              <van-icon
                :name="entry.favorite ? 'star' : 'star-o'"
                :class="{ stared: entry.favorite }"
                class="star-icon"
                @click.stop="onToggleFav(entry)"
              />
              {{ entry.name }}
              <van-tag v-if="isExpired(entry)" type="danger" plain class="exp-tag">已失效</van-tag>
            </div>
            <div class="entry-meta">
              <span v-if="entry.group" class="group-chip">{{ entry.group }}</span>
              <span v-for="t in entry.tags" :key="t" class="tag-chip">{{ t }}</span>
            </div>
            <div class="entry-row" @click.stop="onCopy(entry, 'password')">
              <van-icon name="lock" class="row-icon" />
              <span class="pwd-text">{{ maskedPassword(entry.password) }}</span>
              <van-icon name="copy" class="copy-icon" />
            </div>
          </div>
        </div>
      </template>

      <!-- 浏览模式：收藏 + 分组 + 全部入口 -->
      <template v-else>
        <!-- 我的收藏 -->
        <div class="card">
          <div class="section-label">
            我的收藏
            <span class="section-count" v-if="vault.favoriteEntries.length">
              {{ vault.favoriteEntries.length }}
            </span>
          </div>
          <van-empty
            v-if="!vault.favoriteEntries.length"
            image-size="48"
            description="点条目的星标收藏，会固定显示在这里"
          />
          <div v-else class="fav-list">
            <div
              v-for="entry in vault.favoriteEntries"
              :key="entry.id"
              class="fav-item"
              :class="{ expired: isExpired(entry) }"
            >
              <div class="fav-main" @click="onCopy(entry, 'name')">
                <div class="fav-name">{{ entry.name }}</div>
                <div class="fav-group" v-if="entry.group">{{ entry.group }}</div>
              </div>
              <div class="fav-pwd" @click="onCopy(entry, 'password')">
                <span class="pwd-text">{{ maskedPassword(entry.password) }}</span>
                <van-icon name="copy" class="copy-icon" />
              </div>
              <van-icon
                name="star"
                class="star-icon stared"
                @click="onToggleFav(entry)"
              />
            </div>
          </div>
        </div>

        <!-- 密码分组 -->
        <div class="card">
          <div class="section-label">密码分组</div>
          <van-empty
            v-if="!groupList.length"
            image-size="48"
            description="新增条目时填写分组，会自动出现在这里"
          />
          <div v-else class="group-grid">
            <div
              v-for="g in groupList"
              :key="g.name"
              class="group-cell"
              @click="goGroup(g.name)"
            >
              <van-icon name="folder-o" class="group-icon" />
              <div class="group-name">{{ g.name }}</div>
              <div class="group-count">{{ g.count }} 条</div>
            </div>
          </div>
        </div>

        <!-- 全部密码入口 -->
        <div class="all-entry" @click="goAll">
          <van-icon name="apps-o" />
          <span>全部密码（{{ vault.totalEntries }}）</span>
          <van-icon name="arrow" class="arrow-icon" />
        </div>
      </template>

      <!-- 新增按钮（悬浮） -->
      <div class="fab" @click="goAdd">
        <van-icon name="plus" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useVaultStore, type VaultEntry } from '@/stores/vault'
import { copyToClipboard } from '@/utils/clipboard'

const vault = useVaultStore()
const router = useRouter()

const master1 = ref('')
const master2 = ref('')
const busy = ref(false)
const error = ref('')
const keyword = ref('')

/* ---------- 搜索 ---------- */
const searching = computed(() => keyword.value.trim().length > 0)

/** 搜索匹配：名称 / 密码 / 备注 / 标签 / 分组，不分大小写 */
function matchEntry(e: VaultEntry, kw: string): boolean {
  const k = kw.toLowerCase()
  return (
    e.name.toLowerCase().includes(k) ||
    e.password.toLowerCase().includes(k) ||
    e.note.toLowerCase().includes(k) ||
    e.group.toLowerCase().includes(k) ||
    e.tags.some((t) => t.toLowerCase().includes(k))
  )
}

const searchResults = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return []
  return vault.data.entries.filter((e) => matchEntry(e, kw))
})

/* ---------- 主页区块数据 ---------- */
/** 分组列表（含条目数），按数量倒序 */
const groupList = computed(() => {
  const counts = vault.groupCounts
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

/* ---------- 工具函数 ---------- */
function isExpired(e: VaultEntry): boolean {
  return e.expiresAt > 0 && Date.now() > e.expiresAt
}

function maskedPassword(pwd: string): string {
  if (!pwd) return '(空)'
  return '••••••••'
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

async function onCopy(e: VaultEntry, field: 'name' | 'password') {
  const text = field === 'name' ? e.name : e.password
  if (!text) {
    showToast('内容为空')
    return
  }
  const ok = await copyToClipboard(text)
  showToast(ok ? `已复制${field === 'name' ? '名称' : '密码'}` : '复制失败，请长按手动复制')
}

function onToggleFav(e: VaultEntry) {
  vault.toggleFavorite(e.id)
  showToast(e.favorite ? '已取消收藏' : '已收藏')
}

/* ---------- 导航 ---------- */
function goSettings() {
  router.push('/settings')
}

function goAdd() {
  router.push({ path: '/vault/edit', query: { new: '1' } })
}

function goEdit(e: VaultEntry) {
  router.push({ path: '/vault/edit', query: { id: e.id } })
}

function goGroup(name: string) {
  router.push({ path: '/vault', query: { group: name } })
}

function goAll() {
  router.push('/vault')
}

/* ---------- 主密码 ---------- */
async function onSetup() {
  if (master1.value.length < 8) {
    error.value = '主密码至少 8 位'
    return
  }
  if (master1.value !== master2.value) {
    error.value = '两次输入不一致'
    return
  }
  busy.value = true
  error.value = ''
  try {
    await vault.setupMaster(master1.value)
    showToast('密码本已创建')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    busy.value = false
  }
}

async function onUnlock() {
  if (!master1.value) {
    error.value = '请输入主密码'
    return
  }
  busy.value = true
  error.value = ''
  const ok = await vault.unlock(master1.value)
  busy.value = false
  if (ok) {
    showToast('已解锁')
    master1.value = ''
  } else {
    error.value = '主密码错误'
  }
}

/* ---------- 同步状态 ---------- */
const syncText = computed(() => {
  const s = vault.sync.status
  if (s === 'syncing') return '同步中…'
  if (s === 'pushed') return '已同步到云端'
  if (s === 'pulled') return '已从云端拉取'
  if (s === 'error') return `同步出错：${vault.sync.error || '未知错误'}`
  return '未同步'
})

const syncClass = computed(() => {
  const s = vault.sync.status
  if (s === 'error') return 'sync-error'
  if (s === 'syncing') return 'sync-run'
  if (s === 'pushed' || s === 'pulled') return 'sync-ok'
  return 'sync-idle'
})
</script>

<style scoped>
.home-top {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 8px 0 0;
}
.home-search {
  flex: 1;
  padding: 8px 0 8px 8px;
}
.setting-icon {
  font-size: 22px;
  color: #323233;
  padding: 0 14px;
}
.sync-status {
  margin: 0 16px 12px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  background: #f2f3f5;
  color: #646566;
}
.sync-error {
  color: #ee0a24;
}
.sync-ok {
  color: #07c160;
}
.sync-run {
  color: #1989fa;
}
.section-label {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  display: flex;
  align-items: center;
  gap: 6px;
}
.section-count {
  font-size: 11px;
  font-weight: 400;
  background: #e8f3ff;
  color: #1989fa;
  border-radius: 999px;
  padding: 1px 8px;
}
/* 收藏区 */
.fav-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #fffbe8;
  border: 1px solid #ffe58f;
  border-radius: 10px;
}
.fav-item.expired {
  opacity: 0.55;
}
.fav-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.fav-name {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fav-group {
  margin-top: 2px;
  font-size: 11px;
  color: #969799;
}
.fav-pwd {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
}
.pwd-text {
  font-family: 'Courier New', monospace;
  color: #646566;
  letter-spacing: 2px;
  font-size: 13px;
}
.copy-icon {
  color: #1989fa;
}
.star-icon {
  font-size: 18px;
  color: #c8c9cc;
  cursor: pointer;
}
.star-icon.stared {
  color: #ed6a0c;
}
/* 分组区 */
.group-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.group-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 6px;
  background: #f7f8fa;
  border-radius: 10px;
  cursor: pointer;
}
.group-icon {
  font-size: 22px;
  color: #1989fa;
}
.group-name {
  font-size: 13px;
  color: #323233;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-count {
  font-size: 11px;
  color: #969799;
}
/* 全部入口 */
.all-entry {
  margin: 0 16px 24px;
  padding: 14px 16px;
  background: #fff;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  color: #323233;
  cursor: pointer;
}
.all-entry .arrow-icon {
  margin-left: auto;
  color: #c8c9cc;
}
/* 搜索结果条目 */
.entry-list {
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.entry-card {
  border: 1px solid #ebedf0;
  border-radius: 12px;
  padding: 12px 14px;
  background: #fff;
  cursor: pointer;
}
.entry-card.expired {
  opacity: 0.6;
}
.entry-name {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.exp-tag {
  font-size: 10px;
}
.entry-meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.group-chip,
.tag-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: #e8f3ff;
  color: #1989fa;
}
.tag-chip {
  background: #f0f9eb;
  color: #07c160;
}
.entry-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 10px;
  background: #f7f8fa;
  border-radius: 8px;
  cursor: pointer;
}
.row-icon {
  color: #969799;
}
/* 悬浮新增 */
.fab {
  position: fixed;
  right: 20px;
  bottom: 84px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #1989fa;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 4px 12px rgba(25, 137, 250, 0.4);
  cursor: pointer;
  z-index: 10;
}
.unlock-card {
  margin-top: 24px;
}
.error {
  color: #ee0a24;
  font-size: 13px;
  margin: 8px 0 0;
}
.hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.7;
  color: #969799;
}
.btn-row {
  margin-top: 12px;
}
</style>
