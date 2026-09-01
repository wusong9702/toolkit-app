/**
 * TOTP 动态验证码（RFC 6238），纯 Web Crypto 实现，零依赖。
 *
 * 两种类型：
 *  - standard：base32 密钥，6 位码（默认 30 秒周期，SHA-1），兼容 Google Authenticator / 1Password 等通用验证器
 *  - steam：    base64 密钥（Steam 的 shared_secret），5 位字母数字码，对标 Steam Guard 手机令牌
 *
 * 算法仅用浏览器/Node 内置的 crypto.subtle + HMAC-SHA1，不引入任何第三方库。
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Steam 令牌字符集（26 个，排除易混淆字符如 0/O/1/I 等） */
const STEAM_ALPHABET = '23456789BCDFGHJKMNPQRTVWXY'

export type TotpType = 'standard' | 'steam'

/** base32 解码（忽略空格与 = 填充，大小写不敏感，跳过非法字符） */
function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/[\s=]/g, '').toUpperCase()
  if (!clean) return new Uint8Array(0)
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out.push((value >>> bits) & 0xff)
    }
  }
  return new Uint8Array(out)
}

/** base64 解码（Steam 的 shared_secret 以 base64 形式提供） */
function base64Decode(input: string): Uint8Array {
  const clean = input.trim()
  const bin =
    typeof atob === 'function'
      ? atob(clean)
      : Buffer.from(clean, 'base64').toString('binary')
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** HMAC-SHA1，返回签名字节 */
async function hmacSha1(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msg)
  return new Uint8Array(sig)
}

/** 取 RFC 6238 / Steam 共用的 31 位动态二进制（从 HMAC 末尾取 4 字节，最高位清零） */
async function dynamicBinary(key: Uint8Array, counterBytes: Uint8Array): Promise<number> {
  const hmac = await hmacSha1(key, counterBytes)
  const offset = hmac[hmac.length - 1] & 0x0f
  // 最高位清 0（& 0x7f），保证是 31 位正整数，避免 JS 有符号位移的符号问题
  return (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  )
}

/**
 * 生成标准 TOTP 码（默认 6 位，周期 30s，SHA-1）。
 * @param secretBase32 base32 编码的密钥（Google Authenticator 导出的那种）
 * @param options.time  指定时间（ms，默认当前时间）；用于测试向量校验
 * @param options.step  周期秒数（默认 30）
 * @param options.digits 位数（默认 6，测试向量用 8）
 */
export async function generateTOTP(
  secretBase32: string,
  options: { time?: number; step?: number; digits?: number } = {},
): Promise<string> {
  const step = options.step ?? 30
  const digits = options.digits ?? 6
  const time = options.time ?? Date.now()
  const secret = base32Decode(secretBase32)
  if (secret.length === 0) return ''

  const counter = Math.floor(time / 1000 / step)
  // 8 字节大端计数器。counter 在可预见的未来远小于 2^53，用普通数字拆分即可。
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  view.setUint32(0, Math.floor(counter / 2 ** 32))
  view.setUint32(4, counter % 2 ** 32)
  const counterBytes = new Uint8Array(buf)

  const binary = await dynamicBinary(secret, counterBytes)
  let otp = (binary % 10 ** digits).toString()
  while (otp.length < digits) otp = '0' + otp
  return otp
}

/**
 * 生成 Steam Guard 动态码（5 位，字符集见 STEAM_ALPHABET，周期 30s，SHA-1）。
 * 算法与 Valve 官方一致：用 shared_secret（base64）做 HMAC-SHA1，取动态二进制后
 * 连续 5 次「对 26 取模挑字符、除以 26」得到 5 位码。
 * @param secretBase64 base64 编码的 Steam shared_secret
 * @param time 指定时间（ms，默认当前时间）
 */
export async function generateSteamTOTP(secretBase64: string, time = Date.now()): Promise<string> {
  const step = 30
  const key = base64Decode(secretBase64)
  if (key.length === 0) return ''

  const counter = Math.floor(time / 1000 / step)
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  view.setUint32(0, Math.floor(counter / 2 ** 32))
  view.setUint32(4, counter % 2 ** 32)
  const counterBytes = new Uint8Array(buf)

  let code = await dynamicBinary(key, counterBytes)
  let chars = ''
  for (let i = 0; i < 5; i++) {
    chars += STEAM_ALPHABET[code % STEAM_ALPHABET.length]
    code = Math.floor(code / STEAM_ALPHABET.length)
  }
  return chars
}

/**
 * 按类型生成动态码（统一入口）。
 */
export async function generateTotpByType(
  secret: string,
  type: TotpType = 'standard',
  time = Date.now(),
): Promise<string> {
  return type === 'steam' ? generateSteamTOTP(secret, time) : generateTOTP(secret, { time })
}

/** 当前码 + 剩余秒数（用于倒计时显示）。无密钥返回 null */
export async function currentTOTP(
  secretBase32: string,
  step = 30,
): Promise<{ code: string; remaining: number } | null> {
  if (!secretBase32) return null
  const code = await generateTOTP(secretBase32, { step })
  const remaining = step - Math.floor((Date.now() / 1000) % step)
  return { code, remaining }
}

/** 按类型取「当前码 + 剩余秒数」（列表页 / 编辑预览统一用这个） */
export async function currentTotpByType(
  secret: string,
  type: TotpType = 'standard',
): Promise<{ code: string; remaining: number } | null> {
  if (!secret) return null
  const code = await generateTotpByType(secret, type)
  if (!code) return null
  const remaining = 30 - Math.floor((Date.now() / 1000) % 30)
  return { code, remaining }
}

/** 校验 base32 密钥是否合法（空字符串视为「未设置」，返回 true） */
export function isValidBase32(s: string): boolean {
  const clean = s.replace(/[\s=]/g, '').toUpperCase()
  if (!clean) return true
  return /^[A-Z2-7]+$/.test(clean)
}

/** 校验 Steam base64 密钥是否合法（空字符串视为「未设置」，返回 true） */
export function isValidSteamSecret(s: string): boolean {
  const clean = s.trim()
  if (!clean) return true // 空 = 未设置
  if (!/^[A-Za-z0-9+/=]+$/.test(clean)) return false
  try {
    return base64Decode(clean).length > 0
  } catch {
    return false
  }
}
