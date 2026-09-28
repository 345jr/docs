#!/usr/bin/env python3
"""把 DeepSeek 分享对话抓下来转成 Markdown。

用法：
    python3 fetch_share.py <share-url-or-id> [-o output.md] [--thinking] [--json]
"""
import argparse
import datetime
import json
import re
import sys
import urllib.error
import urllib.request

SHARE_RE = re.compile(r"(?:https?://chat\.deepseek\.com)?/share/([A-Za-z0-9_-]+)")
API = "https://chat.deepseek.com/api/v0/share/content?share_id={}"
HEADERS = {
    "accept": "*/*",
    "accept-language": "zh-CN,zh;q=0.9",
    "referer": "https://chat.deepseek.com/",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "x-app-version": "20241129.1",
    "x-client-locale": "zh_CN",
    "x-client-platform": "web",
    "x-client-version": "1.2.0-sse-hint",
}


def extract_id(raw: str) -> str:
    m = SHARE_RE.search(raw)
    if m:
        return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{6,}", raw):
        return raw
    raise SystemExit(f"无法从 {raw!r} 提取 share id")


def fetch(share_id: str) -> dict:
    req = urllib.request.Request(API.format(share_id), headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"请求失败: HTTP {e.code}（多为 WAF 拦截，检查请求头）") from e
    if data.get("code") != 0:
        raise SystemExit(f"API 错误: {data.get('msg') or data}")
    return data["data"]["biz_data"]


def render(biz: dict, thinking: bool) -> str:
    lines = [f"# {biz.get('title') or 'DeepSeek 分享对话'}", ""]
    for msg in biz.get("messages", []):
        for frag in msg.get("fragments") or []:
            ftype = frag.get("type")
            content = (frag.get("content") or "").strip()
            if not content:
                continue
            if ftype == "REQUEST":
                lines += ["## 我", "", content, ""]
            elif ftype == "RESPONSE":
                lines += ["## DeepSeek", "", content, ""]
            elif ftype == "THINK" and thinking:
                lines += ["<details><summary>思考过程</summary>", "", content, "", "</details>", ""]
            elif ftype == "TIP":
                lines += [f"> 提示：{content}", ""]
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description="导出 DeepSeek 分享对话为 Markdown")
    ap.add_argument("link", help="分享链接或 share id")
    ap.add_argument("-o", "--output", help="输出文件路径（默认打印到 stdout）")
    ap.add_argument("--thinking", action="store_true", help="附带思考过程")
    ap.add_argument("--json", action="store_true", help="输出原始 JSON")
    args = ap.parse_args()

    share_id = extract_id(args.link)
    biz = fetch(share_id)

    if args.json:
        out = json.dumps(biz, ensure_ascii=False, indent=2)
    else:
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        header = f"> 来源: https://chat.deepseek.com/share/{share_id} · 抓取时间: {now}\n"
        out = header + "\n" + render(biz, args.thinking)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"已保存 {args.output}（{len(out)} 字）", file=sys.stderr)
    else:
        print(out)


if __name__ == "__main__":
    main()
