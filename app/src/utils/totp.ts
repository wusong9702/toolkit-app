/**
 * TOTP 动态验证码（RFC 6238），纯 Web Crypto 实现，零依赖。
 *
 * 用于「账号本子」风格的动态口令：每条目保存一个 base32 密钥，
 * 实时生成 6 位码（默认 30 秒周期，SHA-1，与 Google Authenticator 等通用）。
 *
 * 算法仅用浏览器/Node 内置的 crypto.subtle + HMAC-SHA1，不引入任何第三方库。
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

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

/**
 * 生成 TOTP 码（默认 6 位，周期 30s，SHA-1）。
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

  const hmac = await hmacSha1(secret, counterBytes)
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  let otp = (binary % 10 ** digits).toString()
  while (otp.length < digits) otp = '0' + otp
  return otp
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

/** 校验 base32 密钥是否合法（空字符串视为「未设置」，返回 true） */
export function isValidBase32(s: string): boolean {
  const clean = s.replace(/[\s=]/g, '').toUpperCase()
  if (!clean) return true
  return /^[A-Z2-7]+$/.test(clean)
}
