# 随身工具箱 · 跨平台应用

一套代码，同时产出 **网页版 / Android**（iOS 端暂不纳入范围）。

技术栈：Vue 3 + Vite + Vant 4 + Pinia + Capacitor 7。

---

## 快速开始

```bash
cd app
npm install
npm run dev
```

浏览器打开 http://localhost:5173

> 想用手机看：终端会显示一个 `Network: http://192.168.x.x:5173` 地址，手机和电脑连同一个 WiFi，浏览器打开那个地址即可。

---

## 可用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建网页版到 `dist/` |
| `npm run preview` | 本地预览构建结果 |
| `npm run typecheck` | 类型检查 |
| `npm run android:init` | 生成 Android 原生工程 |
| `npm run cap:sync` | 构建网页并同步到原生工程 |
| `npm run android:bundle` | 一键打 Android 上架包（AAB） |

---

## 安装到手机（Android）

云端自动构建，出的是**正式签名包**（以后更新直接覆盖安装，不丢数据）：

1. 打开仓库的 **Actions** 页面 → 最新一次「构建 Android 安装包」运行
2. 页面底部 **Artifacts** 区下载 `android-build`（zip）
3. 解压得到 `app-release.apk`，传到手机（微信/QQ/数据线/网盘均可）
4. 手机点击安装，提示"未知来源"时选**允许**（自签名应用正常提示）
5. 打开 App → 设置主密码 + 配置 WebDAV，即可与网页版数据互通

> 想重新构建：在 Actions 页面手动触发（选 debug 或 release），或打一个新标签 `git tag v1.0.1 && git push origin v1.0.1`。

---

## 目录说明

```
app/src/
├── views/     页面组件
├── stores/    数据状态（Pinia）
├── api/       云端内容拉取
├── router/    路由配置
└── styles/    全局样式
```

新增一个功能模块，照着这三步来：

1. `views/` 下新建一个 `.vue` 页面
2. `router/index.ts` 里加一条路由
3. 需要持久化数据就在 `stores/` 下加一个 store

---

## 现有功能模块

- **密码本**（核心）：端到端加密（PBKDF2 15 万次 + AES-256-GCM）、主密码锁、
  随机密码生成、失效时间、收藏、分组/标签、**触屏拖拽排序**、条目级多设备冲突合并
- **账号本子风格扩展**（v1.1.0）：
  - **自定义字段**：每条目可附加任意键值（手机号 / 密保 / 链接等），敏感字段可标记「隐藏」
  - **TOTP 动态验证码**：保存密钥，列表页实时显示动态码与倒计时；支持「通用验证器」（base32，RFC 6238，兼容 Google Authenticator / 1Password）与「Steam 令牌」（base64 shared_secret，对标 Steam Guard 手机令牌）
  - **顶部全字段搜索**：名称 / 密码 / 备注 / 标签 / 自定义字段 / TOTP 密钥一处搜全
  - **A-Z 字母定位条**：右侧字母栏一键跳到对应拼音首字母分组（中文按拼音）
  - **指纹 / 面容解锁**：原生 App 内可用生物识别代替主密码解锁（密钥存于系统安全存储）
  - **后台自动锁定**：切到后台超过设定时间（10 秒~5 分钟）自动锁定，可自定义
  - **输错锁定**：主密码连续输错 5 次锁定 1 分钟
  - **CSV 导出备份**：一键导出全部条目（含自定义字段 / TOTP 密钥）为 CSV
- **云同步**：WebDAV（坚果云/Nextcloud/ownCloud），云端只存密文，复制密码后
  **30 秒自动清空剪贴板**
- **首页**：搜索栏、收藏区、分组宫格（含条目数）、悬浮新增
- **设置**：WebDAV 配置与连通测试、自动锁定与生物识别开关、CSV 导出、数据管理（清空/重置）、运行环境信息

> 密码本的数据结构是"模板级"的（条目 + 分组 + 标签 + 备注 + 失效时间 + 自定义字段 + TOTP），
> 想扩展字段直接在 `app/src/stores/vault.ts` 的 `VaultEntry` 接口上加即可。

---

## 修改你自己的配置

**1. 改应用标识**（上架前必须改）

`app/capacitor.config.ts`：

```ts
appId: 'com.example.toolkit',  // 改成 com.你的名字.应用名
appName: '工具箱',              // 改成你的应用名
```

**2. 改云端内容**

`app/public/content/categories.json` —— 改这个文件，App 里的分类和公告就跟着变，不需要重新发版。

**3. 改主题色**

应用内「设置 → 外观」可直接切换深色模式与强调色（蓝/绿/橙/红/紫/青），无需改代码。
如需改默认色，可改 `app/src/styles/global.css` 与 `vite.config.ts` 里的 `#1989fa`（Vant 默认蓝）。

---

## 相关文档

- [01-技术方案.md](docs/01-技术方案.md) —— 选型理由、路线图、成本清单
- [02-GitHub与自动构建.md](docs/02-GitHub与自动构建.md) —— 连 GitHub 与自动部署
- [03-发布上架操作手册.md](docs/03-发布上架操作手册.md) —— Android 打包上架全流程
