# AGENTS.md

本仓库是 Lopop 的个人知识库，基于 Docusaurus 3（classic 主题），只用于文档，不含博客。当前锁定版本为 **3.10.2**（见 `package.json`），升级版本时需同步检查 Markdown 语法兼容性（如 admonition 标题在 3.1+ 必须用 `:::tip[标题]` 方括号写法，v2 的 `:::tip 标题` 会失效）。

## 部署流程

- 推送到 GitHub `main` 分支后，由 GitHub Actions（`.github/workflows/deploy.yml`）自动执行 `npm ci` + `npm run build`，打包成 `docs-web.zip` 发布到 `docs-latest` release，再回调 Steward；Steward 下载 release 解压部署到远端服务器的 `/var/www/docs`，并通过 Telegram 通知部署结果。
- 构建和部署基本都在远端完成，本地不需要保留 `node_modules/`、`build/`、`.docusaurus/`。
- 如需本地预览：先 `npm ci`，再 `npm start`（开发）或 `npm run build`（生产构建，会检查坏链）。

## 目录说明

- `docs/`：文档内容，中文编写，支持 `.md` 与 `.mdx`（可写 React）。
- `src/`：自定义组件与页面。
- `docusaurus.config.js`：站点配置。已关闭 blog、移除 footer、开启侧边栏折叠（`docs.sidebar.hideable`）。
- `sidebars.js`：侧边栏配置，当前按 `docs/` 目录自动生成。

## 约定

- 文档使用中文；文件名用英文小写加连字符，保证 URL 友好。
- 提交信息使用中文，并带 `feat:` / `fix:` / `docs:` / `chore:` 前缀。
- `onBrokenLinks: 'throw'`：构建时遇到坏链会直接失败，改完文档建议先确认链接有效。

## 正文字体切换

`src/components/FontPicker` 提供系统默认 / 霞鹜文楷 / 方正宋三三个选项，结果存
localStorage。CSS 变量定义在 `src/css/custom.css`：

- `--site-content-font`：正文（仅 `.main-wrapper main`，侧边栏与导航栏不受影响）
- `--site-emphasis-font`：标题、`<strong>/<b>`、表头 `<th>`
- `--site-heading-weight`：标题字重

霞鹜文楷来自 `@callmebill/lxgw-wenkai-web`（版本号跟随官方 release，字体本体是
`lxgw/LxgwWenkai`）。两个注意事项：

1. **只能有 400 一个字重时不要让标题去匹配 700**，浏览器会合成很难看的伪粗体。
   所以标题/加粗走同一字体包的 `LXGW WenKai Medium`（真字重，family 名与 Regular 不同，
   见 FontPicker 的 `emphasis` 字段）。方正宋三同样只有 400，暂未处理。
2. **字体 CSS 不进全局样式表**。448 条 `@font-face`（~130KB gzip）由
   `plugins/lxgw-webfont` 拷到 `assets/fonts/lxgw-wenkai/<版本>/`，FontPicker 在用户
   真正选中时才注入 `<link>`。若改回 `import '.../result.css'`，会因 `future.v4`
   默认启用 rspack 而被合进全局 `styles.css`，让所有访客都替字体买单。

升级字体只需改 `package.json` 里的 `@callmebill/lxgw-wenkai-web` 版本号，产物路径
会随包内 `VERSION` 自动变化。
