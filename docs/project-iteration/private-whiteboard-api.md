---
title: 私有白板接口约定
sidebar_position: 2
description: 私有白板的 steward 后端接口清单、请求响应结构、存储与安全约束，以及部署侧必须同步的 nginx 改动。
tags: [站点建设, 前端, 后端]
---

# 私有白板接口约定

白板是**一块存成 `.excalidraw` JSON 的私有文件**，落 steward 的 `data/private-boards/`，鉴权复用编辑器已有的 `SessionStore`，不 commit、不触发构建。

:::tip[实现状态]
前端与后端均已上线（2026-11-01）。本文既是接口约定，也是实现记录——第六节的验收清单已逐条跑过。
:::

## 一、代码分布

### 前端

| 文件 | 作用 |
| --- | --- |
| `src/pages/whiteboard.tsx` | 页面：登录门、左右两栏骨架、保存调度、冲突处理 |
| `src/components/board/BoardCanvas.tsx` | 唯一 import Excalidraw 的地方，客户端渲染 + 按需加载样式/字体 |
| `src/components/board/BoardList.tsx` | 白板列表（搜索、行内「更多操作」菜单改名/删除、可收起）；底部 `footer` 插槽只放保存状态灯 |
| `src/components/board/SaveIndicator.tsx` | 侧栏底部的保存状态灯（idle 时返回 null，footer 随之隐藏） |
| `src/utils/boardClient.ts` | 接口封装（本文的调用方） |
| `src/utils/boardScene.ts` | 场景 JSON 读写、标题与文件名转换、体积上限 |
| `src/types/boardTypes.ts` | 共享类型 |
| `plugins/excalidraw-assets/index.js` | 把 Excalidraw 的 CSS 与字体拷到 `assets/excalidraw/<版本>/` |

### 后端（steward）

| 文件 | 作用 |
| --- | --- |
| `internal/privateboards/store.go` | `Store`：`root` + `writeMu` + rev 索引；`List / Read / Save / Create / Rename / Delete` |
| `internal/handlers/privateboards.go` | 6 个 handler，`ready()` + `requireSession()` 照抄 `privatedocs.go` |
| `internal/handlers/router.go` | `Router.privboards` 字段 + 6 条路由注册 |
| `cmd/steward/main.go` | `privateboards.New("data/private-boards")` 注入 |

路由：`/whiteboard` 与 `/whiteboard/*`（后者由 `docusaurus.config.js` 的内联插件注册，`postBuild` 会删掉 SSG 生成的占位目录）。导航栏「白板」入口位于「在线编辑」之后。

### 已实现的交互

- 登录复用 `/editor/api/unlock` 与 `docs-editor-token`，401 时与私有文档/编辑器一起广播 `docs-editor:unauthorized`。
- 打开 `/whiteboard` 自动打开最近更新的一块白板；地址栏同步为 `/whiteboard/<文件名>`，刷新/收藏/新标签页都成立。
- 改动后防抖 **1200ms** 自动保存；侧栏底部状态灯常驻（未保存 / 保存中 / 已保存 / 保存失败 / 别处已修改）。
- 保存带 `base_rev` 做乐观并发控制；服务端返回 409 时**暂停自动保存**，提示「载入最新」或「覆盖保存」。
- 切换白板前强制落盘；关标签页前用 `beforeunload` 提醒 + `keepalive` 请求兜底。
- 改名 = 改文件名（标题就是文件名主干），路径与标题始终一致；重名时退化为「只改标题」。
- 布局是纯左右两栏：左侧栏占满导航栏以下的高度，右侧是画布；原来横贯整屏的顶栏已移除，只保留侧栏底部一行保存状态。
- 侧栏视觉与私有文档（`DocSidebar`）逐项对齐：滚动容器挂 `menu thin-scrollbar`、菜单项内边距/圆角走 Infima 变量、侧栏底色透明、收起按钮四边描边 + 双人字箭头、收起态整列内容 `visibility: hidden` 并在窄列上盖满高的展开按钮。
- 改名走列表行内「更多操作」菜单（Base UI `Menu`，Portal 到 body）。早先手写的 absolute 菜单挂在 `static` 的 `<li>` 上会相对 `aside` 定位、落到侧栏底部之外并被 `overflow: hidden` + `clip-path: inset(0)` 裁掉，表现就是「点三个点没反应」。
- 深色模式跟随站点 `colorMode`；窄屏侧栏默认收起，选中白板后自动收起。
- 进入页面时列表未就绪、或正在自动打开首块白板，画布区显示居中的转圈 loading，不再先闪一下「还没有打开白板」空态。
- 导航栏的「私有文档 / 在线编辑 / 白板」用 `custom-sectionLink`（`src/components/SectionLink`）：已在该栏目内时点击不跳转，避免白板页被重置成 `/whiteboard` 再重开一遍画布。
- 单板内容超过 16 MB 时前端直接拦截并提示，不发请求。

