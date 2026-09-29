---
sidebar_position: 2
description: 在线编辑功能的实际落地过程：从方案评估、后端接口、编辑器集成到端到端联调，以及 Milkdown admonition 插件开发的完整踩坑记录。
tags: [站点建设, 运维]
---

# 在线编辑：实现记录

本文记录「在线编辑」功能从方案到上线的完整过程，包括每一步做了什么、遇到了哪些坑、怎么解决的。设计背景见[《设计方案》](./design)。

## 整体思路

功能已全部上线，访问 `https://docs.lopop.top/editor/`，顶部导航栏「文档」右侧也有入口。

核心链路：

```
浏览器编辑器页 → Steward /docs-api/（写文件+commit+push）
  → GitHub Actions 自动构建 → release → Steward 部署回 /var/www/docs
```

:::tip[关键决策]
重建 Docusaurus 完全复用现有 CI 链路，编辑器只负责「写文件 + 提交推送」，不需要在服务器上跑构建。
:::

## 实施步骤

### 1. Steward 后端接口

在 Steward 里新增 `internal/docseditor` 包，提供 5 个接口：

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/docs-editor/unlock` | POST | 密钥换 24h session token |
| `/docs-editor/tree` | GET | 列出 `docs/` 目录树 |
| `/docs-editor/read` | GET | 读取文件内容 |
| `/docs-editor/save` | POST | 写文件 + git commit + push |
| `/docs-editor/delete` | POST | 删除文件 + git commit + push |

复用了 Steward 已有的 `gitstatus` collector（GitHub token 注入、并发串行化、路径逃逸校验）。

:::warning[踩坑：git 身份]
服务器上的 docs 仓库没有配置 `user.name` / `user.email`，git commit 直接失败。需要给仓库配置 local 身份（`git config --local`），不能依赖全局配置（systemd 环境下 HOME 可能不一致）。
:::

### 2. 密钥解锁与鉴权分层

编辑器页面是公开 URL，token 不能写死在 JS 里（静态站谁都能看到）。设计了分层鉴权：

- **`/open/`**：只读接口，用 Steward 的 open token（curl / 管理端用）
- **`/control/`**：写接口，用 open token + session 双重校验
- **`/docs-api/`**：**新增的独立挂载点**，只给浏览器用——unlock 用 body 里的密钥，save/delete 用 session token，open token 完全不出现在浏览器里

session token 存在 `sessionStorage`，关浏览器即失效；密钥只存在 Steward 的 `.env`。

:::warning[踩坑：挂载点设计]
一开始把 save/delete 挂在 `/control/` 下，发现浏览器没有 open token 根本过不了鉴权。最终新增 `/docs-api/` 挂载点（无 open token 鉴权，靠 session），nginx 把 `/editor/api/*` 反代到 `/docs-api/docs-editor/*`，同源请求无 CORS 问题。
:::

### 3. nginx 反代

在 `docs.lopop.top` 的 nginx 配置里加：

```nginx
location ^~ /editor/api/ {
    proxy_pass http://127.0.0.1:9092/docs-api/docs-editor/;
    include snippets/proxy-common.conf;
}
```

`/editor/api/unlock` → `/docs-api/docs-editor/unlock`，路径前缀自动替换。

### 4. 前端编辑器页面

前端在 Docusaurus 里新建 `src/pages/editor.tsx`，三个视图状态：

1. **解锁页**：输入密钥 → unlock → 存 sessionStorage
2. **文件树**：从 tree 接口渲染，文件夹可折叠
3. **编辑页**：front matter 表单（左）+ Milkdown WYSIWYG（右）

编辑策略：
- `.md` 文件用 Milkdown WYSIWYG，front matter 拆成表单字段（title / sidebar_position / description / tags）
- `.mdx` 文件（含 JSX）自动切源码模式（textarea），因为 WYSIWYG 会破坏 JSX
- 保存时把表单 + 正文重组回完整文件再提交

:::danger[踩坑：SSR]
Milkdown/Crepe 在 import 时就访问浏览器 API（`document` 等），Docusaurus 构建时会 SSG 渲染，直接报错。解决：Crepe 用动态 `import()` 在 `useEffect` 里加载；编辑器页外层用 `mounted` 状态控制，SSR 时先渲染空内容。
:::

## 编辑器选型：为什么是 Milkdown

最初候选 ByteMD（源码+预览分屏）和 Milkdown（WYSIWYG）。调研结论：

| | Milkdown | ByteMD |
| --- | --- | --- |
| 维护状态 | 活跃（2026-09 还在发版） | 已停更（2024 年后无更新） |
| 月下载 | kit 130 万 / crepe 111 万 | 3 万 / 1.1 万 |
| React 19 | 官方支持 | 无 |
| 编辑器类型 | WYSIWYG（ProseMirror + remark） | 源码 + 预览分屏 |

最终选 **Milkdown**（`@milkdown/crepe` 开箱即用编辑器 + `@milkdown/kit` 插件体系），体验接近 Typora。

## Milkdown 集成：admonition 插件开发（最大的一坑）

### 问题

Docusaurus 文档大量使用 `:::tip[标题]` admonition 语法。Milkdown 默认不认识它，round-trip 会把 `:::tip[一句话结论]` 转义成 `:::tip\[一句话结论]`，**直接污染内容**。

### 方案：自定义 ProseMirror 节点

在 `src/theme/editor/admonition.ts` 写了一个 Milkdown 插件：

- **parseMarkdown**：匹配 remark 的 `containerDirective` 节点 → 转成 ProseMirror 的 `admonition` 节点（attrs: name / title）
- **toMarkdown**：`admonition` 节点 → 输出回 `containerDirective` → remark-directive 序列化成 `:::name[title]`
- **node view**：渲染成带样式的提示框（note/tip/warning/danger/info 四色）

```ts
// 核心：解析时提取 title（directiveLabel 段落），序列化时还原
parseMarkdown: {
  match: (node) => node.type === 'containerDirective',
  runner: (state, node, type) => {
    const name = node.name || 'note';
    const children = Array.isArray(node.children) ? node.children : [];
    const title = extractTitle(children); // 从 directiveLabel 段落提取
    const content = children.filter((c) => !c.data?.directiveLabel);
    state.openNode(type, {name, title}).next(content).closeNode();
  },
},
```

同时注入 `remark-directive` 到 Milkdown 的 remark 管线（`remarkPluginsCtx`），解析才能识别 `:::`。

### 踩坑时间线

1. **`Cannot match target parser for node`**：remark 解析出 `containerDirective`，但 Milkdown 没有对应节点 → 必须自定义节点，不能只注入 remark-directive。
2. **`Context "admonition" not found`**：`$nodeSchema` 返回的是 `[ctx, node]` 数组插件，要整体 `.use()` 而不是 `.use(...)` 展开。
3. **`t.reduce is not a function`**：序列化 runner 里 `addNode('text', title)` 参数顺序错了——第二个参数是 `children` 不是 `value`，标题要传给第三个参数。
4. **`Missing node in schema`（线上复现）**：本地 vite 正常、线上 webpack 报错——admonition 插件动态 import 导致 Milkdown 相关模块被 webpack 打了**两份**，schema ctx key 不匹配。解决：admonition 插件改**静态 import**（它本身不碰 DOM，SSR 安全），只有 Crepe 本体动态加载。

:::tip[调试技巧]
反复 push + CI（每次 2 分钟）太慢，本地搭了个 vite + playwright 快速迭代环境，几分钟一轮，把上面的坑全部在本地定位完。
:::

## 端到端验证

用 Playwright 无头浏览器完整走了一遍：

1. 打开 `/editor/` → 输入密钥 → 解锁成功
2. 文件树正常显示
3. 打开 `from-draft-to-article.md`（含 admonition）→ Milkdown 正常渲染提示框
4. 新建测试文件 → 保存 → push 成功 → CI 构建 → 部署 → 线上可访问
5. 删除测试文件 → push 成功

:::note[测试发现]
下划线开头的文件（`_e2e-test.md`）会被 Docusaurus 当作 partial 文件忽略，不会生成页面——所以测试文件 404 是正常行为，不是部署问题。
:::

## 遗留事项

- **图片上传**：编辑器目前只能编辑文本，图片需要先手动放进 `static/img/`，后续可加 `POST /docs-editor/upload`
- **构建失败反馈**：保存后目前只显示"已推送"，构建失败会走 Telegram 通知，但编辑器页面看不到失败原因，后续可接 `/deploy/pipeline-history` 展示构建状态
- **密钥管理**：解锁密钥存在 Steward `.env`（`STEWARD_DOCS_EDITOR_KEY`），换密钥只需改环境变量重启服务
