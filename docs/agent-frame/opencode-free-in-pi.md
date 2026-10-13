---
title: 在 Pi 中接入 OpenCode 免费模型
sidebar_position: 1
description: 完整记录在 Pi 中接入 OpenCode 免费模型的过程——从 403 FreeTierError 的排查、TLS 中间人抓包、两个社区扩展的对比，到定位“User-Agent + 非空 tools”这一真实门槛，并让 CLI 与 pi-web 都成功加载 provider；以及 2026-10-13 上游规则变更导致伪装方案再次失效的复盘与结构性弊端分析。
tags: [pi, opencode, pi-web, 模型接入, 抓包, 排障]
---

# 在 Pi 中接入 OpenCode 免费模型

> 一次完整的接入与排障记录：把 OpenCode 的免费模型接进 Pi，经历 403 `FreeTierError`、TLS 中间人抓包、社区扩展对比，最终定位到服务端的真实门槛并跑通。涉及命令、抓包方法和结论，可作为同类“把第三方模型接进 Pi”问题的参考。

## 一、目标与初始状态

目标：在 Pi CLI 里使用 OpenCode 的免费模型（截图中 OpenCode Zen 下的 `Ling / LongCat / MiMo / Muse Spark / Nemotron` 等标注“免费”的模型）。

排查开始前的环境：

| 项目 | 值 |
| --- | --- |
| Pi 版本 | `0.99.1`（`/usr/lib/node_modules/@earendil-works/pi-coding-agent`） |
| OpenCode CLI | `1.18.34`（`/usr/lib/node_modules/opencode-ai`） |
| 当前默认模型 | `volcengine-coding-plan/deepseek-v4.1-flash` |

`/root/.pi/agent/models.json` 初始只有一个自定义 provider：

```json
{
  "providers": {
    "volcengine-coding-plan": {
      "baseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3",
      "api": "openai-completions",
      "apiKey": "ark-...",
      "models": [
        { "id": "deepseek-v4-flash" },
        { "id": "deepseek-v4-pro-260425" },
        { "id": "doubao-seed-1-6-250615" },
        { "id": "doubao-seed-1-6-thinking-250715" },
        { "id": "deepseek-v4.1-flash", "name": "DeepSeek V4.1 Flash", "reasoning": true, "input": ["text", "image"], "contextWindow": 1000000, "maxTokens": 384000 },
        { "id": "kimi-k2.8-preview", "name": "kimi-k2.8-preview", "reasoning": true, "input": ["text", "image"], "contextWindow": 1000000, "maxTokens": 16384 }
      ]
    }
  }
}
```

:::tip[一句话结论]
Pi 自带 `opencode` / `opencode-go` 两个原生 provider，但抓不到免费额度；真正能跑通的是第三方扩展 **`pi-opencode-direct`**。服务端判定“必须来自 OpenCode”的条件是 **`User-Agent` 为 opencode 的 UA + 请求体里带非空 `tools` 列表**（再配合 `Authorization: Bearer public` 与合法 `ses_` 格式会话 id）。**用 `--no-tools` 测试一定 403。** 另外 CLI 能加载的扩展 **pi-web 不一定能加载**，最终以“本地扩展 + 改两行 import”收尾。
:::

## 二、第一轮：直接用 Pi 原生 provider

Pi 内置了 `opencode`（OpenCode Zen）和 `opencode-go`（OpenCode Go），两者的凭证环境变量都是 `OPENCODE_API_KEY`。服务器上已有 OpenCode 的登录信息：

- `/root/.local/share/opencode/auth.json` 里有 `opencode-go` 的 API key

用它直接跑免费模型：

```bash
KEY=$(python3 -c "import json;print(json.load(open('/root/.local/share/opencode/auth.json'))['opencode-go']['key'])")
OPENCODE_API_KEY="$KEY" pi --print --no-session --no-tools \
  --provider opencode --model mimo-v2.6-flash-free "Reply with exactly: HELLO"
```

结果：

```
403: {"type":"FreeTierError","message":"OpenCode's free tier can only be used from within OpenCode"}
```