## 二、需要新增的接口

全部挂在 `/docs-api/boards/` 下（对外经 nginx 是 `/editor/api/boards/`），**除 unlock 外都要求 session**，校验方式与私有文档完全一致：`Authorization: Bearer <token>`（也允许 `?token=`）。

:::note[为什么不复用私有文档接口]
私有文档的 `Save` 硬校验扩展名只允许 `.md`/`.mdx`，而白板是 `.excalidraw`。硬塞进去会污染文档链路（`/tree` 会返回白板，编辑器侧栏点进去会被 Tiptap 当 Markdown 打开）。独立接口 + 独立目录最干净。
:::

### 1. 列表

```
GET /boards
```

响应 `200`：

```json
{
  "boards": [
    {
      "path": "架构草图.excalidraw",
      "title": "架构草图",
      "size": 18342,
      "updated_at": "2026-11-01T12:34:56Z"
    }
  ]
}
```

- 按 `updated_at` **降序**（前端直接照序渲染，不再排序）。
- `title` 取自场景 JSON 顶层 `_title`；缺失时退回文件名去扩展名。
- `size` 为字节数。`updated_at` 用 RFC3339（前端 `new Date()` 解析）。

### 2. 读取

```
GET /boards/read?path=<相对路径>
```

响应 `200`：

```json
{
  "path": "架构草图.excalidraw",
  "title": "架构草图",
  "content": "{\n  \"type\": \"excalidraw\",\n ... }",
  "rev": 7
}
```

- `content` 是**字符串**（场景 JSON 原文），不是嵌套对象——前端 `JSON.parse` 后交给画布。
- `rev` 是服务端维护的写入序号，从 1 开始，每次成功保存 +1。索引落在 `data/private-boards/.revs.json`（点开头，不会被当成白板列出），**进程重启不丢**——否则 steward 每次自更新都会让正在编辑的标签页撞一次假冲突，而「载入最新」会把未保存的改动丢掉。
- 路径不存在返回 `404`。

### 3. 保存

```
POST /boards/save
Content-Type: application/json

{
  "path": "架构草图.excalidraw",
  "content": "<场景 JSON 字符串>",
  "title": "架构草图",
  "base_rev": 7
}
```

响应 `200`：

```json
{ "ok": true, "rev": 8, "updated_at": "2026-11-01T12:40:00Z" }
```

- `base_rev` 与服务端当前 `rev` 不一致 → 返回 **`409`** 且响应体带当前 rev：

  ```json
  { "error": "conflict", "rev": 9 }
  ```

  前端据此进入「别处已修改」状态。
- `base_rev = -1` 表示**强制覆盖**（用户在冲突提示里点了「覆盖保存」），此时跳过 rev 校验。字段缺失时也按 `-1` 处理，避免漏传字段导致每次保存都冲突。
- 文件不存在时返回 `404`（新建走 `/create`，不在这里隐式创建，避免手滑路径写错就在别处生文件）。
- 写入前把 `title` 同步进场景 JSON 的顶层 `_title`（前端也会写，后端做一次兜底，保证列表标题永远与内容一致）。解析失败时原样保留内容，不把用户数据改成非法 JSON。
- 请求体上限在 handler 侧放宽到 32 MB（`content` 经 JSON 转义后可能翻倍），真正的 16 MB 业务上限仍由 store 按 `content` 解码后的字节数把关，超出返回 `413`。

### 4. 新建

```
POST /boards/create

{ "path": "新白板.excalidraw", "title": "新白板" }
```

响应 `200`：

```json
{ "path": "新白板.excalidraw", "title": "新白板", "content": "<空场景 JSON>", "rev": 1 }
```

- 同名已存在 → `409`，`{"error": "同名白板已存在"}`。
- 空场景由后端生成（与前端 `emptyScene()` 等价）：

  ```json
  {"type":"excalidraw","version":2,"source":"docs.lopop.top","elements":[],"appState":{"gridSize":null,"viewBackgroundColor":"#ffffff"},"files":{},"_title":"新白板"}
  ```

### 5. 改名 / 移动

```
POST /boards/rename

{ "path": "旧名.excalidraw", "new_path": "新名.excalidraw", "title": "新名" }
```

响应 `200`：`{ "ok": true, "path": "新名.excalidraw" }`

- `new_path == path` 时视为「只改标题」，不移动文件。
- 目标已存在 → `409`（前端据此退化为「只改标题」并提示）。
- 移动时若 `title` 非空，一并写进场景 JSON 的 `_title`；先写内容再 `rename`，避免出现「路径改了、标题没改」的中间态。
- `rev` 跟着白板走：改名不会让客户端看到「别处已修改」。

