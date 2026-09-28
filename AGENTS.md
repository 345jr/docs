# AGENTS.md

本仓库是 Lopop 的个人知识库，基于 Docusaurus 3（classic 主题），只用于文档，不含博客。

## 部署流程

- 推送到 GitHub `main` 分支后，由 GitHub Actions（`.github/workflows/deploy.yml`）自动执行 `npm ci` + `npm run build`，再通过 rsync 部署到远端服务器的 `/var/www/docs`。
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
