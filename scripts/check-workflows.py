"""校验 GitHub Actions 工作流：YAML 能解析 + 每个 run 脚本的 shell 语法能过 bash -n。

用法：python scripts/check-workflows.py
"""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS = sorted((ROOT / ".github" / "workflows").glob("*.yml"))

# Windows 上直接调 "bash" 很可能命中 WSL 的转发器（它会提示"未安装 Linux 子系统"然后返回非 0），
# 真正的 Git Bash 通常不在 PATH 里，所以要主动找。
CANDIDATE_BASH = [
    os.environ.get("BASH_PATH"),
    shutil.which("bash"),
    Path.home() / ".workbuddy/binaries/PortableGit/versions/1.2.0/usr/bin/bash.exe",
    Path("C:/Program Files/Git/usr/bin/bash.exe"),
    Path("C:/Program Files/Git/bin/bash.exe"),
    Path("C:/Program Files (x86)/Git/usr/bin/bash.exe"),
]


def find_bash():
    """挑一个能真正跑起来的 bash。"""
    for candidate in CANDIDATE_BASH:
        if not candidate:
            continue
        try:
            result = subprocess.run(
                [str(candidate), "-c", "echo ok"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=15,
            )
        except (OSError, subprocess.SubprocessError):
            continue
        if result.returncode == 0 and "ok" in (result.stdout or ""):
            return str(candidate)
    return None


def collect_scripts(node, path=""):
    """深度优先找出所有 run: 的 shell 脚本。"""
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "run" and isinstance(value, str):
                yield path + "/run", value
            else:
                yield from collect_scripts(value, f"{path}/{key}")
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from collect_scripts(value, f"{path}[{index}]")


def check_heredocs(script):
    """heredoc 结束符必须顶格，否则 bash 认为 heredoc 没结束。"""
    problems = []
    open_delim = None
    for line in script.splitlines():
        stripped = line.strip()
        if open_delim is None:
            if "<<" in line and ("EOF" in line or "PLIST" in line):
                marker = line.split("<<", 1)[1].strip().lstrip("-")
                open_delim = marker
        elif stripped == open_delim:
            if line.startswith((" ", "\t")):
                problems.append(f"heredoc 结束符 {open_delim} 前面有缩进，bash 不认")
            open_delim = None
    if open_delim is not None:
        problems.append(f"heredoc {open_delim} 没有配对的结束符")
    return problems


def check_github_expr(node, path=""):
    """校验 GitHub Actions 表达式语法。
    目前已知规则：
    - if: 条件里不能直接用 secrets.XXX（报 Unrecognized named-value: 'secrets'，
      整个工作流文件判为无效）。官方做法：先注入 env，再判断 env.XXX。
    """
    problems = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "if" and isinstance(value, str) and "secrets." in value:
                problems.append(
                    f"{path}/if: 条件里直接用了 secrets（{value.strip()}）。"
                    "GitHub 不允许，请先注入 job 级 env 再判断 env.XXX"
                )
            else:
                problems.extend(check_github_expr(value, f"{path}/{key}"))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            problems.extend(check_github_expr(value, f"{path}[{index}]"))
    return problems


def main():
    if not WORKFLOWS:
        print("没找到工作流文件")
        return 1

    bash = find_bash()
    if not bash:
        print("❌ 找不到可用的 bash，设置环境变量 BASH_PATH 指向 Git Bash 再试")
        return 1
    print(f"使用 bash: {bash}")

    failed = False
    for wf in WORKFLOWS:
        print(f"\n=== {wf.name} ===")
        try:
            data = yaml.safe_load(wf.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            print(f"  ❌ YAML 解析失败：{exc}")
            failed = True
            continue
        print("  ✅ YAML 解析通过")

        expr_problems = check_github_expr(data)
        if expr_problems:
            for problem in expr_problems:
                print(f"  ❌ {problem}")
            failed = True
        else:
            print("  ✅ GitHub Actions 表达式检查通过")

        script_count = 0
        for path, script in collect_scripts(data):
            script_count += 1
            # GitHub 会先做变量替换，这里把 ${{ ... }} 换成占位符再验语法
            normalized = script
            while "${{" in normalized:
                start = normalized.index("${{")
                end = normalized.index("}}", start) + 2
                normalized = normalized[:start] + "PLACEHOLDER" + normalized[end:]

            for problem in check_heredocs(script):
                print(f"  ❌ {path}: {problem}")
                failed = True

            with tempfile.NamedTemporaryFile(
                "w", suffix=".sh", delete=False, encoding="utf-8"
            ) as handle:
                handle.write(normalized)
                temp_path = handle.name

            # Git Bash 认 POSIX 风格的路径，反斜杠会被当成转义符
            result = subprocess.run(
                [bash, "-n", Path(temp_path).as_posix()],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            Path(temp_path).unlink(missing_ok=True)

            if result.returncode != 0:
                detail = (result.stderr or "").strip()
                print(f"  ❌ {path}: shell 语法错误\n{detail}")
                failed = True
            else:
                print(f"  ✅ {path}: shell 语法通过")

        if script_count == 0:
            print("  （没有可校验的 shell 脚本）")

    print("\n" + ("❌ 存在问题" if failed else "✅ 全部通过"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
