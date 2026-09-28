---
name: deepseek-share
description: Fetch DeepSeek shared conversation links (chat.deepseek.com/share/...) as Markdown. Use when the user shares a DeepSeek chat link and asks to read it, analyze it, or turn it into a document for this knowledge base.
---

# DeepSeek 分享对话抓取

把 `https://chat.deepseek.com/share/<id>` 链接里的对话抓下来转成 Markdown，供后续分析和写作。

## 用法

```bash
python3 .opencode/skills/deepseek-share/fetch_share.py <链接或 share id> -o /tmp/opencode/ds_dialog.md
```

常用参数：

- `-o <path>`：输出文件，建议先落到 `/tmp/opencode/` 再分析。
- `--thinking`：附带模型思考过程（`<details>` 折叠）。
- `--json`：输出原始 JSON，适合程序化处理。

抓完直接 Read 输出文件即可。

## 背景知识

- 分享页面本身经常被 CloudFront 拒绝（返回 403，服务器 IP 段被 WAF 拦），不要反复用 `curl` 抓页面 HTML。
- 正确入口是 API：`GET https://chat.deepseek.com/api/v0/share/content?share_id=<id>`，带上浏览器 UA、`referer: https://chat.deepseek.com/` 和 `x-app-version` 等请求头（脚本已内置），实测稳定可用。
- 返回 JSON 结构：`data.biz_data.messages[].fragments[]`，每个片段 `type` 为 `REQUEST`（用户提问）、`RESPONSE`（回答）、`THINK`（思考过程）、`TIP`（提示）。
- 如果 API 也返回 403 或非 JSON，优先检查请求头是否完整；仍失败再考虑 GitHub Actions 代抓（不常用）。

## 拿到内容之后

1. 先通读全文，和用户确认要提炼的主题（对话里常包含多个话题）。
2. 写文档时遵循本仓库约定：内容用中文；放在 `docs/` 下按主题分类（写作类进 `docs/writing/`，新主题建目录并加 `_category_.json`）；文件名用英文小写加连字符。
3. 输出的是知识笔记而不是对话实录：提炼结构和观点，去掉寒暄与重复，可用 `:::tip` / `:::note` 等提示框。
4. 本地没有 `node_modules`，无法 `npm run build` 校验；写完提交推送后由 GitHub Actions 构建，宁可少写内部链接，避免坏链。
