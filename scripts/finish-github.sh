#!/usr/bin/env bash
# 一键完成：配置身份 → 提交 → 关联 GitHub → 推送
#
# 用法（一行搞定）：
#   bash scripts/finish-github.sh "你的名字" "你的邮箱" "GitHub用户名" "仓库名"
#
# 示例：
#   bash scripts/finish-github.sh "武松" "wusong@example.com" "wusong" "toolkit-app"
#
# 前置条件：
#   1. 已在 github.com 创建好空仓库（不要勾选 README / .gitignore / license）
#   2. 已把 SSH 公钥加到 GitHub（运行 ssh-pubkey.sh 查看公钥）

set -e

NAME="$1"
EMAIL="$2"
GH_USER="$3"
GH_REPO="${4:-toolkit-app}"

# ---------- 参数校验 ----------
if [ -z "$NAME" ] || [ -z "$EMAIL" ] || [ -z "$GH_USER" ]; then
  echo "参数不全"
  echo ""
  echo "用法：bash scripts/finish-github.sh \"你的名字\" \"你的邮箱\" \"GitHub用户名\" [仓库名]"
  echo ""
  echo "示例：bash scripts/finish-github.sh \"武松\" \"wusong@example.com\" \"wusong\" \"toolkit-app\""
  exit 1
fi

# 定位到项目根目录（脚本在 scripts/ 下）
cd "$(dirname "$0")/.."
ROOT=$(pwd)

# Windows 上 git 的 index.lock 有时删不掉，每次操作前清一遍
unlock() { rm -f "$ROOT/.git/index.lock" 2>/dev/null || true; }

echo "=============================================="
echo "  连接 GitHub"
echo "=============================================="
echo "  身份：$NAME <$EMAIL>"
echo "  仓库：git@github.com:$GH_USER/$GH_REPO.git"
echo "=============================================="
echo ""

# ---------- 1. 配置身份 ----------
git config --global user.name "$NAME"
git config --global user.email "$EMAIL"
echo "[1/5] 身份已配置"

# ---------- 2. 提交 ----------
unlock

if [ -z "$(git status --porcelain)" ]; then
  echo "[2/5] 没有需要提交的改动"
else
  git add -A 2>/dev/null
  unlock
  git commit -q -m "feat: 初始化跨平台应用项目

- Vue 3 + Vite + Vant + Capacitor 技术栈
- 记账模块：增删改查 + 本地持久化 + 分类统计
- 云端只读内容拉取，三级兜底（网络/缓存/内置）
- PWA 支持，可安装到桌面离线使用
- GitHub Actions：网页自动部署 + Android/iOS 自动构建"
  echo "[2/5] 已提交到本地"
fi

# ---------- 3. 关联远程 ----------
unlock

if git remote get-url origin >/dev/null 2>&1; then
  echo "[3/5] 已关联远程：$(git remote get-url origin)"
else
  git remote add origin "git@github.com:${GH_USER}/${GH_REPO}.git"
  echo "[3/5] 已关联：git@github.com:${GH_USER}/${GH_REPO}.git"
fi

# ---------- 4. 测试 SSH 连接 ----------
echo ""
echo "[4/5] 检查 SSH 连接..."

if [ ! -f "$HOME/.ssh/id_ed25519.pub" ]; then
  echo ""
  echo "  没有 SSH 密钥，现在生成一个（一路回车）"
  ssh-keygen -t ed25519 -N "" -f "$HOME/.ssh/id_ed25519" >/dev/null
fi

echo ""
echo "  如果下面提示权限错误，说明公钥还没加到 GitHub。"
echo "  请复制这段内容，去 GitHub → Settings → SSH and GPG keys → New SSH key："
echo "  --------------------------------------------------------------"
cat "$HOME/.ssh/id_ed25519.pub"
echo "  --------------------------------------------------------------"
echo ""

SSH_OK=$(ssh -T -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 git@github.com 2>&1 || true)

if echo "$SSH_OK" | grep -q "successfully authenticated"; then
  echo "  SSH 连接正常"
else
  echo "  SSH 尚未连通。请先完成上面的公钥添加，然后重新运行本脚本。"
  echo "  （本地代码已经提交好了，不会丢）"
  exit 0
fi

# ---------- 5. 推送 ----------
unlock

echo ""
echo "[5/5] 推送到 GitHub..."

if git push -u origin main 2>&1; then
  echo ""
  echo "=============================================="
  echo "  推送成功"
  echo "=============================================="
  echo ""
  echo "  接下来去 GitHub 开启网页版自动部署："
  echo "  1. 打开 https://github.com/$GH_USER/$GH_REPO/settings/pages"
  echo "  2. Source 选「GitHub Actions」"
  echo "  3. 等 Actions 跑完（约 1-3 分钟）"
  echo ""
  echo "  网页版地址："
  echo "  https://$GH_USER.github.io/$GH_REPO/"
  echo "=============================================="
else
  echo ""
  echo "  推送失败。常见原因："
  echo "  - GitHub 上还没创建这个仓库 → 去 github.com/new 创建，不要勾选任何初始化选项"
  echo "  - 仓库名不一致 → 确认第 4 个参数和 GitHub 上的仓库名完全相同"
  echo ""
  echo "  代码已安全保存在本地，改好之后重新运行本脚本即可。"
fi
