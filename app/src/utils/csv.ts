import type { VaultEntry } from '@/stores/vault'

/** CSV 单元格转义（含逗号/引号/换行时整体加引号，引号翻倍） */
function csvCell(v: string): string {
  const s = v ?? ''
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

/** 把全部条目导出为 CSV 文本（带 BOM，Excel 打开中文不乱码） */
export function entriesToCSV(entries: VaultEntry[]): string {
  const header = ['名称', '分组', '标签', '密码', 'TOTP密钥', '自定义字段', '备注', '收藏', '失效时间']
  const rows = entries.map((e) => {
    const tags = (e.tags || []).join('|')
    const fields = (e.fields || [])
      .map((f) => `${f.label}=${f.value}`)
      .join(';')
    const expire = e.expiresAt ? new Date(e.expiresAt).toISOString() : ''
    return [e.name, e.group, tags, e.password, e.totp, fields, e.note, e.favorite ? '是' : '否', expire]
      .map(csvCell)
      .join(',')
  })
  return '﻿' + header.map(csvCell).join(',') + '\n' + rows.join('\n')
}

/** 触发浏览器下载 CSV（Android WebView 中通常也会弹出保存/分享） */
export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
