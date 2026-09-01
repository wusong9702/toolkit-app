import type { VaultEntry } from '@/stores/vault'

/**
 * 模糊匹配：名称 / 密码 / 备注 / 分组 / 标签 / 自定义字段 / TOTP 密钥，不分大小写。
 * 全字段搜索是「账号本子」风格查找的核心。
 */
export function matchEntry(e: VaultEntry, kw: string): boolean {
  const k = kw.toLowerCase()
  if (e.name.toLowerCase().includes(k)) return true
  if (e.password.toLowerCase().includes(k)) return true
  if (e.note.toLowerCase().includes(k)) return true
  if (e.group.toLowerCase().includes(k)) return true
  if (e.totp.toLowerCase().includes(k)) return true
  if ((e.tags || []).some((t) => t.toLowerCase().includes(k))) return true
  if (
    (e.fields || []).some(
      (f) => f.label.toLowerCase().includes(k) || f.value.toLowerCase().includes(k),
    )
  )
    return true
  return false
}
