# GitHub 连接与自动构建

> 前置：已完成阶段一，本地 `npm run dev` 能正常跑起来
> 目标：把代码托管到 GitHub，推代码自动上线网页版，打标签自动出安装包

---

## 第 0 步：配置 Git 身份（只需做一次）

你的电脑现在 Git 还没设置身份，不配这个没法提交。打开终端（Git Bash），**把引号里的内容换成你自己的**：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

邮箱必须和 GitHub 注册邮箱一致，否则贡献记录不会关联到你账号。

验证一下：

```bash
git config --global user.name
git config --global user.email
```

---

## 第 1 步：生成 SSH 密钥

用 SSH 连 GitHub，好处是配一次之后不用每次输密码。

```bash
ssh-keygen -t ed25519 -C "你的邮箱"
```

一路回车即可（不要设密码，直接回车跳过）。

然后**复制公钥内容**：

```bash
cat ~/.ssh/id_ed25519.pub
```

输出是一长串以 `ssh-ed25519` 开头的文本，全部选中复制。

---

## 第 2 步：把公钥加到 GitHub

1. 登录 GitHub → 右上角头像 → **Settings**
2. 左侧 **SSH and GPG keys** → 右上角 **New SSH key**
3. Title 随便填，比如 "我的笔记本"
4. Key type 保持 **Authentication Key**
5. 把刚才复制的内容粘进 Key 框 → **Add SSH key**

验证连接：

```bash
ssh -T git@github.com
```

第一次会问 `Are you sure you want to continue?`，输入 `yes` 回车。看到 `Hi 你的用户名! You've successfully authenticated` 就成了。

---

## 第 3 步：在 GitHub 创建仓库

1. 右上角 `+` → **New repository**
2. Repository name：填 `toolkit-app`（或你喜欢的名字）
3. 选 **Public** ⚠️ 重要：私有仓库的 Actions 分钟数和 Pages 都有限制，公开仓库则免费
4. **不要**勾选 "Add a README file"、"Add .gitignore"、"Choose a license"——本地已经有了，勾了会冲突
5. 点 **Create repository**

创建完会显示一个空白仓库页面，上面有一段 "push an existing repository" 的命令，**先别急着复制**，看下一步。

---

## 第 4 步：本地初始化并推送

在项目根目录（`app/` 的上一级）执行：

```bash
# 进入项目根目录
cd "C:/Users/admin/WorkBuddy/2026-08-31-08-54-12"

# 初始化仓库
git init

# 设置默认分支名为 main
git branch -M main

# 添加所有文件（.gitignore 会自动排除 node_modules 等）
git add .

# 第一次提交
git commit -m "feat: 初始化跨平台应用项目"

# 关联远程仓库（把 wusong 换成你的 GitHub 用户名，toolkit-app 换成仓库名）
git remote add origin git@github.com:你的用户名/toolkit-app.git

# 推送
git push -u origin main
```

### 如果 push 报错

**`Permission denied (publickey)`** → SSH 密钥没配好，回到第 1、2 步检查

**`error: remote origin already exists`** → 已经关联过了，先移除再重来：
```bash
git remote remove origin
git remote add origin git@github.com:你的用户名/toolkit-app.git
```

**`failed to push some refs`** → 远程仓库有本地没有的文件（通常是建仓库时不小心勾了 README）。先拉取合并：
```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

---

## 第 5 步：开启 GitHub Pages

1. 打开仓库页面 → **Settings** → 左侧 **Pages**
2. Source 选 **GitHub Actions**（不是 "Deploy from a branch"）
3. 保存

然后点仓库顶部的 **Actions** 标签，会看到 "部署网页版" 工作流在跑。等它变绿（约 1-3 分钟）。

回到 **Settings → Pages**，页面顶部会显示你的网址：

```
https://你的用户名.github.io/toolkit-app/
```

点开就是你的应用。**用手机浏览器打开这个地址，就能用，也能装到桌面。**

> 如果打开是白屏：检查仓库名是否和 URL 路径一致。仓库名改过的话，需要重新跑一次 Actions（因为构建时把仓库名编进资源路径了）。

---

## 第 6 步：验证自动构建

以后你每次改完代码，只需要三条命令：

```bash
git add .
git commit -m "描述你改了什么"
git push
```

推送后 GitHub 会自动：

- 部署网页版（推到 main 触发）
- 打 Android 包（推 `v1.0.0` 这样的标签触发）

### 手动触发构建

不想打标签也想测试打包：

1. 仓库页面 → **Actions**
2. 左侧选 "构建 Android 安装包"
3. 右侧 **Run workflow** → 选 debug 或 release → **Run workflow**

跑完后在 Actions 页面底部 **Artifacts** 区域下载安装包。

---

## 第 7 步：打版本标签

网页版稳定后，打个标签就会自动出 Android 安装包：

```bash
git tag v1.0.0
git push origin v1.0.0
```

版本号规则建议（语义化版本）：

- `v1.0.0` 第一个正式版
- `v1.0.1` 修了个小 bug
- `v1.1.0` 加了个新功能
- `v2.0.0` 大改版，界面或数据结构变了

---

## 日常 Git 命令速查

| 命令 | 作用 |
|---|---|
| `git status` | 看看改了哪些文件 |
| `git diff` | 看看具体改了什么内容 |
| `git add .` | 把所有改动加入待提交 |
| `git commit -m "说明"` | 提交到本地 |
| `git push` | 推送到 GitHub |
| `git pull` | 拉取远程最新代码 |
| `git log --oneline` | 查看提交历史 |
| `git checkout -b 新分支名` | 开个新分支做实验 |

---

## 提交信息怎么写

不用追求规范，但写清楚能救命——三个月后你回头找"当时为什么改这行"时会感谢自己。

- ✅ `fix: 修复断网时分类显示空白的问题`
- ✅ `feat: 记账页新增按月筛选`
- ❌ `修改`
- ❌ `asdfasdf`

---

## 重要提醒

**绝对不要提交以下文件到 GitHub：**

- 签名密钥（`.keystode`、`.jks`、`.p12`）
- 密码、API Key
- `node_modules` 目录

仓库根目录的 `.gitignore` 已经把这些排除了。但如果你要放密钥，请务必用 GitHub Secrets，不要硬编码进代码。

**公开仓库意味着全世界都能看到你的代码。** 如果应用涉及商业机密，请改用私有仓库（Actions 分钟数有额度限制，但对小项目完全够用）。
