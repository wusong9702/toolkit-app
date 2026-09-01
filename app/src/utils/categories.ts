/**
 * 账号本子风格：分组名 → Vant 图标 的关键词映射
 *
 * 分组是用户自由输入的文字，不能写死图标，所以这里做「关键词命中」：
 * 分组名里只要包含任一关键词，就返回对应图标；都不命中回退到 folder-o。
 */

interface CategoryRule {
  kw: string[]
  icon: string
}

const CATEGORY_RULES: CategoryRule[] = [
  { kw: ['社交', '微信', 'qq', '微博', '抖音', 'facebook', 'twitter', 'telegram', '聊天'], icon: 'chat-o' },
  { kw: ['邮箱', 'mail', 'email', 'gmail', '163', '126', 'outlook', '网易'], icon: 'envelop-o' },
  { kw: ['银行', '银行卡', '储蓄', '信用', '支付', '支付宝', '微信支付', 'bank', '财富'], icon: 'cash-o' },
  { kw: ['游戏', 'game', 'steam', 'psn', 'xbox', '王者', '原神', '手游', '网游'], icon: 'game-o' },
  { kw: ['工作', '公司', '企业', 'oa', '工单', '办公', 'erp', '单位'], icon: 'bag-o' },
  { kw: ['购物', '淘宝', '京东', '拼多多', '电商', 'shop', 'amazon', '天猫', '商城'], icon: 'cart-o' },
  { kw: ['影视', '视频', '电影', '电视', 'netflix', '爱奇艺', 'b站', '优酷', '音乐', '听书'], icon: 'video-o' },
  { kw: ['网站', 'web', '域名', '服务器', '云', '主机', 'ssh', 'linux', '后台', '账号'], icon: 'desktop-o' },
  { kw: ['笔记', '文档', '知识库', 'notion', '有道', 'obsidian', '云盘'], icon: 'notes-o' },
  { kw: ['学习', '学校', '教务', '课程', '校园', '考试'], icon: 'certificate' },
  { kw: ['开发', '代码', 'git', 'github', '程序', 'api', 'token', '技术'], icon: 'bulb-o' },
  { kw: ['wifi', '无线', '网络', '路由', '宽带', '热点'], icon: 'exchange' },
  { kw: ['会员', 'vip', '订阅', '充值'], icon: 'vip-card-o' },
  { kw: ['证件', '身份证', '护照', '驾照', '社保'], icon: 'idcard' },
]

const DEFAULT_ICON = 'folder-o'

/** 根据分组名返回合适的 Vant 图标名 */
export function groupIcon(name: string): string {
  const n = (name || '').toLowerCase()
  if (!n) return DEFAULT_ICON
  for (const r of CATEGORY_RULES) {
    if (r.kw.some((k) => n.includes(k.toLowerCase()))) return r.icon
  }
  return DEFAULT_ICON
}

/** 常用分组预设（带图标），供新增/编辑页「一键选分类」 */
export const CATEGORY_PRESETS: { name: string; icon: string }[] = [
  { name: '社交', icon: 'chat-o' },
  { name: '邮箱', icon: 'envelop-o' },
  { name: '银行卡', icon: 'cash-o' },
  { name: '游戏', icon: 'game-o' },
  { name: '工作', icon: 'bag-o' },
  { name: '购物', icon: 'cart-o' },
  { name: '影视', icon: 'video-o' },
  { name: '网页', icon: 'desktop-o' },
]