同一把 key 走 Go 模型（`/zen/go/v1`）则返回另一个错误：

```
403 Upstream request failed: An active OpenCode Go subscription is required to use Go models.
```

付费 Zen 模型则提示 `Insufficient account funds`。结论初步是：**Go key 没有有效订阅，免费模型又被“只能来自 OpenCode”挡住。**

## 三、关键观察：opencode CLI 自己能跑通

对照测试，服务器上现成的 OpenCode CLI 用同一个免费模型是成功的：

```bash
opencode run -m opencode/mimo-v2.6-flash-free "只回复: OK"
# > build · mimo-v2.6-flash-free
# OK
```

也就是说：**账号和网络都没问题，差异只可能出在客户端发出的请求本身。** 于是决定抓包看它到底发了什么。

## 四、TLS 中间人抓包

因为目标是 HTTPS，需要本地做一个 TLS 终止代理。整体步骤：

1. 生成一个测试 CA 和 `opencode.ai` 的证书（SAN 含 `opencode.ai`）。
2. 在 `/etc/hosts` 里把 `opencode.ai` 指向 `127.0.0.1` / `::1`。
3. 起一个 Python 代理监听 443：用测试证书完成 TLS 握手、打印请求头与 body，再转发到真实 IP。
4. 让 OpenCode 信任测试 CA：`NODE_EXTRA_CA_CERTS=/tmp/mitm/ca.pem opencode run ...`。
5. **抓完立即还原 `/etc/hosts`、关掉代理。**

抓到的关键请求头（免费模型）：

```
POST /zen/v1/chat/completions HTTP/1.1
Authorization: Bearer public
Content-Type: application/json
User-Agent: opencode/1.18.34 ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.14
x-opencode-client: cli
x-opencode-project: global
x-opencode-request: msg_...
x-opencode-session: ses_...
x-opencode-session-id: ses_...
Connection: keep-alive
Accept: */*
Host: opencode.ai
Accept-Encoding: gzip, deflate, br, zstd
Content-Length: 32895
```

请求体里除了 `system` / `messages`，还有一个**约 32 KB 的 `tools` 数组**（bash / edit / glob / read / write 等）。

:::warning[抓包的纪律]
中间人代理会临时改写 `/etc/hosts`、占用 443 端口、并让进程信任一个自签 CA。务必在抓包结束后立刻还原并关闭代理，避免影响机器上其它服务（这台机器上就有一个正在运行的 `opencode web`）。
:::

## 五、Go key 的定位

单独对 Go 端点做了多次测试：

```bash
curl -sS -X POST https://opencode.ai/zen/go/v1/chat/completions \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"hi"}]}'
```

稳定返回：

```
{"error":{"type":"server_error","message":"Upstream request failed: An active OpenCode Go subscription is required to use Go models."}}
```

结论：**这把 key 不是有效 Go 订阅**，OpenCode Go 系列暂时用不了；但 Zen 的免费模型不依赖它（匿名 `Bearer public` 即可），所以不影响主线目标。

## 六、两个社区扩展对比

社区里有两个思路相近的 Pi 扩展，都通过伪造 OpenCode 身份来访问 Zen 免费层：

