#!/usr/bin/env bash
# Git 初始化引导脚本
# 用法：bash scripts/setup-git.sh
# 作用：一步步带你完成 Git 身份配置 + 首次提交

set -e

echo "=============================================="
echo "  Git 初始化引导"
echo "=============================================="
echo ""

# ---------- 1. 检查 Git ----------
if ! command -v git &>/dev/null; then
  echo "[×] 没检测到 Git，请先安装：https://git-scm.com/"
  exit 1
fi
echo "[√] Git 已安装：$(git --version)"
echo ""

# ---------- 2. 配置身份 ----------
CURRENT_NAME=$(git config --global user.name || true)
CURRENT_EMAIL=$(git config --global user.email || true)

if [ -z "$CURRENT_NAME" ] || [ -z "$CURRENT_EMAIL" ]; then
  echo "首次使用，需要先配置身份（提交记录会显示这些信息）"
  echo ""
  read -r -p "你的名字（英文或中文都行）: " INPUT_NAME
  read -r -p "你的 GitHub 注册邮箱: " INPUT_EMAIL

  git config --global user.name "$INPUT_NAME"
  git config --global user.email "$INPUT_EMAIL"
  echo "[√] 身份已配置"
else
  echo "[√] Git 身份：$CURRENT_NAME <$CURRENT_EMAIL>"
  read -r -p "要改吗？(y/N): " CHANGE_IT
  if [ "$CHANGE_IT" = "y" ] || [ "$CHANGE_IT" = "Y" ]; then
    read -r -p "新名字: " INPUT_NAME
    read -r -p "新邮箱: " INPUT_EMAIL
    git config --global user.name "$INPUT_NAME"
    git config --global user.email "$INPUT_EMAIL"
    echo "[√] 已更新"
  fi
fi
echo ""

# ---------- 3. SSH 密钥 ----------
if [ -f "$HOME/.ssh/id_ed25519.pub" ]; then
  echo "[√] SSH 密钥已存在"
  echo "    公钥内容如下（如果还没加到 GitHub，复制它去 Settings → SSH keys）："
  echo "----------------------------------------------"
  cat "$HOME/.ssh/id_ed25519.pub"
  echo "----------------------------------------------"
else
  echo "没有 SSH 密钥，现在生成一个（一路回车即可）"
  read -r -p "现在生成？(Y/n): " GEN_KEY
  if [ "$GEN_KEY" != "n" ] && [ "$GEN_KEY" != "N" ]; then
    ssh-keygen -t ed25519 -C "$CURRENT_EMAIL"
    echo ""
    echo "[√] 已生成，把下面的内容完整复制到 GitHub："
    echo "----------------------------------------------"
    cat "$HOME/.ssh/id_ed25519.pub"
    echo "----------------------------------------------"
  fi
fi
echo ""

# ---------- 4. 初始化仓库 ----------
cd "$(dirname "$0")/.."

if [ -d ".git" ]; then
  echo "[√] 仓库已初始化过"
else
  git init
  git branch -M main
  echo "[√] 仓库已初始化"
fi
echo ""

# ---------- 5. 检查敏感文件 ----------
echo "检查是否有不该提交的文件..."
DANGER=$(git status --porcelain 2>/dev/null | grep -Ei '\.(jks|keystore|p12|mobileprovision)$' || true)
if [ -n "$DANGER" ]; then
  echo "[!] 警告：检测到签名文件，千万不要提交："
  echo "$DANGER"
  read -r -p "仍然继续？(y/N): " CONTINUE
  [ "$CONTINUE" = "y" ] || exit 1
else
  echo "[√] 没有发现签名文件"
fi
echo ""

# ---------- 6. 提交 ----------
if [ -z "$(git status --porcelain)" ]; then
  echo "[√] 没有需要提交的改动"
else
  echo "待提交的文件："
  git status --short
  echo ""
  read -r -p "提交说明（直接回车用默认）: " MSG
  git add .
  git commit -m "${MSG:-chore: 更新项目文件}"
  echo "[√] 已提交到本地"
fi
echo ""

# ---------- 7. 关联远程 ----------
REMOTE=$(git remote get-url origin 2>/dev/null || true)
if [ -n "$REMOTE" ]; then
  echo "[√] 已关联远程仓库：$REMOTE"
else
  echo "还没关联 GitHub 仓库。"
  echo "请先在 GitHub 上创建仓库（不要勾选 README），然后填下面的信息："
  read -r -p "GitHub 用户名: " GH_USER
  read -r -p "仓库名: " GH_REPO
  git remote add origin "git@github.com:${GH_USER}/${GH_REPO}.git"
  echo "[√] 已关联：git@github.com:${GH_USER}/${GH_REPO}.git"
  echo ""
  read -r -p "现在推送到 GitHub？(Y/n): " DO_PUSH
  if [ "$DO_PUSH" != "n" ] && [ "$DO_PUSH" != "N" ]; then
    git push -u origin main
    echo "[√] 推送完成"
  fi
fi
echo ""
echo "=============================================="
echo "  完成。下一步：去仓库 Settings → Pages"
echo "  把 Source 改成 GitHub Actions"
echo "=============================================="
