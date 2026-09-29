---
sidebar_position: 3
description: 站点在线编辑功能的设计方案：密钥解锁、编辑器选型、Steward 后端接口与构建部署链路。
tags: [站点建设, 运维]
---

# 在线编辑功能设计

这篇文档介绍本站正在规划的「在线编辑」功能：直接在浏览器里修改文档，保存后自动构建部署上线，不用再手动开编辑器、commit、push。

## 要解决的问题

目前改一篇文档的流程是：本地改文件 → git commit → push → 等 CI 构建部署。在手机或临时电脑上想改一句话就很麻烦。在线编辑的目标是把这条链路压缩成「打开页面 → 输入密钥 → 改 → 保存」。

## 整体架构

编辑器页面跑在 Docusaurus 里，后端复用现有 Steward（服务器总管，Go 单二进制），不新开服务。数据流如下：

```
浏览器 (docs.lopop.top/editor)
  │  ① 输入密钥解锁
  ▼
Steward (127.0.0.1:9092)
  │  ② 写文件到 /root/projects/docs
  │  ③ git commit + push（复用现有 /git 能力）
  ▼
GitHub Actions（push 触发，现有链路）
  │  ④ npm run build 构建恐龙文档
  │  ⑤ 打包 release → webhook 通知 Steward
  ▼
Steward 部署回 /var/www/docs → 站点更新
```

关键点：**重建 Docusaurus 的环节完全复用现有 CI**。编辑器只需要「写文件 + 提交推送」，后面的构建、发布、部署、Telegram 通知都是已有的流程，保存后约 1~2 分钟自动上线。

## 密钥解锁

编辑器页面是公开 URL，不能把认证 token 硬编码在 JS 里（静态站谁都能看到）。设计成「密钥解锁」模式：

1. 打开编辑页，先看到密钥输入框；
2. 输入密钥 → `POST /docs-editor/unlock`，Steward 校验密钥；
3. 校验通过返回一个**短期 session token**（带过期时间），密钥本身不再用于后续请求；
4. session token 存在 `sessionStorage`（关浏览器即失效），后续读写请求带上；
5. 密钥错误 → 拒绝；session 过期 → 回到锁定界面。

为什么不用「密钥直接当 token」的简单做法：解锁后浏览器里只有权限受限的临时 session，即使泄露也只影响 docs 编辑接口、且有时效。密钥本身只存在 Steward 的 `.env` 里，不进代码库、不落库。

## 编辑器选型

文档里有 front matter（YAML 元数据）和 `.mdx`（含 JSX），WYSIWYG 编辑器会把这些内容改坏，所以选「源码编辑 + 实时预览」分屏模式：

- **ByteMD**：轻量、有官方 React 组件、插件生态成熟（GFM / Mermaid / 代码高亮），预览管线基于 remark，与 Docusaurus 同生态。

## Steward 端新增接口

| 接口 | 说明 |
| --- | --- |
| `POST /docs-editor/unlock` | 密钥换 session token |
| `GET /docs-editor/tree` | 列出 `docs/` 目录树 |
| `GET /docs-editor/read` | 读取单个文件内容 |
| `POST /docs-editor/save` | 保存文件 → commit → push |

nginx 在 docs.lopop.top 上加一个 `/editor/api/` 反向代理指向 Steward，同源请求，不产生 CORS 问题。

## 安全约束

- **路径白名单**：只允许写 `docs/` 下的 `.md` / `.mdx` / `_category_.json`，拒绝绝对路径和 `..` 逃逸（复用 Steward 现有 `gitstatus` 的路径校验）。
- **并发串行化**：写操作复用 Steward 的 `opsMu` 锁，写前先 `git pull --ff-only`，有冲突就拒绝保存并报错。
- **密钥管理**：密钥只放在 Steward 的 `.env`（已被 gitignore），站点仓库里永远不出现。

## 已知限制

- **坏链会炸构建**：`onBrokenLinks: 'throw'`，改错链接会导致构建失败。但部署只在构建成功后发生，旧站不受影响，失败会有 Telegram 通知。
- **构建延迟**：保存到上线有 1~2 分钟的 CI 延迟，编辑页会显示「已推送，构建中/已上线」状态。
- **图片上传**：一期不支持，后续加 `POST /docs-editor/upload` 写入 `static/img/`。