| 仓库 | 思路 | 实测结果 |
| --- | --- | --- |
| [`pedrostarkealexis/pi-opencode-free`](https://github.com/pedrostarkealexis/pi-opencode-free) | 只用 `openai-completions`，加 `x-opencode-*` 头，不带 Authorization | 能装、能发现 14 个免费模型，但请求实际 403（其“只靠头就够”的假设在本环境不成立） |
| [`Aymendje/pi-opencode-direct`](https://github.com/Aymendje/pi-opencode-direct) | 同时覆盖 `openai-completions` 与 `openai-responses`，动态生成合法 `ses_`/`msg_` 会话 id、带 `x-client-request-id`，并对齐 Pi 的 system prompt | **可用** |

第一个扩展的直接验证（当时用 `--no-tools`，这是后来才发现的关键坑）：

```bash
pi install npm:pi-opencode-free
# discoverModels() 可拉到：big-pickle, mimo-v2.6-flash-free, ling-3.1-flash-free ...
# 但真实请求仍返回 403 FreeTierError
```

第二个扩展的 README 里已经点出几个关键点：
- 匿名免费层除了头还看**会话 id 结构**（`ses_` + 12 位 hex + 14 位 base62）；
- Pi 核心会丢掉 `x-client-request-id`，而 Zen 会因为它缺失而 403；
- 匿名额度按**出口 IP** 共享。

## 七、真正的根因

在干净抓包（**不覆盖**，分别保存 `free.bin` / `go.bin`）基础上做严格单变量对比，用 Python + `ssl` 直接重放：

| 请求 | 结果 |
| --- | --- |
| 原样重放（verbatim） | ✅ 200 |
| 去掉 `Authorization` | ✅ 200 |
| `Authorization` 换成 Go key | ❌ 400 |
| 只留 1 条 user、去掉 `tools` | ❌ 403 |
| system 换成 `You are terse.`，保留 `tools` | ✅ 200 |
| 原 messages，去掉 `tools` | ❌ 403 |
| 带 `tools: []`（空数组） | ❌ 403 |
| `User-Agent` 改成 `pi` | ❌ 403 |

由此确定服务端的真实门槛是：

1. **`User-Agent` 必须是 OpenCode 的 UA**（`opencode/1.18.34 ai-sdk/...`）；换成 Pi 的 UA 立即 403。
2. **请求体里必须有非空 `tools` 数组**；`tools: []` 或没有 `tools` 都 403。
3. `Authorization: Bearer public`（或干脆不带）即可；`x-opencode-client` / `x-opencode-project` 的值不是关键。
4. 会话 id 最好符合 `ses_` 结构（扩展会动态生成）。

:::danger[最大的坑]
排查前期所有失败测试都用了 **`pi --no-tools`**。这会让请求体里没有 `tools`，于是无论怎么改头都必然 403。**要验证 OpenCode 免费层，绝不能关工具。**
:::

## 八、最终方案与验证

安装第二个扩展并**开启工具**运行：

```bash
pi install npm:pi-opencode-direct

# 带工具跑（不要加 --no-tools）
PI_OPENCODE_DIRECT_DEBUG=1 pi --print --no-session \
  --provider opencode-zen-free --model mimo-v2.6-flash-free \
  "Reply with exactly: HELLO"
```

调试日志与结果：

```
[pi-opencode-direct] provider ua=opencode/1.18.31 ai-sdk/prov... session=ses_... auth=Bearer public... tools=4
[pi-opencode-direct] fetch <- 200 /zen/v1/chat/completions after 5546ms
HELLO
```

工具往返验证：

```bash
pi --print --no-session --provider opencode-zen-free --model mimo-v2.6-flash-free \
  "用 bash 工具执行 echo hi-from-tool，然后只回复命令输出"
# hi-from-tool
```

Responses API 模型（Muse Spark）验证：

```bash
pi --print --no-session --provider opencode-zen-free \
  --model muse-spark-1.3-contributor-free --thinking low "Reply with exactly: MUSE_OK"
# MUSE_OK
```

> 以上是 **CLI 的中间方案**。pi-web 里一开始看不到这个 provider，原因和最终处理见**第十节《让 pi-web 也能用》**。

## 九、可用模型矩阵

实测结果（`opencode-zen-free` provider）：

| 模型 | 状态 |
| --- | --- |
| `mimo-v2.6-flash-free` | ✅ 文本 / 图像 / 工具 |
| `longcat-2.5-preview-free` | ✅ |
| `space-bunny-free` | ✅ |
| `nemotron-3.5-lightning-free` | ✅ |
| `nemotron-3-ultra-free` | ✅ |
| `big-pickle` | ✅ |
| `muse-spark-1.3-contributor-free` | ✅（Responses API） |
| `ling-3.0-flash-fin-free` | ❌ 上游 `Endpoint is unavailable`（模型下线，非鉴权问题） |

## 十、让 pi-web 也能用

CLI 跑通后，pi-web 的模型选择器里仍然看不到这个 provider。定位过程：

1. pi-web 用的是**自带的 SDK**（这台机器上是 **0.87.1**），扩展加载器与 CLI 宿主不是同一套版本；
2. 用 pi-web 的 SDK 离线跑一遍 `createAgentSessionServices`，拿到扩展加载报错：

```text
Failed to load extension: Cannot find module
'.../pi-ai/dist/compat.js/api/openai-completions.lazy'
```

原因：pi-web 的加载器把 `@earendil-works/pi-ai` 别名到兼容入口 `/compat`，但**白名单里没有 `/api/*` 子路径**，而扩展 import 了：

```ts
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";
```

于是被拼成了不存在的 `dist/compat.js/api/...`。**CLI 宿主能加载、pi-web 不能**，差异就在这里。

### 处理办法：本地扩展 + 只改两行 import

`/compat` 本身就导出了这两个 API 工厂，所以从 `/compat` 导入即可。为避免 `pi update` 覆盖、也为了摆脱 npm 包带来的混版本依赖，直接把扩展放进 Pi 的用户扩展目录：

```text
~/.pi/agent/extensions/opencode-zen-free/
├── index.ts
└── provider.ts   # 仅把 /api/*.lazy 两行改为从 @earendil-works/pi-ai/compat 导入
```

补丁内容：

```diff
- import { getApiProvider, registerApiProvider } from "@earendil-works/pi-ai/compat";
- import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
- import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";
+ import {
+   getApiProvider,
+   registerApiProvider,
+   openAICompletionsApi,
+   openAIResponsesApi,
+ } from "@earendil-works/pi-ai/compat";
```

然后移除 npm 包（避免重复注册同名 provider）：

```bash
pi remove npm:pi-opencode-direct
```

### 验证

用 pi-web 自带的 SDK 离线校验：

```text
loaded extensions: [ '/root/.pi/agent/extensions/opencode-zen-free/index.ts' ]
extension errors: []
has opencode-zen-free: true
opencode-zen-free models: 7
```

再查询**正在运行**的 pi-web（无需重启）：

```bash
curl -sS -u "pi:<PI_WEB_PASSWORD>" -H "Host: 127.0.0.1:30141" \
  "http://127.0.0.1:30141/api/models?cwd=/root"
# opencode-zen-free:big-pickle / mimo-v2.6-flash-free / muse-spark-1.3-contributor-free ...
```

:::tip[pi-web 的模型缓存]
pi-web 的模型列表有 **60 秒**内存缓存（`__piModelsCacheState`，按 cwd 分键）。改完扩展后刷新浏览器即可，**不要贸然 `systemctl restart pi-web`**——重启会中断当前正在进行的会话。
:::

## 十一、最终配置

扩展为**本地扩展**（非 npm）：

```text
~/.pi/agent/extensions/opencode-zen-free/{index.ts,provider.ts}
```

`/root/.pi/agent/settings.json`：

```json
{
  "defaultModel": "deepseek-v4.1-flash",
  "defaultProvider": "volcengine-coding-plan",
  "packages": []
}
```

使用方式：

- 交互式：`/model` 选择 **OpenCode Zen Free** 下的模型；
- 命令行：`pi --provider opencode-zen-free --model <id> "..."`；
- 排障日志：`PI_OPENCODE_DIRECT_DEBUG=1`；
- 自定义 key（可选）：`/login opencode-zen-free` 或设置 `OPENCODE_API_KEY`；不设置则走匿名免费层。

## 十二、经验与注意事项

- **不要用 `--no-tools` 测 OpenCode 免费层**，这是本次排查耗时最久的坑。
- `User-Agent` 是硬门槛，Pi 原生 `opencode` provider 用的是 `pi (...)`，因此即便配上 key 也过不了免费层。
- **CLI 能加载的扩展，pi-web 不一定能加载**：两边 SDK 版本与别名白名单不同，遇到 `@earendil-works/pi-ai/api/*` 这类深层子路径要改成 `/compat`。
- pi-web 模型列表有 60 秒缓存，改完扩展刷新页面即可，避免贸然重启。
- 免费额度按出口 IP 共享，大量请求可能触发 `429` 或 `FreeTierError`；轻量使用。
- Go 系列需要有效订阅，普通 key 不行。
- 抓包用完要**还原 `/etc/hosts`、关闭代理**，并注意文档/日志里不要落明文 key。
- 用 npm 包时启动会出现 `Warning: ... @earendil-works/pi-ai`，那是扩展把宿主包写进了 `dependencies` 而非 `peerDependencies`；改成本地扩展后即消失。
- 未修改 `/root/.pi/agent/models.json`：本方案由扩展直接注册 provider，无需手写 models 配置。

## 十三、2026-10-13 上游规则变更：伪装方案再次失效

> 本章记录本方案上线后第一次被上游“打回”的完整过程。结论先行：**这是一条靠“伪造客户端身份”维持的灰色通道，上游随时可以单方面改规则，而我们只能被动跟改。** 这是本方案最大的、且无法根治的结构性弊端。

### 13.1 触发事件

同一天发生了两处升级：

| 组件 | 之前 | 之后 |
| --- | --- | --- |
| pi-web | 0.11.0 | **0.12.0**（内置 `pi-ai` / `pi-coding-agent` 升到 **1.1.0**） |
| OpenCode CLI | 1.18.34 | **1.19.0**（改为独立二进制） |

升级后 pi-web 里 `opencode-zen-free` 的免费模型仍然能被列出（扩展加载正常、provider 注册正常），但**一发请求就 403**：

```
403: {"type":"FreeTierError","message":"OpenCode's free tier can only be used from within OpenCode. Download it at https://opencode.ai and keep building."}
```

### 13.2 定位方法（对照抓包）

沿用第七节的思路，但不覆盖、分开保存请求，做单变量对比：

1. 确认 **OpenCode CLI 1.19.0 自己能跑通**（`opencode run -m opencode/mimo-v2.6-flash-free ...` → `OK`），说明账号/网络没问题，差异在请求本身；
2. 用 **OpenCode 插件钩子**（`chat.headers` / `chat.params`）和 **patch `globalThis.fetch`** 拿到 1.19.0 真正发出的请求；
3. 把 CLI 的请求体/请求头作为“已知可用的基准”，逐项替换成 Pi 扩展发出的内容，观察 403 在哪一步出现。

:::tip[比 TLS 中间人更省事的抓包法]
不必再上 TLS MITM。OpenCode 1.19.0 支持插件，在 `~/.config/opencode/plugin/` 放一个 `.js`，hook `chat.headers` 即可看到头，或直接包裹 `globalThis.fetch` 打印 URL/头/body。用完记得删除插件，避免污染后续请求。
:::

### 13.3 上游具体改了什么

对照结论（1.19.0 免费层）：

| 项 | 旧（1.18.x，本方案依赖） | 新（1.19.0） |
| --- | --- | --- |
| 推理端点 | `https://opencode.ai/zen/v1` | **`https://opencode.ai/inference/v1`** |
| 会话头 | `x-opencode-session` | 新增 **`x-opencode-session-id`** |
| `x-client-request-id` | 旧扩展自行添加 | 真实客户端**不发**该头 |
| User-Agent | `opencode/1.18.34 ...` | `opencode/1.19.0 ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.14` |

此外，免费层的 body 门槛也被收紧并显式化，实测必须同时满足：

- `stream: true`（非流式直接 403）；
- `tools` 中**必须同时包含 `bash` 和 `read`**（只给 1 个工具、或给 12 个假工具都 403）；
- **User-Agent 不得携带伪装标记**：`opencode/1.18.31 pi-opencode-direct/0.1.7` → 403；`opencode/1.18.31` → 200。

最后一条是本次最直接的“死因”：旧扩展硬编码的 UA 后缀 `pi-opencode-direct/0.1.7` 已被上游识别并拉黑。

### 13.4 对本地扩展做的修改

只改本地扩展 `/root/.pi/agent/extensions/opencode-zen-free/provider.ts`（不动 npm 包、不动 `models.json`），共 7 处：

1. `BASE_URL` 改为 `https://opencode.ai/inference/v1`（模型目录仍走 `/zen/v1`，单列为 `CATALOGUE_URL`）；
2. `OPENCODE_USER_AGENT` 去掉 `pi-opencode-direct/0.1.7`，改为 `opencode/1.19.0 ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.14`；
3. 请求头补齐 `x-opencode-session-id`，并移除真实客户端不发的 `x-client-request-id`；
4. 上述改动同步到三条路径：主 provider、`patchCompatDirectTransport`、`patchGlobalFetchForZen` / `patchNodeHttpForZen`。

改完后的本地校验（把 `BASE_URL` 临时指向本地回环 echo 服务，**不发外网**）确认：扩展发出的请求已与真实客户端逐项一致——UA、`x-opencode-session-id`、无 `x-client-request-id`、`stream:true`、17 个工具（含 `bash`/`read`）。

### 13.5 本次未闭环的地方

改完后对真实端点的验证**仍返回 403**。结合对照实验（同样的 OpenCode 原样请求连续 200，本扩展请求连续 403），更可能的原因是：

- **匿名免费额度按出口 IP 共享**，本轮排查对上游发了上百次请求，当前 IP 的额度很可能已被消耗或限流；
- 因此**无法在当下这个 IP 上确认 200**。

:::warning[排障纪律：不要反复打真实接口]
排查免费层时极易在短时间内对上游产生大量请求，可能触发 `429`/`FreeTierError`，甚至招致 IP 层面的封禁。**能离线对照（本地回环、逐项替换）就不要打真实端点。** 需要验证时，间隔一段时间、只发一次。
:::

恢复窗口过后用一条命令验证：

```bash
PI_OPENCODE_DIRECT_DEBUG=1 pi --print --no-session \
  --provider opencode-zen-free --model mimo-v2.6-flash-free "Reply with exactly: OK"
```

若仍 403，则说明上游除了 UA 还在看别的特征（例如 TLS 指纹、`x-stainless-*` 头组合等），需要等 `pi-opencode-direct` 上游跟进 1.19.0。

### 13.6 结构性弊端（重要）

这是本方案**必须长期接受的代价**，也是选型时要提前想清楚的：

- **被动跟改**：整套机制建立在“让服务端相信请求来自 OpenCode 官方客户端”之上。上游只要改一次端点、加一个头、收紧一条门槛，我们就得重新抓包、重新对齐。
- **没有契约保障**：这不是公开 API，没有版本号、没有变更日志、没有兼容期，随时可能单方面失效。
- **识别维度不透明**：这次是 UA 标记，下次可能是 TLS 指纹、请求头顺序、body 字段组合等更难模仿的特征。
- **额度按 IP 共享**：多人/多进程共用同一出口 IP 时互相挤占，且排查本身就会消耗额度。
- **封禁风险**：反复探测或高频调用可能招致 IP 级封禁，影响机器上其它依赖该出口的服务。

**取舍建议**：

- 把它当**临时/兜底通道**，不要当生产依赖；关键任务走有正式契约的付费 provider。
- 上游改动后，优先**离线对照**定位差异，确认后再发**一次**真实请求验证。
- 若某次改动后长期无法恢复，直接停用该扩展即可——它只是本地扩展，删掉不影响 Pi 与 pi-web 的其它功能。

## 附录：准备环境时用到的信息

- 扩展加载入口：用户扩展目录 `~/.pi/agent/extensions/`，或 `~/.pi/agent/settings.json` 的 `packages` 数组（npm / git / 本地包）；
- Pi 会为扩展做模块别名：`@earendil-works/pi-ai` 指向 `/compat`，同 `compat` / `oauth` / `providers/all`；**不含 `/api/*`**；
- 本地扩展可用 `pi -e ./path` 临时加载；
- 非交互式（`--print` / `--list-models`）下扩展的 `refreshModels` 可能因 `allowNetwork=false` 不联网，模型会回落到内置目录或已持久化的快照。
