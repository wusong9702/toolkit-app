import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { getItem, setItem } from './storage'
import type { Category, ContentConfig } from '@/api/content'
import { fetchContent, FALLBACK_CONTENT } from '@/api/content'

export interface Record {
  id: string
  /** 'expense' 支出 | 'income' 收入 */
  type: 'expense' | 'income'
  amount: number
  categoryId: string
  note: string
  /** 时间戳（毫秒） */
  createdAt: number
}

const RECORDS_KEY = 'ledgerRecords'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export const useLedgerStore = defineStore('ledger', () => {
  /** 账单列表，自动持久化到本地 */
  const records = ref<Record[]>(getItem<Record[]>(RECORDS_KEY, []))

  /** 云端下发的分类（只读） */
  const categories = ref<Category[]>(FALLBACK_CONTENT.categories)
  const contentMeta = ref<{ version: string; updatedAt: string; notice?: string }>({
    version: FALLBACK_CONTENT.version,
    updatedAt: FALLBACK_CONTENT.updatedAt,
    notice: FALLBACK_CONTENT.notice,
  })
  const contentLoading = ref(false)

  // 数据一变就写回本地，不用手动调保存
  watch(
    records,
    (val) => setItem(RECORDS_KEY, val),
    { deep: true },
  )

  async function loadContent(force = false) {
    contentLoading.value = true
    try {
      const data: ContentConfig = await fetchContent(force)
      categories.value = data.categories?.length ? data.categories : FALLBACK_CONTENT.categories
      contentMeta.value = {
        version: data.version,
        updatedAt: data.updatedAt,
        notice: data.notice,
      }
    } finally {
      contentLoading.value = false
    }
  }

  function addRecord(payload: Omit<Record, 'id' | 'createdAt'>) {
    records.value.unshift({
      ...payload,
      id: uid(),
      createdAt: Date.now(),
    })
  }

  function removeRecord(id: string) {
    records.value = records.value.filter((r) => r.id !== id)
  }

  function clearAll() {
    records.value = []
  }

  const totalExpense = computed(() =>
    records.value.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
  )
  const totalIncome = computed(() =>
    records.value.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0),
  )
  const balance = computed(() => totalIncome.value - totalExpense.value)

  /** 按分类聚合的支出，用于展示占比条 */
  const byCategory = computed(() => {
    const map = new Map<string, number>()
    records.value
      .filter((r) => r.type === 'expense')
      .forEach((r) => map.set(r.categoryId, (map.get(r.categoryId) || 0) + r.amount))

    const total = totalExpense.value || 1
    return categories.value
      .map((c) => ({
        ...c,
        amount: map.get(c.id) || 0,
        percent: Math.round(((map.get(c.id) || 0) / total) * 100),
      }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  })

  /** 按日期分组，便于列表展示 */
  const groupedByDate = computed(() => {
    const groups: { date: string; label: string; items: Record[]; expense: number; income: number }[] =
      []
    const map = new Map<string, Record[]>()

    // records 已按时间倒序插入，这里再排一次保险
    ;[...records.value]
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach((r) => {
        const key = new Date(r.createdAt).toLocaleDateString('zh-CN')
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(r)
      })

    const today = new Date().toLocaleDateString('zh-CN')
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('zh-CN')

    map.forEach((items, date) => {
      groups.push({
        date,
        label: date === today ? '今天' : date === yesterday ? '昨天' : date,
        items,
        expense: items.filter((i) => i.type === 'expense').reduce((s, i) => s + i.amount, 0),
        income: items.filter((i) => i.type === 'income').reduce((s, i) => s + i.amount, 0),
      })
    })
    return groups
  })

  function categoryOf(id: string): Category {
    return categories.value.find((c) => c.id === id) || FALLBACK_CONTENT.categories.slice(-1)[0]
  }

  return {
    records,
    categories,
    contentMeta,
    contentLoading,
    loadContent,
    addRecord,
    removeRecord,
    clearAll,
    totalExpense,
    totalIncome,
    balance,
    byCategory,
    groupedByDate,
    categoryOf,
  }
})
