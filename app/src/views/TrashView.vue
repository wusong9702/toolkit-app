<template>
  <div class="page">
    <h2 class="page-title">回收站</h2>
    <p class="hint">删除的条目会先进入回收站，可随时恢复；超过保留期的可在此彻底删除。</p>

    <div class="card" v-if="vault.trashEntries.length">
      <van-button
        size="small"
        type="danger"
        plain
        icon="delete-o"
        :loading="busy"
        @click="onEmpty"
      >
        清空回收站（{{ vault.trashEntries.length }}）
      </van-button>
    </div>

    <van-empty v-if="!vault.trashEntries.length" description="回收站是空的" />

    <div v-else class="entry-list">
      <div v-for="e in vault.trashEntries" :key="e.id" class="trash-card">
        <div class="trash-main">
          <div class="trash-name">{{ e.name }}</div>
          <div class="trash-meta">
            <span v-if="e.group" class="group-chip">{{ e.group }}</span>
            <span class="trash-time">删除于 {{ fmtTime(e.deletedAt) }}</span>
          </div>
        </div>
        <div class="trash-actions">
          <van-button size="mini" type="primary" plain @click="onRestore(e)">恢复</van-button>
          <van-button size="mini" type="danger" plain @click="onPurge(e)">彻底删除</van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { useVaultStore, type VaultEntry } from '@/stores/vault'

const vault = useVaultStore()
const router = useRouter()
const busy = ref(false)

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function onRestore(e: VaultEntry) {
  vault.restore(e.id)
  showToast('已恢复')
}

async function onPurge(e: VaultEntry) {
  try {
    await showConfirmDialog({ title: '彻底删除', message: `确定彻底删除「${e.name}」吗？此操作不可恢复。` })
    vault.purge(e.id)
    showToast('已彻底删除')
  } catch {
    /* 取消 */
  }
}

async function onEmpty() {
  try {
    await showConfirmDialog({
      title: '清空回收站',
      message: `将彻底删除回收站内的 ${vault.trashEntries.length} 条条目，不可恢复。确定继续？`,
    })
    busy.value = true
    vault.emptyTrash()
    showToast('回收站已清空')
  } catch {
    /* 取消 */
  } finally {
    busy.value = false
  }
}

// 回收站为空时模板已显示空状态，无需额外处理
</script>

<style scoped>
.hint {
  margin: 0 0 8px;
  padding: 0 16px;
  font-size: 12px;
  line-height: 1.7;
  color: #969799;
}
.entry-list {
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.trash-card {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #ebedf0;
  border-radius: 12px;
  padding: 12px 14px;
  background: #fff;
}
html.dark .trash-card {
  background: #1e1e1e;
  border-color: #2c2c2c;
}
.trash-main {
  flex: 1;
  min-width: 0;
}
.trash-name {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}
html.dark .trash-name {
  color: #e6e6e6;
}
.trash-meta {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.trash-time {
  font-size: 11px;
  color: #969799;
}
.group-chip {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: #e8f3ff;
  color: #1989fa;
}
html.dark .group-chip {
  background: #1f2a3a;
  color: #5aa9ff;
}
.trash-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}
</style>
