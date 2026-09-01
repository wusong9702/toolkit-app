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