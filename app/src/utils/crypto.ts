/**
 * 密码本加密工具（Web Crypto 实现，零依赖）
 *
 * 安全模型（端到端加密）：
 *   主密码（用户输入） → PBKDF2 派生 256bit 密钥（随机盐 + 高迭代）
 *   所有密码条目 → AES-GCM 加密后落盘 / 上云
 *   云端（WebDAV）只保存密文 + 盐 + iv，没有主密码 = 无法解密
 *
 * 注意：Web Crypto 的 PBKDF2/AES-GCM 都是异步的。
 */

const ITERATIONS = 150_000 // OWASP 2023 推荐 ≥ 60 万，为兼顾旧手机取 15 万（界面提示后可调）

/** 生成随机字节（用于盐 / IV / 随机密码） */
export function randomBytes(len: number): Uint8Array {
  const buf = new Uint8Array(len)
  crypto.getRandomValues(buf)
  return buf
}

/** 随机生成密码（默认 16 位，含大小写/数字/符号，去除易混淆字符） */
export function generatePassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+='
  // 多取 3 字节供下面的 ensure 循环用，避免 Uint8Array 越界读到 undefined
  const bytes = randomBytes(length + 3)
  let out = ''
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length]
  // 保证至少含一个大写、小写、数字，避免某些网站校验不通过
  const ensure = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789']
  ensure.forEach((set, idx) => {
    out = out.slice(0, idx) + set[bytes[idx + length] % set.length] + out.slice(idx + 1)
  })
  return out
}

/**
 * 密码强度评估（账号本子风格：长度 + 字符集多样性 + 重复/序列/常见词 扣分）。
 * 返回 0~4 分、等级、中文标签、颜色、进度百分比、以及改进建议。
 */
export interface PasswordStrength {
  score: number // 0~4
  level: 'weak' | 'fair' | 'good' | 'strong'
  label: string // 弱 / 中 / 强 / 很强
  color: string
  percent: number // 0~100
  suggestions: string[]
}

const COMMON_WEAK = [
  'password', '123456', '111111', '123123', 'qwerty', 'abc123',
  '000000', '1q2w3e', 'admin', 'passw0rd', 'iloveyou', '666666',
  '888888', '12345678', '123456789', 'a123456', 'password1',
]

export function passwordStrength(pwd: string): PasswordStrength {
  if (!pwd) {
    return { score: 0, level: 'weak', label: '空', color: '#c8c9cc', percent: 0, suggestions: ['请输入密码'] }
  }
  const len = pwd.length
  const lower = /[a-z]/.test(pwd)
  const upper = /[A-Z]/.test(pwd)
  const digit = /\d/.test(pwd)
  const symbol = /[^A-Za-z0-9]/.test(pwd)
  const variety = [lower, upper, digit, symbol].filter(Boolean).length
  const suggestions: string[] = []
  let score = 0

  if (len < 8) suggestions.push('密码太短，至少 8 位')
  if (len >= 8) score++
  if (len >= 12) score++
  if (len >= 16) score++
  if (variety >= 3) score++
  else suggestions.push('混合大小写、数字、符号更安全')
  if (variety === 4) score++

  // 重复字符过多
  const uniqueRatio = new Set(pwd).size / len
  if (uniqueRatio < 0.6) {
    suggestions.push('避免重复字符')
    score = Math.max(0, score - 1)
  }
  // 连续序列（键盘或数字）
  if (/(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv|password)/i.test(pwd)) {
    suggestions.push('避免连续序列')
    score = Math.max(0, score - 1)
  }
  // 常见弱密码
  if (COMMON_WEAK.includes(pwd.toLowerCase())) {
    score = 0
    suggestions.push('这是常见弱密码，极易被破解')
  }
  // 仅数字或仅字母且偏短
  if (variety === 1 && len < 12) {
    suggestions.push('不要只用一种字符')
    score = Math.max(0, score - 1)
  }

  score = Math.max(0, Math.min(4, score))
  const STRONG_MAP = [
    { label: '弱', color: '#ee0a24' },
    { label: '弱', color: '#ee0a24' },
    { label: '中', color: '#ff976a' },
    { label: '强', color: '#07c160' },
    { label: '很强', color: '#1989fa' },
  ]
  const m = STRONG_MAP[score]
  if (score >= 3 && suggestions.length === 0) suggestions.push('强度不错，继续保持')
  return {
    score,
    level: (score <= 1 ? 'weak' : score === 2 ? 'fair' : score === 3 ? 'good' : 'strong'),
    label: m.label,
    color: m.color,
    percent: Math.round((score / 4) * 100),
    suggestions,
  }
}