### 6. 删除

```
POST /boards/delete

{ "path": "架构草图.excalidraw" }
```

响应 `200`：`{ "ok": true }`。不存在返回 `404`。

## 三、存储与安全约束

- 根目录：`data/private-boards/`（与 `data/private-docs/` 平级，`data/` 已在 `.gitignore`，不进 git、不触发构建）。
- 只允许 `.excalidraw` 扩展名，大小写不敏感。
- 路径校验复用 `privatedocs.validateRel` 的规则：拒绝空段、`.`、`..`、绝对路径、`~`、`\`，防目录逃逸。
- 单文件上限 **16 MB**（`content` 解码后的字节数），超出返回 `413`。前端已同步拦同一阈值。
- 写入用「临时文件 + fsync + rename」的原子替换，避免并发/断电写坏文件（白板是纯覆盖写，没有 git 兜底）。临时文件名是 `.tmp-<随机>`，**不带** `.excalidraw` 后缀，写盘瞬间不会被 `List` 当成一块白板列出来。
- 所有写操作共用一把 `writeMu` 串行化（照抄 `privatedocs.Store` 的做法）。
- `rev` 索引落在 `<root>/.revs.json`。原计划只用内存 map，实现时改成落盘：steward 自更新/重启会让内存归零，正在编辑的标签页下一次自动保存就撞假冲突，而「载入最新」会把未保存的改动丢掉——用一次重启换一次数据丢失不划算。索引损坏或缺失时退化为空（各板从 1 开始），最坏只是多一次冲突提示。
- 扩展名大小写不敏感。磁盘上若是外部拷进来的 `.EXCALIDRAW`，读/写会回退到原始文件名，避免「列表里看得见却读不了」。
- `GET /boards` 读全文件再 `json.Unmarshal` 到 `struct{Title string \`json:"_title"\`}` 拿标题（16 MB 上限下可接受）。坏 JSON 不让整页挂掉：标题退回文件名，仍列出来让用户能打开修或删。

## 四、steward 侧改动

照私有文档的模式，改动很小：

| 文件 | 改动 |
| --- | --- |
| `internal/privateboards/store.go`（新增） | `Store`：`root` + `writeMu` + rev 索引；方法 `List / Read / Save / Create / Rename / Delete`，路径校验规则与 `privatedocs` 一致 |
| `internal/handlers/privateboards.go`（新增） | 6 个 handler，`ready()` + `requireSession()` 照抄 `privatedocs.go`；`failBoard()` 把 store 的错误哨兵映射成 404/409/413 |
| `internal/handlers/router.go` | `Router` 加字段 `privboards *PrivateBoardsHandler`；`NewRouter` 加参数 `privateBoards *privateboards.Store`；注册 6 条路由 |
| `cmd/steward/main.go` | `privateBoards := privateboards.New("data/private-boards")`，传给 `NewRouter` |

路由注册（放在私有文档那组之后）：

```go
mux.HandleFunc("GET /boards", r.privboards.HandleList)
mux.HandleFunc("GET /boards/read", r.privboards.HandleRead)
mux.HandleFunc("POST /boards/save", r.privboards.HandleSave)
mux.HandleFunc("POST /boards/create", r.privboards.HandleCreate)
mux.HandleFunc("POST /boards/rename", r.privboards.HandleRename)
mux.HandleFunc("POST /boards/delete", r.privboards.HandleDelete)
```

:::warning[别忘了一处]
`NewRouter` 的签名会变，`cmd/steward/main.go` 里那唯一一处调用要同步加参数，否则编译不过。仓库里没有其他调用点。
:::

## 五、部署侧必须同步的两处

### 1. nginx：请求体上限 + 一条**容易写错**的 location（**阻塞项**）

docs 站点的 vhost 原本没设 `client_max_body_size`，走 nginx 默认 **1 MB**——带一张截图的白板必然 `413`。

而且原有的 `/editor/api/` 是 `proxy_pass .../docs-api/docs-editor/`，白板接口 `/editor/api/boards` 会被它接走，变成 `/docs-api/docs-editor/boards` → 404。所以要单独加一条前缀更长的 location。

`/etc/nginx/sites-available/docs.lopop.top`：

```nginx
server {
    listen 80;
    server_name docs.lopop.top;

    root /var/www/docs;
    index index.html;

    # 私有白板带插图时 JSON 会很大（前端限制单板 16MB，steward 侧同样 16MB）
    client_max_body_size 32m;

    # 白板接口：/editor/api/boards* → /docs-api/boards*
    # 必须写在下面 /editor/api/ 之前，且**不带尾斜杠**——前端列表接口就是
    # GET /editor/api/boards，写成 /editor/api/boards/ 会漏掉它。
    location ^~ /editor/api/boards {
        proxy_pass http://127.0.0.1:9092/docs-api/boards;
        include snippets/proxy-common.conf;
    }

    location ^~ /editor/api/ {
        proxy_pass http://127.0.0.1:9092/docs-api/docs-editor/;
        include snippets/proxy-common.conf;
    }

    ...
}
```

改完 `nginx -t && systemctl reload nginx`。

:::note[`^~` 前缀匹配是按长度取最长]
两条 location 都是 `^~`，nginx 选前缀最长的那条，与书写顺序无关；写在前面的说明是为了让人一眼看到「boards 要先于 `/editor/api/`」。真正的坑在尾斜杠：`/editor/api/boards/` 匹配不到 `/editor/api/boards`，那个请求会落到 `/editor/api/` 上，被拼成 `/docs-api/docs-editor/boards`。
:::

### 2. 静态资源体积

`plugins/excalidraw-assets` 会把 Excalidraw 的字体整目录拷进产物：**+13 MB**（234 个 woff2，含中文 Xiaolai 分片）。加上 JS 约 +3 MB（全部是 async chunk，首页不加载）。

- 现有 `location ^~ /assets/` 已配 `expires 1y` + `immutable`，字体和 CSS 都在这个前缀下，**无需改 nginx**。
- release zip 会因此从约 60 MB 涨到约 75 MB，部署耗时略增。

## 六、验收

接口层已用真实密钥在服务器上逐条跑过（`curl` 走公网 `https://docs.lopop.top/editor/api/boards/*`）：

| 用例 | 结果 |
| --- | --- |
| 无 token 访问 | `401` |
| 列表（空库） | `{"boards":[]}` |
| 新建 → 列表 → 读取 | `rev` 从 1 起，`_title` 已写入内容，列表按更新时间倒序 |
| 保存（`base_rev` 匹配） | `200`，`rev` +1 |
| 保存（`base_rev` 过期） | `409` + `{"error":"conflict","rev":N}` |
| 强制覆盖（`base_rev=-1`） | `200` |
| 保存不存在的路径 | `404` |
| 改名（换路径 / 只改标题） | `200`，`rev` 跟着走 |
| 改名到已存在的名字 | `409` |
| 删除 → 再删 | `200` → `404` |
| 路径逃逸（`../../etc/passwd`） | `400` |
| 非 `.excalidraw` 扩展名 | `400` |
| 2 MB / 15 MB 内容 | `200`（验证 nginx 32 MB 生效） |
| 17 MB 内容 | `413` |
| steward 重启后 rev 保持 | 保持，无假冲突 |

浏览器侧（登录、自动打开最近一块、防抖保存、冲突提示、深色模式、窄屏侧栏）请按下面清单人工过一遍：

1. 未登录时显示解锁框；用编辑器密钥解锁后直接进入（三处互通，无需二次输入）。
2. 首次进入自动打开最近一块白板；左侧列表按更新时间倒序。
3. 画几笔 → 1.2 秒后侧栏底部变「已保存 · 刚刚」；刷新页面内容还在。
4. 新建 → 侧栏立即出现 → 画东西 → 保存成功。
5. 行内「更多操作」→ 重命名 → 列表名称与地址栏路径**同时**变化；菜单要完整可见、可按 Esc 关闭。
6. 删除 → 列表消失；删的若是当前板，回到空态。
7. 开两个标签页改同一块板 → 后保存的那个显示「别处已修改」，点「载入最新」能拿到对方版本，点「覆盖保存」能强推自己的。
8. 上传一张大截图（接近 10 MB）→ 保存成功。
9. 深色模式下画布跟随；手机宽度下侧栏默认收起、画布占满。

## 七、已知限制

- **无版本历史**：白板不进 git，保存是覆盖写，误删不可恢复。后续要留历史得靠服务端定期快照（`data/private-boards/.snapshots/`）。
- **无协作**：没有实时多人编辑，冲突靠 `base_rev` 事后检测。rev 索引是落盘的（`.revs.json`），但删掉它或换机器后各板会从 1 重新计数，届时开着的标签页可能撞一次冲突——点「载入最新」前先确认没有未保存的改动。
- **导出走 Excalidraw 自带菜单**（PNG/SVG/`.excalidraw` 文件），本站不额外做导出接口。
- **不做公开分享**：目前白板只有私有入口。若要嵌进私有文档或公开分享，需要额外的「导出为图片 + 上传」链路。
- `appState.name` 上游只标 `browser`（导出/服务端都丢），所以标题存的是自定义顶层键 `_title`；Excalidraw 的 `restore()` 会忽略未知顶层键，文件仍是合法 `.excalidraw`，官方应用可直接打开。
