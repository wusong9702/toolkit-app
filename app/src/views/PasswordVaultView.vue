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

      <!-- 顶部搜索框（账号本子风格：全字段模糊搜索） -->
      <div class="search-wrap">
        <van-search
          v-model="searchKw"
          placeholder="搜索名称 / 密码 / 备注 / 字段 / TOTP"
          shape="round"
          clearable
        />
      </div>

      <!-- 分组标签栏（搜索时隐藏） -->
      <div class="group-bar" v-if="!searching">
        <van-tabs v-model:active="activeGroup" animated swipeable>
          <van-tab v-for="g in groupNames" :key="g" :title="g" />
        </van-tabs>
      </div>

      <!-- 条目列表（拖拽把手可排序；搜索时禁用拖拽） -->
      <van-empty v-if="!visibleEntries.length" :description="searching ? '没有匹配的条目' : '暂无条目，点「新增」开始'" />
      <div v-else ref="entryListEl" class="entry-list">
        <div
          v-for="entry in visibleEntries"
          :key="entry.id"
          class="entry-card"
          :data-id="entry.id"
          :class="{ expired: isExpired(entry) }"
        >
          <div class="entry-main" @click="onCopy(entry, 'name')">
            <div class="entry-name">
              <van-icon name="bars" class="drag-handle" @click.stop />
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

          <!-- TOTP 动态验证码（实时刷新） -->
          <div
            v-if="totpMap[entry.id]"
            class="entry-totp"
            @click="copyText(totpMap[entry.id].code, '动态码')"
          >
            <van-icon name="clock-o" class="row-icon" />
            <span class="totp-code">{{ totpMap[entry.id].code }}</span>
            <van-circle
              :current-rate="(totpMap[entry.id].remaining / 30) * 100"
              :rate="100"
              :speed="100"
              :text="String(totpMap[entry.id].remaining)"
              size="30"
              class="totp-circle"
            />
            <span class="totp-hint">点击复制</span>
          </div>

          <!-- 自定义字段 -->
          <div
            v-for="(f, i) in entry.fields"
            :key="i"
            class="entry-field"
            @click="copyText(f.value, f.label)"
          >
            <span class="field-label">{{ f.label }}</span>
            <span class="field-value">{{ f.secret && !revealed[entry.id + ':' + i] ? '••••••' : f.value }}</span>
            <van-icon
              v-if="f.secret"
              :name="revealed[entry.id + ':' + i] ? 'eye-o' : 'closed-eye'"
              class="field-eye"
              @click.stop="toggleReveal(entry.id + ':' + i)"
            />
            <van-icon name="copy" class="copy-icon" @click.stop="copyText(f.value, f.label)" />
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

      <!-- A-Z 字母定位条 -->
      <div v-if="!searching && visibleEntries.length" class="az-bar">
        <span
          v-for="item in indexLetters"
          :key="item.letter"
          class="az-letter"
          :class="{ dim: !item.present }"
          @click="item.present && jumpTo(item.letter)"
        >{{ item.letter }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import Sortable from 'sortablejs'
import { useVaultStore, type VaultEntry } from '@/stores/vault'
import { copySecret } from '@/utils/clipboard'
import { matchEntry } from '@/utils/search'
import { currentTOTP } from '@/utils/totp'
import { indexLetter, ALPHABET } from '@/utils/pinyin-index'

const vault = useVaultStore()
const route = useRoute()
const router = useRouter()

const activeGroup = ref(0)
const searchKw = ref('')

const groupNames = computed(() => {
  const set = new Set<string>(['全部'])
  vault.data.groups.forEach((g) => set.add(g))
  vault.data.entries.forEach((e) => {
    if (e.group) set.add(e.group)
    e.tags.forEach((t) => set.add(t))
  })
  return Array.from(set)
})

const searching = computed(() => searchKw.value.trim().length > 0)

const visibleEntries = computed(() => {
  const kw = searchKw.value.trim()
  if (kw) return vault.data.entries.filter((e) => matchEntry(e, kw))
  const g = groupNames.value[activeGroup.value]
  if (!g || g === '全部') return vault.data.entries
  return vault.data.entries.filter((e) => e.group === g || (e.tags && e.tags.includes(g)))
})

/* ---------- A-Z 字母定位条 ---------- */
const entryLetter = (e: VaultEntry) => indexLetter(e.name)
const letterSet = computed(() => {
  const s = new Set<string>()
  visibleEntries.value.forEach((e) => s.add(entryLetter(e)))
  return s
})
const indexLetters = computed(() => {
  const present = letterSet.value
  const list = ALPHABET.map((l) => ({ letter: l, present: present.has(l) }))
  list.push({ letter: '#', present: present.has('#') })
  return list
})
function firstIdByLetter(letter: string): string | null {
  for (const e of visibleEntries.value) if (entryLetter(e) === letter) return e.id
  return null
}
function jumpTo(letter: string) {
  const id = firstIdByLetter(letter)
  if (!id || !entryListEl.value) return
  const el = entryListEl.value.querySelector(`[data-id="${id}"]`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* ---------- TOTP 实时刷新 ---------- */
const totpMap = ref<Record<string, { code: string; remaining: number }>>({})
let totpTimer: ReturnType<typeof setInterval> | null = null
async function refreshTotp() {
  const map: Record<string, { code: string; remaining: number }> = {}
  for (const e of visibleEntries.value) {
    if (e.totp) {
      const r = await currentTOTP(e.totp)
      if (r) map[e.id] = r
    }
  }
  totpMap.value = map
}
function startTotp() {
  if (totpTimer) return
  totpTimer = setInterval(refreshTotp, 1000)
  void refreshTotp()
}
function stopTotp() {
  if (totpTimer) {
    clearInterval(totpTimer)
    totpTimer = null
  }
}

/* ---------- 自定义字段「显示/隐藏」 ---------- */
const revealed = ref<Record<string, boolean>>({})
function toggleReveal(key: string) {
  revealed.value[key] = !revealed.value[key]
}

/* ---------- 触屏拖拽排序（SortableJS） ---------- */
const entryListEl = ref<HTMLElement | null>(null)
let sortable: Sortable | null = null

function initSortable(): void {
  if (searching.value) return // 搜索结果不排序
  const el = entryListEl.value
  if (!el || sortable) return
  sortable = Sortable.create(el, {
    handle: '.drag-handle', // 只有按住把手才拖，避免误触复制/编辑
    animation: 150,
    delay: 100, // 触屏上长按 100ms 才开始拖，与页面滚动不冲突
    delayOnTouchOnly: true,
    ghostClass: 'drag-ghost',
    onEnd: onSortEnd,
  })
}

function destroySortable(): void {
  if (sortable) {
    sortable.destroy()
    sortable = null
  }
}

function onSortEnd(evt: Sortable.SortableEvent): void {
  const { oldIndex, newIndex } = evt
  if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
  const id = (evt.item as HTMLElement).dataset.id
  if (!id) return

  // 模拟拖动后的新视图顺序，取出条目拖动后的前/后邻居
  const view = visibleEntries.value
  const newView = view.slice()
  const [moved] = newView.splice(oldIndex, 1)
  newView.splice(newIndex, 0, moved)
  const before = newView[newIndex - 1]
  const after = newView[newIndex + 1]

  // 在真实数组里把条目挪到正确位置（其他分组的条目相对顺序不变）
  const list = vault.data.entries
  const fromReal = list.findIndex((e) => e.id === id)
  if (fromReal < 0) return
  const [m] = list.splice(fromReal, 1)

  let insertAt: number
  if (after) {
    insertAt = list.findIndex((e) => e.id === after.id)
    if (insertAt < 0) insertAt = list.length
  } else if (before) {
    insertAt = list.findIndex((e) => e.id === before.id) + 1
    if (insertAt <= 0) insertAt = list.length
  } else {
    insertAt = 0
  }
  list.splice(insertAt, 0, m)
  list.forEach((e, i) => (e.sort = list.length - i))
  vault.save()
  showToast('已调整顺序')
}

// 分组切换 / 搜索开关 / 锁定状态变化 / 数据变化导致列表重建时，重建 Sortable 实例
watch([visibleEntries, () => vault.isLocked, searching], () => {
  destroySortable()
  void nextTick(initSortable)
})

onMounted(() => {
  const g = route.query.group
  if (typeof g === 'string' && g) {
    const idx = groupNames.value.indexOf(g)
    if (idx >= 0) activeGroup.value = idx
  }
  initSortable()
  startTotp()
})

onBeforeUnmount(() => {
  destroySortable()
  stopTotp()
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
  if (!text) {
    showToast('内容为空')
    return
  }
  const ok = await copySecret(text)
  showToast(ok ? `已复制${what}，30 秒后自动清除` : `复制失败：${what}请长按手动复制`)
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
.search-wrap {
  padding: 8px 8px 0;
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
/* 拖拽排序把手 */
.drag-handle {
  font-size: 18px;
  color: #c8c9cc;
  cursor: grab;
  touch-action: none;
}
.drag-ghost {
  opacity: 0.4;
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
/* TOTP 动态码 */
.entry-totp {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 10px;
  background: #eefaf3;
  border-radius: 8px;
  cursor: pointer;
}
.totp-code {
  font-family: 'Courier New', monospace;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 3px;
  color: #07c160;
}
.totp-circle {
  margin-left: auto;
}
.totp-hint {
  font-size: 11px;
  color: #07c160;
}
/* 自定义字段 */
.entry-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 6px 10px;
  background: #f7f8fa;
  border-radius: 8px;
  cursor: pointer;
}
.field-label {
  font-size: 12px;
  color: #969799;
  flex-shrink: 0;
}
.field-value {
  flex: 1;
  font-size: 14px;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.field-eye {
  color: #969799;
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
/* A-Z 字母定位条 */
.az-bar {
  position: fixed;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  z-index: 20;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 8px;
  padding: 4px 2px;
  max-height: 80vh;
  overflow: hidden;
}
.az-letter {
  font-size: 11px;
  font-weight: 600;
  color: #1989fa;
  padding: 1px 3px;
  cursor: pointer;
  line-height: 1.3;
}
.az-letter.dim {
  color: #c8c9cc;
  cursor: default;
}
</style>