/** 高级随机密码生成（密码生成器页用），可定制长度与字符集 */
export interface GenOptions {
  length?: number
  upper?: boolean
  lower?: boolean
  digit?: boolean
  symbol?: boolean
  /** 排除易混淆字符（1lI0Oo 等） */
  excludeSimilar?: boolean
}

const GEN_SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digit: '0123456789',
  symbol: '!@#$%^&*()-_=+[]{};:,.<>?',
}
const SIMILAR = 'ilILoOo01|\'`"'

export function generatePasswordAdvanced(opts: GenOptions = {}): string {
  const length = opts.length ?? 16
  const useUpper = opts.upper ?? true
  const useLower = opts.lower ?? true
  const useDigit = opts.digit ?? true
  const useSymbol = opts.symbol ?? true
  const excludeSimilar = opts.excludeSimilar ?? false

  const pick = (set: string) =>
    excludeSimilar ? set.split('').filter((c) => !SIMILAR.includes(c)).join('') : set

  const order: Array<[keyof typeof GEN_SETS, boolean]> = [
    ['upper', useUpper],
    ['lower', useLower],
    ['digit', useDigit],
    ['symbol', useSymbol],
  ]
  let pool = ''
  const activeSets: string[] = []
  order.forEach(([key, on]) => {
    if (on) {
      const s = pick(GEN_SETS[key])
      if (s) {
        pool += s
        activeSets.push(s)
      }
    }
  })
  if (!pool) pool = GEN_SETS.lower
  if (!activeSets.length) activeSets.push(GEN_SETS.lower)

  // 多取几个字节，保证 ensure 循环不会越界
  const bytes = randomBytes(length + activeSets.length + 2)
  let out = ''
  for (let i = 0; i < length; i++) out += pool[bytes[i] % pool.length]

  // 确保每种被选中的字符集至少出现一次（避免某些网站校验不通过）
  activeSets.slice(0, length).forEach((set, idx) => {
    out = out.slice(0, idx) + set[bytes[idx + length] % set.length] + out.slice(idx + 1)
  })
  return out
}

/** 从主密码派生出 AES-GCM 密钥（PBKDF2）。盐要随密文一起保存，用于再次派生。 */
export async function deriveKey(masterPassword: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(masterPassword), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** 加密封装：返回 { salt, iv, cipher }（都是 base64，方便 localStorage / WebDAV 文本传输） */
export async function encryptData(
  plain: string,
  masterPassword: string,
): Promise<{ salt: string; iv: string; cipher: string }> {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await deriveKey(masterPassword, salt)
  const enc = new TextEncoder()
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain))
  return { salt: toBase64(salt), iv: toBase64(iv), cipher: toBase64(new Uint8Array(cipherBuf)) }
}

/** 解密：传入 encryptData 的返回对象 + 主密码，返回明文；密码错误会抛异常 */
export async function decryptData(
  data: { salt: string; iv: string; cipher: string },
  masterPassword: string,
): Promise<string> {
  const key = await deriveKey(masterPassword, fromBase64(data.salt))
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(data.iv) },
    key,
    fromBase64(data.cipher).buffer as ArrayBuffer,
  )
  return new TextDecoder().decode(plainBuf)
}

/** 用主密码加密一个对象（自动 JSON 序列化），返回可安全存储/上传的结构 */
export async function encryptObject<T>(
  obj: T,
  masterPassword: string,
): Promise<{ v: number; salt: string; iv: string; cipher: string }> {
  const { salt, iv, cipher } = await encryptData(JSON.stringify(obj), masterPassword)
  return { v: 1, salt, iv, cipher }
}

/** 解密并反序列化为对象；密码错误抛异常，由调用方捕获 */
export async function decryptObject<T>(
  data: { v?: number; salt: string; iv: string; cipher: string },
  masterPassword: string,
): Promise<T> {
  const plain = await decryptData(data, masterPassword)
  return JSON.parse(plain) as T
}

function toBase64(buf: Uint8Array): string {
  let bin = ''
  buf.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin)
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}