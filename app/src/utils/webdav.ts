/**
 * WebDAV 同步客户端（纯 fetch 实现，零依赖）
 *
 * 支持标准 WebDAV 服务：坚果云（Nutstore）、Nextcloud、ownCloud、
 * 以及支持 WebDAV 的 NAS/服务器。
 *
 * 用途：把「加密后的密码库」文件同步到云端。
 * 密码库在本地（crypto.ts）已完成端到端加密，这里只负责上传/下载「密文文件」，
 * 云端永远拿不到主密码和明文。
 *
 * 配置（设置页填写）：
 *   url      WebDAV 服务地址（如 https://dav.jianguoyun.com/dav/）
 *   username 账号（坚果云是邮箱）
 *   password 应用密码（坚果云是「应用密码」，不是登录密码！）
 *   dir      存放目录名，默认 password-vault
 */

export interface WebDavConfig {
  url: string
  username: string
  password: string
  dir: string
}

const DEFAULT_DIR = 'password-vault'
const FILE_NAME = 'vault.json.enc'

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : url + '/'
}

function encodeUserPass(username: string, password: string): string {
  return 'Basic ' + btoa(`${username}:${password}`)
}

/** 目标文件完整 URL（服务地址 + 目录 + 固定文件名） */
export function vaultFileUrl(cfg: WebDavConfig): string {
  return ensureTrailingSlash(cfg.url) + cfg.dir + '/' + FILE_NAME
}

async function request(
  cfg: WebDavConfig,
  url: string,
  method: string,
  body?: BodyInit | null,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return fetch(url, {
    method,
    headers: {
      Authorization: encodeUserPass(cfg.username, cfg.password),
      ...extraHeaders,
    },
    body,
  })
}

/** 确保存放目录存在（MKCOL，已存在会 405，忽略） */
export async function ensureDir(cfg: WebDavConfig): Promise<void> {
  const base = ensureTrailingSlash(cfg.url)
  const dirUrl = base + cfg.dir
  const res = await request(cfg, dirUrl, 'MKCOL')
  if (res.status === 405 || res.ok) return // 405 = 已存在
  if (res.status === 401 || res.status === 403) {
    throw new Error('WebDAV 认证失败：请检查账号和应用密码（坚果云要用应用密码）')
  }
  throw new Error(`创建目录失败（HTTP ${res.status}）`)
}

/** 云端是否已有加密库文件 */
export async function hasVaultFile(cfg: WebDavConfig): Promise<boolean> {
  const res = await request(cfg, vaultFileUrl(cfg), 'HEAD')
  return res.ok
}

/** 读取云端加密库文件（不存在返回 null） */
export async function fetchVault(cfg: WebDavConfig): Promise<string | null> {
  const res = await request(cfg, vaultFileUrl(cfg), 'GET')
  if (res.status === 404) return null
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('WebDAV 认证失败：请检查账号和应用密码')
    }
    throw new Error(`读取云端失败（HTTP ${res.status}）`)
  }
  return res.text()
}

/** 上传加密库文件（覆盖写） */
export async function pushVault(cfg: WebDavConfig, content: string): Promise<void> {
  const res = await request(cfg, vaultFileUrl(cfg), 'PUT', content, {
    'Content-Type': 'application/octet-stream',
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('WebDAV 认证失败：请检查账号和应用密码')
    }
    throw new Error(`上传云端失败（HTTP ${res.status}）`)
  }
}

/** 删除云端加密库文件 */
export async function deleteVault(cfg: WebDavConfig): Promise<void> {
  const res = await request(cfg, vaultFileUrl(cfg), 'DELETE')
  if (!res.ok && res.status !== 404) {
    throw new Error(`删除云端失败（HTTP ${res.status}）`)
  }
}

/** 连通测试结果 */
export interface ConnectionTestResult {
  ok: boolean
  /** 给用户看的结果描述 */
  message: string
  /** 云端是否已存在加密库文件 */
  hasRemoteFile: boolean
}

/**
 * 测试 WebDAV 配置是否可用（设置页「测试连通」按钮）。
 *
 * 三步走：
 * 1. PROPFIND 根地址（Depth: 0）—— 验证地址可达 + 账号密码正确
 * 2. MKCOL 同步目录 —— 验证有写入权限（已存在返回 405，视为通过）
 * 3. HEAD 库文件 —— 顺便告诉用户云端是否已有备份
 *
 * 注意：浏览器里直连第三方 WebDAV 可能被 CORS 拦截（fetch 抛 TypeError）。
 * 坚果云就不发 CORS 头，网页版会连不上 —— 这不是配置错，是浏览器安全策略。
 * 打包成 App（Capacitor 原生壳）后没有这个限制。
 */
export async function testConnection(cfg: WebDavConfig): Promise<ConnectionTestResult> {
  const fail = (message: string): ConnectionTestResult => ({
    ok: false,
    message,
    hasRemoteFile: false,
  })

  if (!cfg.url || !cfg.username || !cfg.password) {
    return fail('请先填完整地址、账号和应用密码')
  }

  // 第一步：验证地址 + 认证
  let res: Response
  try {
    res = await request(cfg, ensureTrailingSlash(cfg.url), 'PROPFIND', undefined, {
      Depth: '0',
    })
  } catch {
    return fail(
      '连接失败：地址不通或被浏览器跨域（CORS）拦截。' +
        '请检查地址拼写；坚果云等不支持浏览器直连，需打包成 App 后使用',
    )
  }

  if (res.status === 401 || res.status === 403) {
    return fail('认证失败：请检查账号和应用密码（坚果云要用「应用密码」，不是登录密码）')
  }
  if (!res.ok && res.status !== 207) {
    // 207 = PROPFIND 成功的标准返回码；部分服务返回 200
    return fail(`服务地址异常（HTTP ${res.status}），请确认这是 WebDAV 地址`)
  }

  // 第二步：验证目录可写
  try {
    await ensureDir(cfg)
  } catch (e) {
    return fail(e instanceof Error ? e.message : '目录创建失败')
  }

  // 第三步：探测云端是否已有备份
  let hasRemoteFile = false
  try {
    hasRemoteFile = await hasVaultFile(cfg)
  } catch {
    /* 探测失败不影响连通结论 */
  }

  return {
    ok: true,
    message: hasRemoteFile
      ? '连接成功，云端已有加密备份'
      : '连接成功，云端还没有备份（首次同步后自动创建）',
    hasRemoteFile,
  }
}