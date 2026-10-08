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
- `src/types/`：TypeScript 共享类型。`editorTypes.ts`（在线编辑页）、`privateTypes.ts`（私有文档页与 `utils/privateClient.ts`）。**别把类型文件放进 `src/pages/`**——那里每个文件都会被 Docusaurus 当成路由，会多出一个 `/xxxTypes` 页面并在 SSG 阶段构建失败。

## 类型检查

仓库**没有** `tsconfig.json`，`src/` 下的 import 一律用相对路径，别写 `@site/` 别名
（那个别名只有打包器认，tsc 会报 TS2307，并让下游参数退化成隐式 any）。全量检查
（typescript 未列入依赖，需临时拉取）：

```bash
npx -p typescript@6.0.3 tsc --noEmit --jsx react-jsx --skipLibCheck \
  --moduleResolution bundler --module esnext --target es2022 \
  $(find src -name '*.ts' -o -name '*.tsx')
```

TS 6.0 起 `noImplicitAny` 默认开启（与有无 tsconfig 无关），`src/` 还剩少量历史遗留
的隐式 any（集中在 `MarkdownView`、`FontPicker`、`theme/tiptap/admonition.ts`），
新增代码请补类型注解。类型检查不进构建：GitHub Actions 只跑 `npm run build`。

## 约定

- 文档使用中文；文件名用英文小写加连字符，保证 URL 友好。
- 提交信息使用中文，并带 `feat:` / `fix:` / `docs:` / `chore:` 前缀。
- `onBrokenLinks: 'throw'`：构建时遇到坏链会直接失败，改完文档建议先确认链接有效。

## 正文字体切换

`src/components/FontPicker` 提供系统默认 / 霞鹜文楷 / 思源宋体三个选项，结果存
localStorage。CSS 变量定义在 `src/css/custom.css`：

- `--site-content-font`：正文（仅 `.main-wrapper main`，侧边栏与导航栏不受影响）
- `--site-emphasis-font`：标题、`<strong>/<b>`、表头 `<th>`
- `--site-heading-weight`：标题字重

三个变量都有「跟随正文」的默认值，FontPicker 不设置时即为系统字体。代码块始终用
`--ifm-font-family-monospace`，custom.css 里有一条同优先级的兜底规则防止被覆盖。

字体来源：

| 选项 | 包 | 字体版本 | 授权 |
| --- | --- | --- | --- |
| 霞鹜文楷 | `@callmebill/lxgw-wenkai-web` | v1.522（官方 `lxgw/LxgwWenKai`） | OFL 1.1 |
| 思源宋体 | `noto-serif-sc` | v2.002（官方 `adobe-fonts/source-han-serif`） | OFL 1.1 |

不要引入方正系列字体：需通过字加客户端购买授权，且随仓库分发有合规风险。

三个需要记住的点：

1. **霞鹜文楷只有 Regular 一个字重**，标题直接匹配 700 会被浏览器合成伪粗体。所以
   它的标题/加粗走同包的 `LXGW WenKai Medium`（真字重，500）。注意 Medium 的 family
   名是 `LXGW WenKai Medium`，与 Regular 是两个独立 family，必须靠
   `--site-emphasis-font` 显式切过去。
2. **思源宋体的 Regular 与 Bold 同属 `Noto Serif SC`**，标题吃 `font-weight: 700`
   就是真 Bold，不需要额外变量，FontPicker 里不用配 `emphasis`。
3. **字体 CSS 不进全局样式表**。上百条 `@font-face` 由 `plugins/cjk-webfonts` 拷到
   `assets/fonts/<字体>/<版本>/<字重>/`，FontPicker 在用户真正选中时才注入 `<link>`。
   若改回 `import '.../result.css'`，会因 `future.v4` 默认启用 rspack 而被合进全局
   `styles.css`，让所有访客都替字体买单。

新增字体只需在 `plugins/cjk-webfonts/index.js` 的 `FONTS` 里登记一行（包名 + 要拷的
字重目录 + 各字重的 CSS 文件名），产物路径与前端 `<link>` 会自动跟上；再在 FontPicker
的 `FONTS` 数组里加一个选项即可。升级字体只改 `package.json` 版本号。
