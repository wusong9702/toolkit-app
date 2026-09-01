import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { getItem, setItem } from './storage'
import { encryptObject, decryptObject } from '@/utils/crypto'
import {
  ensureDir,
  fetchVault,
  hasVaultFile,
  pushVault,
  deleteVault,
  vaultFileUrl,
  type WebDavConfig,
} from '@/utils/webdav'

/** 一条密码记录 */
export interface VaultEntry {
  id: string
  /** 名称（自定义，如「阿里邮箱」「WiFi-家里」） */
  name: string
  /** 密码（自定义，可随机生成） */
  password: string
  /** 分组/标签（自定义，可多分；主分组 + 标签） */
  group: string
  tags: string[]
  /** 备注 */
  note: string
  /** 失效时间戳（ms）；0 = 永不过期 */
  expiresAt: number
  /** 是否收藏（收藏的条目会显示在首页「我的收藏」区） */
  favorite: boolean
  /** 排序权重（越大越靠前，用于手动排序） */
  sort: number
  /** 创建时间（ms） */
  createdAt: number
  /** 更新时间（ms） */
  updatedAt: number
}

/** 密码库整体（数组 + 分组元信息） */
export interface VaultData {
  entries: VaultEntry[]
  groups: string[]
}

export interface SyncState {
  status: 'idle' | 'syncing' | 'pulled' | 'pushed' | 'error'
  lastSyncAt: number | null
  error?: string
}

const VAULT_KEY = 'vaultData'
const MASTER_KEY = 'vaultMaster'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

const emptyVault = (): VaultData => ({ entries: [], groups: [] })

/**
 * 兼容老数据：早期版本保存的条目没有 favorite 字段。
 * 不补默认值的话，界面上读到的会是 undefined，收藏判断就失效了。
 */
function normalize(data: VaultData): VaultData {
  return {
    groups: Array.isArray(data.groups) ? data.groups : [],
    entries: (Array.isArray(data.entries) ? data.entries : []).map((e) => ({
      ...e,
      favorite: e.favorite === true,
      tags: Array.isArray(e.tags) ? e.tags : [],
      sort: typeof e.sort === 'number' ? e.sort : 0,
    })),
  }
}

