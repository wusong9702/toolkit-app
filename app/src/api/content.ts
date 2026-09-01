/**
 * 云端只读内容
 *
 * 你的需求是"只读云端内容、不用登录"，所以这里刻意做得极简：
 *   1. 从一个 URL（或仓库里的静态 JSON）拉一份配置/内容数据
 *   2. 拉到就更新本地缓存
 *   3. 拉不到（断网）就用本地缓存或内置兜底数据
 *
 * 这样做的好处：内容更新不需要重新发版上架，改 JSON 就行。
 *
 * 以后你想换成真的服务器，只要把 CONTENT_URL 指向你的接口即可，
 * 其余代码一行都不用改。
 */

import { getItem, setItem } from '@/stores/storage'

export interface Category {
  id: string
  name: string
  icon: string
  color: string
}

export interface ContentConfig {
  version: string
  updatedAt: string
  categories: Category[]
  notice?: string
}

/** 内置兜底数据：断网 + 无缓存时的最后防线 */
export const FALLBACK_CONTENT: ContentConfig = {
  version: '0.0.1',
  updatedAt: '2026-09-01',
  categories: [
    { id: 'food', name: '餐饮', icon: '🍜', color: '#ff976a' },
    { id: 'transport', name: '交通', icon: '🚌', color: '#1989fa' },
    { id: 'shopping', name: '购物', icon: '🛍️', color: '#ee0a24' },
    { id: 'life', name: '生活', icon: '🏠', color: '#07c160' },
    { id: 'other', name: '其他', icon: '📦', color: '#909399' },
  ],
  notice: '当前使用内置数据',
}

const CONTENT_URL_KEY = 'contentUrl'
const CONTENT_CACHE_KEY = 'contentCache'

/** 默认内容地址：跟着项目走的静态文件 */
const DEFAULT_CONTENT_URL = 'content/categories.json'

export function getContentUrl(): string {
  return getItem<string>(CONTENT_URL_KEY, DEFAULT_CONTENT_URL)
}

export function setContentUrl(url: string): void {
  setItem(CONTENT_URL_KEY, url.trim() || DEFAULT_CONTENT_URL)
}

/**
 * 拉取内容。策略：网络优先 → 缓存兜底 → 内置兜底
 * @param forceRefresh 传 true 时绕过缓存强制拉网络
 */
export async function fetchContent(forceRefresh = false): Promise<ContentConfig> {
  if (!forceRefresh) {
    const cached = getItem<ContentConfig | null>(CONTENT_CACHE_KEY, null)
    if (cached) return cached
  }

  const url = getContentUrl()

  // 兜底文件是打进包里的，直接 fetch 相对路径即可
  const tryFetch = async (target: string) => {
    const res = await fetch(target, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as ContentConfig
  }

  try {
    const data = await tryFetch(url)
    setItem(CONTENT_CACHE_KEY, data)
    return data
  } catch {
    try {
      // 自定义地址挂了，退回内置文件
      const data = await tryFetch(DEFAULT_CONTENT_URL)
      return data
    } catch {
      return getItem<ContentConfig>(CONTENT_CACHE_KEY, FALLBACK_CONTENT)
    }
  }
}

export function clearContentCache(): void {
  localStorage.removeItem('toolkit:' + CONTENT_CACHE_KEY)
}
