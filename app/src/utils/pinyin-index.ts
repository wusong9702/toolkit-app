import { pinyin } from 'pinyin-pro'

/** A-Z 字母表，用于「账号本子」风格的字母定位条 */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/**
 * 计算一个名称对应的定位字母：
 * - 拉丁字母 → 本身大写
 * - 中文 → 取拼音首字母（如「微信」→ W）
 * - 数字 / 其他符号 → '#'
 */
export function indexLetter(name: string): string {
  if (!name) return '#'
  const ch = name[0]
  if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase()
  if (/[0-9０-９]/.test(ch)) return '#'
  try {
    const arr = pinyin(ch, { pattern: 'first', toneType: 'none', type: 'array' }) as string[]
    const m = (arr && arr[0] ? arr[0] : '').trim().charAt(0).toUpperCase()
    if (/[A-Z]/.test(m)) return m
  } catch {
    /* 个别字符无法转拼音，归入 # */
  }
  return '#'
}
