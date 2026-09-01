#!/usr/bin/env bash
# 生成 Android 签名密钥（JKS）—— 只做一次，生成后立即备份！
#
# 用法（在项目根目录用 Git Bash 跑）：
#   bash scripts/gen-keystore.sh
#
# 会做什么：
#   1. 让你输入两次密码（交互式，密码不落盘、不经过任何对话/日志）
#   2. 用 keytool 生成 app/my-release-key.jks
#   3. 生成 app/jks.txt（keystore 的 base64，用于填 GitHub Secrets）
#   4. 打印 4 个 Secret 的填写指引
#
# 安全约定：
#   - my-release-key.jks 和 jks.txt 生成在 app/ 下，已被 .gitignore 排除，不会进 Git
#   - 密码全程只在你终端里，脚本不保存、不打印
#   - 生成后请立即把 .jks 备份到网盘 + U 盘（丢了 = 永远无法更新 App）

set -euo pipefail

# ---------- 找 keytool：优先用便携 JRE，其次系统 PATH ----------
# 注意：带 * 的路径要先做 glob 展开（shopt -s nullglob），否则 [ -x ] 不认通配符
KEYTOOL=""
shopt -s nullglob
for pattern in \
  "$HOME"/.workbuddy/binaries/jre-mirror/jdk-17*/bin/keytool \
  "$HOME"/.workbuddy/binaries/jre/jdk-17*/bin/keytool \
  "$HOME"/.workbuddy/binaries/jre/jre-17*/bin/keytool; do
  for f in $pattern; do
    if [ -f "$f" ] && [ -x "$f" ]; then KEYTOOL="$f"; break 2; fi
  done
done
shopt -u nullglob
if [ -z "$KEYTOOL" ] && command -v keytool >/dev/null 2>&1; then
  KEYTOOL="$(command -v keytool)"
fi
if [ -z "$KEYTOOL" ]; then
  echo "❌ 找不到 keytool。先下载便携 JRE（见 docs/03 或让 WorkBuddy 帮忙），或安装 JDK。"
  exit 1
fi
echo "使用 keytool: $KEYTOOL"

JKS="app/my-release-key.jks"
ALIAS="my-key-alias"

# ---------- 确认项目根目录 ----------
if [ ! -d "app" ]; then
  echo "❌ 请在项目根目录运行（当前目录看不到 app/ 文件夹）"
  exit 1
fi

# ---------- 输入密码（两次一致才继续） ----------
echo ""
echo "请设置签名密码（至少 8 位，建议字母+数字，例如 Mima@2026best）"
echo "⚠️  这个密码以后每次更新都要用，请记到你的密码管理器里！"
while true; do
  read -s -p "  输入密码: " PASS1; echo
  read -s -p "  再输一次: " PASS2; echo
  if [ "$PASS1" = "$PASS2" ] && [ ${#PASS1} -ge 8 ]; then
    break
  fi
  if [ "$PASS1" != "$PASS2" ]; then
    echo "  ❌ 两次输入不一致，重来"
  else
    echo "  ❌ 密码太短（至少 8 位），重来"
  fi
done

# ---------- 生成 JKS（已有则跳过，防止误覆盖丢章） ----------
if [ -f "$JKS" ]; then
  echo ""
  echo "⚠️  $JKS 已存在，跳过生成（防止误覆盖把老章弄丢）。"
else
  "$KEYTOOL" -genkey -v \
    -keystore "$JKS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -alias "$ALIAS" \
    -storepass "$PASS1" -keypass "$PASS1" \
    -dname "CN=wusong9702, OU=Toolkit, O=Personal, L=Beijing, ST=Beijing, C=CN" \
    >/dev/null 2>&1 || {
      echo "❌ 生成失败（可能是密码含特殊字符），请换简单一点的密码重试"
      exit 1
    }
  echo "✅ 已生成 $JKS"
fi

# ---------- 生成 base64 ----------
if command -v base64 >/dev/null 2>&1; then
  base64 -w 0 "$JKS" > app/jks.txt
else
  "C:/Users/87716/.workbuddy/binaries/python/versions/3.13.12/python.exe" \
    -c "import base64,pathlib;print(base64.b64encode(pathlib.Path('$JKS').read_bytes()).decode())" > app/jks.txt
fi
echo "✅ 已写入 app/jks.txt（$(wc -c < app/jks.txt) 字节）"

# ---------- 打印下一步 ----------
echo ""
echo "================ 接下来三步 ================"
echo "1️⃣  备份（最重要！）：把 app/my-release-key.jks 复制到网盘 + U 盘"
echo "2️⃣  打开 app/jks.txt，全选复制里面的内容"
echo "3️⃣  去 GitHub 仓库 → Settings → Secrets and variables → Actions →"
echo "    New repository secret，依次建 4 个："
echo "    - ANDROID_KEYSTORE_BASE64   = jks.txt 的内容"
echo "    - ANDROID_KEYSTORE_PASSWORD = 你刚设的密码"
echo "    - ANDROID_KEY_ALIAS         = $ALIAS"
echo "    - ANDROID_KEY_PASSWORD      = 你刚设的密码"
echo ""
echo "填完 4 个 Secret 后，在 Actions 里手动 Run workflow 选 release 即可。"
echo ""
echo "（密码不会出现在任何日志里，放心）"
