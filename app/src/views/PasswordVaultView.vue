<template>
  <div class="page">
    <!-- 未初始化 / 已锁定：回主页解锁 -->
    <div v-if="!vault.isInitialized || vault.isLocked" class="card unlock-card">
      <h2 class="page-title">全部密码</h2>
      <p class="hint">密码本处于锁定状态，请先解锁。</p>
      <div class="btn-row">
        <van-button type="primary" block @click="router.push('/')">去解锁</van-button>
      </div>
    </div>

    <!-- 已解锁：密码本列表 -->
    <template v-else>
      <div class="vault-head">
        <div class="head-left">
          <h2 class="page-title">密码本</h2>
        </div>
        <div class="head-right">
          <van-button
            size="small"
            icon="replay"
            :loading="vault.sync.status === 'syncing'"
            @click="onPull"
          >
            同步
          </van-button>
          <van-button size="small" type="primary" icon="plus" @click="onAdd">新增</van-button>
        </div>
      </div>

      <div class="sync-status" v-if="vault.hasWebdav">
        <span :class="syncClass">{{ syncText }}</span>
        <span v-if="vault.sync.lastSyncAt" class="sync-time">
          上次 {{ new Date(vault.sync.lastSyncAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}
        </span>
      </div>
      <div v-else class="sync-status no-sync">
        未配置云同步（WebDAV），数据仅在本机。去「设置」配置后每次编辑自动上云。
      </div>

      <!-- 分组标签栏 -->
      <div class="group-bar">
        <van-tabs v-model:active="activeGroup" animated swipeable>
          <van-tab v-for="g in groupNames" :key="g" :title="g" />
        </van-tabs>
      </div>

      <!-- 条目列表 -->
      <van-empty v-if="!visibleEntries.length" description="暂无条目，点「新增」开始" />
      <div v-else class="entry-list">
        <div
          v-for="entry in visibleEntries"
          :key="entry.id"
          class="entry-card"
          :class="{ expired: isExpired(entry) }"
        >
          <div class="entry-main" @click="onCopy(entry, 'name')">
            <div class="entry-name">
              <van-icon
                :name="entry.favorite ? 'star' : 'star-o'"
                :class="{ stared: entry.favorite }"
                class="star-icon"
                @click.stop="onToggleFav(entry)"
              />
              {{ entry.name }}
              <van-tag v-if="isExpired(entry)" type="danger" plain class="exp-tag">已失效</van-tag>
              <van-tag v-else-if="entry.expiresAt" type="warning" plain class="exp-tag">
                {{ expireLabel(entry) }}
              </van-tag>
            </div>
            <div class="entry-meta">
              <span v-if="entry.group" class="group-chip">{{ entry.group }}</span>
              <span v-for="t in entry.tags" :key="t" class="tag-chip">{{ t }}</span>
              <span v-if="entry.note" class="note-text">{{ entry.note }}</span>
            </div>
          </div>

          <div class="entry-row" @click="onCopy(entry, 'password')">
            <van-icon name="lock" class="row-icon" />
            <span class="pwd-text">{{ maskedPassword(entry.password) }}</span>
            <van-icon name="copy" class="copy-icon" />
          </div>

          <div v-if="entry.expiresAt" class="entry-expire" @click="onEdit(entry)">
            <van-icon name="clock-o" class="row-icon" />
            <span>{{ expireLabel(entry) }}</span>
          </div>

          <div class="entry-actions">
            <van-button size="mini" plain type="primary" @click="onEdit(entry)">编辑</van-button>
            <van-button size="mini" plain @click="onMove(entry, 'top')">置顶</van-button>
            <van-button size="mini" plain @click="onMove(entry, 'up')">上移</van-button>
            <van-button size="mini" plain @click="onMove(entry, 'down')">下移</van-button>
            <van-button size="mini" plain type="danger" @click="onDelete(entry)">删除</van-button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { useVaultStore, type VaultEntry } from '@/stores/vault'
import { copyToClipboard } from '@/utils/clipboard'

const vault = useVaultStore()
const route = useRoute()
const router = useRouter()

const activeGroup = ref(0)

const groupNames = computed(() => {
  const set = new Set<string>(['全部'])
  vault.data.groups.forEach((g) => set.add(g))
  vault.data.entries.forEach((e) => {
    if (e.group) set.add(e.group)
    e.tags.forEach((t) => set.add(t))
  })
  return Array.from(set)
})

// 主页分组区点击进来时带 ?group=xxx，定位到对应标签
onMounted(() => {
  const g = route.query.group
  if (typeof g === 'string' && g) {
    const idx = groupNames.value.indexOf(g)
    if (idx >= 0) activeGroup.value = idx
  }
})

const visibleEntries = computed(() => {
  const g = groupNames.value[activeGroup.value]
  if (!g || g === '全部') return vault.data.entries
  return vault.data.entries.filter(
    (e) => e.group === g || (e.tags && e.tags.includes(g)),
  )
})

function isExpired(e: VaultEntry): boolean {
  return e.expiresAt > 0 && Date.now() > e.expiresAt
}

function expireLabel(e: VaultEntry): string {
  if (!e.expiresAt) return ''
  const d = new Date(e.expiresAt)
  const now = Date.now()
  if (now > e.expiresAt) return `已失效（${d.toLocaleDateString('zh-CN')}）`
  const diff = e.expiresAt - now
  if (diff < 86400000) return `今日失效 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  return `失效于 ${d.toLocaleDateString('zh-CN')}`
}

function maskedPassword(pwd: string): string {
  if (!pwd) return '(空)'
  return '••••••••'
}

async function copyText(text: string, what: string) {
  const ok = await copyToClipboard(text)
  showToast(ok ? `已复制${what}` : `复制失败：${what}请长按手动复制`)
}

function onCopy(e: VaultEntry, field: 'name' | 'password') {
  void copyText(field === 'name' ? e.name : e.password, field === 'name' ? '名称' : '密码')
}

function onAdd() {
  router.push({ path: '/vault/edit', query: { new: '1' } })
}

function onEdit(e: VaultEntry) {
  router.push({ path: '/vault/edit', query: { id: e.id } })
}

function onToggleFav(e: VaultEntry) {
  vault.toggleFavorite(e.id)
  showToast(e.favorite ? '已取消收藏' : '已收藏')
}

function onMove(e: VaultEntry, dir: 'top' | 'up' | 'down') {
  vault.moveEntry(e.id, dir)
  showToast(dir === 'top' ? '已置顶' : dir === 'up' ? '已上移' : '已下移')
}

async function onDelete(e: VaultEntry) {
  try {
    await showConfirmDialog({ title: '删除条目', message: `确定删除「${e.name}」吗？` })
    vault.removeEntry(e.id)
    showToast('已删除')
  } catch {
    /* 取消 */
  }
}

async function onPull() {
  const ok = await vault.pullFromWebdav()
  showToast(ok ? '已从云端同步' : '同步失败或未配置 WebDAV')
}

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
.vault-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 0;
}
.vault-head .page-title {
  padding: 0;
}
.head-right {
  display: flex;
  gap: 8px;
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
.no-sync {
  background: #fff7e8;
  color: #ed6a0c;
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
.group-bar {
  margin: 0 16px 12px;
}
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
}
.entry-card.expired {
  opacity: 0.6;
}
.entry-main {
  cursor: pointer;
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
.star-icon {
  font-size: 18px;
  color: #c8c9cc;
  cursor: pointer;
}
.star-icon.stared {
  color: #ed6a0c;
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
.note-text {
  font-size: 12px;
  color: #969799;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.pwd-text {
  flex: 1;
  font-family: 'Courier New', monospace;
  color: #646566;
  letter-spacing: 2px;
}
.copy-icon {
  color: #1989fa;
}
.entry-expire {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: #ed6a0c;
  cursor: pointer;
}
.entry-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.unlock-card {
  margin-top: 24px;
}
.error {
  color: #ee0a24;
  font-size: 13px;
  margin: 8px 0 0;
}
</style>