/**
 * 本地存储工具
 *
 * 打包成 App 后 localStorage 依然可用，但系统内存紧张时可能被清掉。
 * 所以对重要数据：
 *   - 短期 / 可丢失 → localStorage（现在用的）
 *   - 重要数据     → 换成 @capacitor/preferences 或 SQLite
 */
const PREFIX = 'toolkit:'

export function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (e) {
    console.warn('[storage] 写入失败', e)
  }
}

export function removeItem(key: string): void {
  localStorage.removeItem(PREFIX + key)
}

export function clearAll(): void {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k))
}
