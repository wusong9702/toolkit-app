/**
 * 剪贴板工具
 *
 * 为什么需要两套方案：
 * - navigator.clipboard 是现代 API，但要求「安全上下文 + 用户手势」，
 *   在 iframe（例如编辑器内置预览面板）或非 https 页面里常常被直接拒绝。
 * - document.execCommand('copy') 虽然已废弃，但兼容性极好，
 *   在这些受限环境里依然能正常工作，是最可靠的兜底。
 *
 * 策略：先试现代 API，失败后自动降级到 execCommand，两者都失败才提示手动复制。
 */

/** 复制文本到剪贴板，返回是否成功 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false

  // 方案一：现代 Clipboard API
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 被拒绝（权限策略 / iframe / 非安全上下文），继续走降级
  }

  // 方案二：textarea + execCommand 兜底
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    // 避免选中时页面滚动跳动，同时尽量不引起视觉变化
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.left = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)

    // iOS Safari 需要显式设置选区范围，否则 execCommand 不生效
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, ta.value.length)

    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/* ---------- 敏感内容自动清除（密码管理器标配） ---------- */

let clearTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 复制敏感内容（密码等），默认 30 秒后自动清空剪贴板。
 *
 * 为什么需要：密码复制到剪贴板后会一直残留，其他 App 在后台可以读到。
 * 自动清空把泄露窗口缩到 30 秒内。
 *
 * 清空前尽量确认剪贴板内容没变（防止把用户期间新复制的内容误清掉）：
 * - 能读到剪贴板 → 内容还是我们写的那段才清空
 * - 读不到（权限/环境限制）→ 直接清空（自用场景可接受）
 */
export async function copySecret(text: string, clearAfterMs = 30_000): Promise<boolean> {
  const ok = await copyToClipboard(text)
  if (!ok) return false

  if (clearTimer) clearTimeout(clearTimer)
  clearTimer = setTimeout(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          const current = await navigator.clipboard.readText()
          if (current !== text) return // 用户已复制别的内容，别动它
        } catch {
          /* 读不了，仍清空 */
        }
        await navigator.clipboard.writeText('')
      }
    } catch {
      /* 清空失败静默处理，不打扰用户 */
    }
  }, clearAfterMs)

  return true
}