export const useVaultStore = defineStore('vault', () => {
  /* ---------- 主密码锁 ---------- */
  const isInitialized = ref(getItem<boolean>(MASTER_KEY, false))
  const unlocked = ref(false)
  const masterPassword = ref('')

  /* ---------- 当前内存中的明文库（未加密前的明文，仅存在于内存） ---------- */
  const data = ref<VaultData>(emptyVault())
  const sync = ref<SyncState>({ status: 'idle', lastSyncAt: null })

  /* ---------- WebDAV 配置（存设置，不存密码给云） ---------- */
  const webdavConfig = ref<WebDavConfig>(
    getItem<WebDavConfig>('webdavConfig', { url: '', username: '', password: '', dir: '' }),
  )

  /** 是否配置了 WebDAV */
  const hasWebdav = computed(
    () => !!(webdavConfig.value.url && webdavConfig.value.username && webdavConfig.value.password),
  )

  /** 失效倒计时：当前是否已锁定（所有失效条目不可见密码） */
  const isLocked = computed(() => !unlocked.value)

  /** 有失效时间的条目（用于界面标记） */
  const expiringEntries = computed(
    () =>
      data.value.entries.filter((e) => e.expiresAt > 0).length,
  )

  /* ---------- 加解锁 ---------- */
  /** 首次设置主密码（初始化） */
  async function setupMaster(master: string): Promise<void> {
    // 用主密码加密「空库」来验证它能用，同时把「已初始化」标记写成本地非加密布尔
    masterPassword.value = master
    await encryptObject(emptyVault(), master) // 预演
    setItem(MASTER_KEY, true)
    isInitialized.value = true
    data.value = emptyVault()
    unlocked.value = true
    await save()
  }

  /** 解锁：用主密码解密本地库；密码错会抛异常 */
  async function unlock(master: string): Promise<boolean> {
    try {
      const encrypted = getItem<{ v: number; salt: string; iv: string; cipher: string } | null>(
        VAULT_KEY,
        null,
      )
      if (!encrypted) {
        masterPassword.value = master
        data.value = emptyVault()
        unlocked.value = true
        return true
      }
      const plain = await decryptObject<VaultData>(encrypted, master)
      masterPassword.value = master
      data.value = plain
      unlocked.value = true
      return true
    } catch {
      return false // 主密码错误
    }
  }

  /** 锁定（清除内存明文 + 密码） */
  function lock(): void {
    unlocked.value = false
    masterPassword.value = ''
    data.value = emptyVault()
  }

  /* ---------- 条目 CRUD ---------- */
  function addEntry(
    payload: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt' | 'sort'> & { sort?: number },
  ): VaultEntry {
    const entry: VaultEntry = {
      ...payload,
      id: uid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sort: payload.sort ?? Date.now(),
    }
    data.value.entries.unshift(entry)
    syncGroups()
    save()
    return entry
  }

  function updateEntry(id: string, patch: Partial<VaultEntry>): void {
    const e = data.value.entries.find((x) => x.id === id)
    if (!e) return
    Object.assign(e, patch, { updatedAt: Date.now() })
    syncGroups()
    save()
  }

  function removeEntry(id: string): void {
    data.value.entries = data.value.entries.filter((e) => e.id !== id)
    syncGroups()
    save()
  }

  /** 切换收藏状态（收藏的条目固定显示在主页顶部） */
  function toggleFavorite(id: string): void {
    const e = data.value.entries.find((x) => x.id === id)
    if (!e) return
    e.favorite = !e.favorite
    e.updatedAt = Date.now()
    save()
  }

  /** 手动排序：向上移 / 向下移 / 置顶 */
  function moveEntry(id: string, dir: 'up' | 'down' | 'top'): void {
    const list = data.value.entries
    const idx = list.findIndex((e) => e.id === id)
    if (idx < 0) return
    if (dir === 'top') {
      const [e] = list.splice(idx, 1)
      list.unshift(e)
    } else if (dir === 'up' && idx > 0) {
      ;[list[idx - 1], list[idx]] = [list[idx], list[idx - 1]]
    } else if (dir === 'down' && idx < list.length - 1) {
      ;[list[idx + 1], list[idx]] = [list[idx], list[idx + 1]]
    }
    // 重排 sort 权重，保证后续持久化顺序一致
    list.forEach((e, i) => (e.sort = list.length - i))
    save()
  }

  /** 添加一个分组（去重） */
  function addGroup(name: string): void {
    const n = name.trim()
    if (n && !data.value.groups.includes(n)) {
      data.value.groups.push(n)
      save()
    }
  }

  function removeGroup(name: string): void {
    data.value.groups = data.value.groups.filter((g) => g !== name)
    // 同步把条目里的该分组清掉
    data.value.entries.forEach((e) => {
      if (e.group === name) e.group = ''
      e.tags = e.tags.filter((t) => t !== name)
    })
    save()
  }

  /** 条目里的分组/标签汇总同步到 groups（打开时兜底） */
  function syncGroups(): void {
    const set = new Set<string>(data.value.groups)
    data.value.entries.forEach((e) => {
      if (e.group) set.add(e.group)
      e.tags.forEach((t) => set.add(t))
    })
    data.value.groups = Array.from(set)
  }

  /* ---------- 展示用派生 ---------- */
  /** 按分组聚合的条目 */
  const groupedEntries = computed(() => {
    const groups = new Map<string, VaultEntry[]>()
    data.value.entries.forEach((e) => {
      const key = e.group || '未分组'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(e)
    })
    return Array.from(groups.entries()).sort((a, b) => (a[0] === '未分组' ? 1 : b[0] === '未分组' ? -1 : a[0].localeCompare(b[0])))
  })

  /** 总条目数 */
  const totalEntries = computed(() => data.value.entries.length)

  /** 收藏的条目（主页「我的收藏」区） */
  const favoriteEntries = computed(() => data.value.entries.filter((e) => e.favorite))

  /** 每个分组/标签下的条目数（主页分组区角标用） */
  const groupCounts = computed(() => {
    const counts = new Map<string, number>()
    data.value.entries.forEach((e) => {
      if (e.group) counts.set(e.group, (counts.get(e.group) || 0) + 1)
      e.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1))
    })
    return counts
  })

  /* ---------- 持久化（加密落盘） ---------- */
  async function save(): Promise<void> {
    if (!unlocked.value || !masterPassword.value) return
    const encrypted = await encryptObject(data.value, masterPassword.value)
    setItem(VAULT_KEY, encrypted)
    await pushToWebdav() // 每次编辑后自动同步到云端
  }

  /** 监听数据变化自动保存 + 同步（防抖 300ms） */
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    data,
    () => {
      if (!unlocked.value) return
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => save(), 300)
    },
    { deep: true },
  )

  /* ---------- WebDAV 同步 ---------- */
  async function pushToWebdav(): Promise<void> {
    if (!hasWebdav.value || !unlocked.value) return
    sync.value = { ...sync.value, status: 'syncing' }
    try {
      await ensureDir(webdavConfig.value)
      const encrypted = getItem<{ v: number; salt: string; iv: string; cipher: string } | null>(
        VAULT_KEY,
        null,
      )
      if (!encrypted) return
      await pushVault(webdavConfig.value, JSON.stringify(encrypted))
      sync.value = { status: 'pushed', lastSyncAt: Date.now() }
    } catch (e) {
      sync.value = {
        status: 'error',
        lastSyncAt: sync.value.lastSyncAt,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  async function pullFromWebdav(): Promise<boolean> {
    if (!hasWebdav.value) return false
    sync.value = { ...sync.value, status: 'syncing' }
    try {
      const remote = await fetchVault(webdavConfig.value)
      if (remote && unlocked.value && masterPassword.value) {
        const remoteData = await decryptObject<VaultData>(JSON.parse(remote), masterPassword.value)
        // 合并：以远端为准（简单策略；后续可做成冲突合并）
        data.value = remoteData
        syncGroups()
        const encrypted = await encryptObject(data.value, masterPassword.value)
        setItem(VAULT_KEY, encrypted)
        sync.value = { status: 'pulled', lastSyncAt: Date.now() }
        return true
      }
      return false
    } catch (e) {
      sync.value = {
        status: 'error',
        lastSyncAt: sync.value.lastSyncAt,
        error: e instanceof Error ? e.message : String(e),
      }
      return false
    }
  }

  async function clearRemote(): Promise<void> {
    if (!hasWebdav.value) return
    try {
      await deleteVault(webdavConfig.value)
      sync.value = { status: 'idle', lastSyncAt: Date.now() }
    } catch (e) {
      sync.value = {
        status: 'error',
        lastSyncAt: sync.value.lastSyncAt,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  /** 保存 WebDAV 配置 */
  function setWebdav(cfg: WebDavConfig): void {
    webdavConfig.value = cfg
    setItem('webdavConfig', cfg)
  }

  /** 清空本库（重新初始化用） */
  function resetAll(): void {
    lock()
    setItem(VAULT_KEY, null as unknown as string)
    setItem(MASTER_KEY, false)
    setItem('webdavConfig', { url: '', username: '', password: '', dir: '' })
    isInitialized.value = false
  }

  return {
    isInitialized,
    unlocked,
    isLocked,
    data,
    sync,
    webdavConfig,
    hasWebdav,
    expiringEntries,
    setupMaster,
    unlock,
    lock,
    addEntry,
    updateEntry,
    removeEntry,
    moveEntry,
    toggleFavorite,
    addGroup,
    removeGroup,
    groupedEntries,
    totalEntries,
    favoriteEntries,
    groupCounts,
    save,
    pushToWebdav,
    pullFromWebdav,
    clearRemote,
    setWebdav,
    resetAll,
  }
})