# 随身工具箱 · 跨平台应用

一套代码，同时产出 **网页版 / Android / iOS**。

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
| `npm run ios:init` | 生成 iOS 原生工程 |
| `npm run cap:sync` | 构建网页并同步到原生工程 |
| `npm run android:bundle` | 一键打 Android 上架包（AAB） |

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

- **首页**：工具入口、云端公告、今日统计
- **记账**：完整的增删改查示例（本地持久化 + 分类统计 + 震动反馈）
- **设置**：内容数据源配置、数据管理、运行环境信息

记账模块是给你当模板用的——照着它的结构改，就能变成你自己的功能。

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

`app/src/styles/global.css` 和 `vite.config.ts` 里的 `#1989fa`（Vant 默认蓝）。

---

## 相关文档

- [01-技术方案.md](docs/01-技术方案.md) —— 选型理由、路线图、成本清单
- [02-GitHub与自动构建.md](docs/02-GitHub与自动构建.md) —— 连 GitHub 与自动部署
- [03-发布上架操作手册.md](docs/03-发布上架操作手册.md) —— 双端打包上架全流程
