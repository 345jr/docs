---
title: 在 Pi 中接入 WorkBuddy 免费模型
sidebar_position: 3
description: 把 WorkBuddy AI 国际版的免费模型接进 Pi 与 pi-web 的完整记录——从 icekale/pi-workbuddy-connect 这个仓库讲起，逐段拆解它的工作原理（凭据解析、OAuth 登录、请求头注入、payload 规整、推理档映射），再到实际安装、类型检查、免重启热加载、登录与三模型实测。
tags: [pi, pi-web, workbuddy, 模型接入, 扩展原理, OAuth]
---

# 在 Pi 中接入 WorkBuddy 免费模型

> 这是[《在 Pi 中接入 OpenCode 免费模型》](./opencode-free-in-pi) 的姊妹篇。那一次靠抓包从零逆推出了服务端的门槛；这一次有现成的社区扩展 [`icekale/pi-workbuddy-connect`](https://github.com/icekale/pi-workbuddy-connect)，重点从「逆向」变成了「读懂」——**这个仓库到底做了什么，才让 WorkBuddy 桌面 App 的免费额度能在 Pi 里跑起来**。

## 一、目标与背景

在上一篇文章里，我们已经把 OpenCode Zen 的免费模型接进了 Pi（`opencode-zen-free` provider，7 个模型）。这次的目标是再加一个来源：**WorkBuddy AI 国际版**（`www.workbuddy.ai`）的免费模型。

环境：

| 项目 | 值 |
| --- | --- |
| pi-web | `0.11.0`（`/usr/lib/node_modules/@agegr/pi-web`） |
| pi-web 内置 SDK | `pi-coding-agent 1.1.0` / `pi-ai 1.1.0` |
| 全局 pi CLI | `1.0.0`（`/usr/lib/node_modules/@earendil-works/pi-coding-agent`） |
| pi 配置目录 | `/root/.pi/agent` |
| 已有 provider | `volcengine-coding-plan`（8 模型）、`opencode-zen-free`（7 模型） |

WorkBuddy 的产品形态是**桌面客户端 + 账号订阅**：登录后每个账号有一份 Free Plan 额度（实测是 100 credits / 月），客户端内置的模型直接消耗这份额度。官方没有给 Pi 这样的第三方 agent 提供任何 SDK 或 API 文档——能用的只有桌面客户端本身。

于是问题变成：**怎么把一个只有桌面客户端的模型服务，搬进 Pi？**

## 二、找到的仓库

社区已经有人做了这件事：[`icekale/pi-workbuddy-connect`](https://github.com/icekale/pi-workbuddy-connect)（MIT，v1.1.5），作者注明移植自 [`iceloon/dsh-workbuddyai-connect`](https://github.com/iceloon/dsh-workbuddyai-connect)（DSH 插件）。整个仓库只有三个东西：

```text
pi-workbuddy-connect/
├── extensions/workbuddy.ts   # 全部逻辑，单文件约 1000 行
├── test/                    # 两个回归测试
├── package.json             # pi 扩展清单
└── README.md
```

和 OpenCode 那次不同，这个仓库**没有在网络层做伪装**——它是老老实实走 `pi.registerProvider`，把 WorkBuddy 当成一个正常的 OpenAI 兼容端点接进来。移植过程中把 DSH 的 shim 与 loopback 端口转发全删了，所以安装方式就是 `pi install`，不需要起代理进程。

## 三、工作原理：这个仓库到底做了什么

理解一个 provider 扩展，可以按「一次请求的生命周期」拆成五步。下面每一步都对应 `extensions/workbuddy.ts` 里的一段代码。

```text
① 注册      pi.registerProvider("workbuddy", {...})
② 拿凭据    resolveCred()  ← 环境变量 / 自存文件 / 桌面 App
③ 换请求头  before_provider_headers 钩子
④ 规整请求体 before_provider_request 钩子
⑤ 渲染界面  widget / status / /workbuddy 命令
```

### 3.1 第一步：注册 provider

```ts
pi.registerProvider("workbuddy", {
  name: "WorkBuddy AI",
  baseUrl: "https://www.workbuddy.ai/v2",
  api: "openai-completions",
  headers: { "X-Pi-WorkBuddy": "1" },   // ← 占位标记，运行时会被换掉
  oauth: { name: "WorkBuddy AI", login, refreshToken, getApiKey },
  models,
  async refreshModels() { /* 重新读产品配置并重建模型列表 */ },
});
```

几个关键点：

- **`api: "openai-completions"`** — WorkBuddy 的 `/v2/chat/completions` 是标准 OpenAI 形状，所以直接复用 Pi 的 OpenAI 适配器，不写任何协议转换代码。这是整个接入能如此轻量的根本原因。
- **`X-Pi-WorkBuddy: 1` 是故意留的占位头**。Pi 的扩展钩子里不能直接拿到「当前是哪个 provider」，所以作者用一枚 marker 头做作用域标记：请求头发出去之前，钩子看到 `X-Pi-WorkBuddy: 1` 就知道这属于 WorkBuddy，然后把 marker 删掉、换上真正的鉴权头。**这是避免污染其它 provider 的关键设计**，后面 3.3 会展开。
- **`oauth` 而不是 `apiKey`** — WorkBuddy 没有 API Key 概念，只有账号 token。声明成 OAuth provider 后，Pi 和 pi-web 会自动给它渲染出「Connect / 登录」按钮，而不是让用户去粘贴一个不存在的 key。

模型不是写死的，而是从**产品配置**里读：

```text
~/.workbuddy-ai/cache/acc-product-config-v3.json  →  reasoning.supportedEfforts
                                                       maxInputTokens / maxOutputTokens
                                                       supportsImages / supportsReasoning
                                                       credits（"x0.00" 表示免费）
```

这个文件是桌面客户端写的产品矩阵缓存。读不到时回退到内置清单（`BUILTIN_MODELS`）。免费判定用一条正则：

```ts
export function creditsAreFree(credits: string) {
  return /^x?0(?:\.0+)?$/u.test(credits.trim());
}
```

也就是 `x0.00` / `0` / `0.0` 都算免费，非零一律付费。切换范围存在 `~/.pi/agent/.workbuddy-settings.json`（`{"scope":"free"|"all"}`）。

### 3.2 第二步：凭据从哪来

`resolveCred()` 按优先级解析，**过期前 5 分钟自动续期**：

```text
WORKBUDDY_AUTH_FILE 环境变量
  ↓ 没有
~/.pi/agent/.workbuddy-auth.json          （插件自己存的）
  ↓ 没有
桌面 App 的 workbuddy-desktop-ai.info      （macOS / Windows / Linux 各有路径）
```

「谁的过期时间晚用谁」（`own.expiresAtMs > desktop.expiresAtMs`），所以桌面上重新登录后，Pi 侧会自动跟上。

需要续期时打 `POST /v2/plugin/auth/token/refresh`，鉴权靠 `X-Refresh-Token` + `X-Auth-Refresh-Source: workbuddy`，成功后回写 `.workbuddy-auth.json`（权限 `0600`）。整个续期过程用了一个 `inflight` Promise 去重，避免同一时刻多个请求重复刷新。

```ts
if (cred.expiresAtMs > 0 && Date.now() + REFRESH_MARGIN_MS < cred.expiresAtMs) return cred;  // 5 分钟margin
inflight ??= (async () => { ... })().finally(() => { inflight = undefined; });
return inflight;
```

还有一个贴心的兜底：**续期失败但旧 token 还没过期 30 秒以上时，继续用旧 token**，不因为一次网络抖动打断当前对话。

### 3.3 第三步：请求头是怎么被换掉的

这是整个仓库最巧的一段。Pi 的 `before_provider_headers` 钩子能拿到即将发出的 headers 并就地修改，但它**不知道 provider 是谁**。作者的解法是「占位 + 认领」：

```ts
// 注册时先埋一个假头
headers: { [MARKER]: "1" }        // MARKER = "X-Pi-WorkBuddy"

// 发请求前再把它换掉
pi.on("before_provider_headers", async (event) => {
  if (!hasMarker(event.headers)) return;        // 不是我们的请求，不管
  const cred = await resolveCred();
  event.headers[MARKER] = null;                 // 删掉 marker
  event.headers[MARKER.toLowerCase()] = null;   // 大小写两种都删干净
  for (const [k, v] of Object.entries(chatHeaders(cred))) event.headers[k] = v;
});
```

`chatHeaders()` 造出来的是这样一整套伪装：

```ts
{
  "Accept": "application/json, text/plain, */*",
  "X-Requested-With": "XMLHttpRequest",
  "Origin": "https://www.workbuddy.ai",
  "Referer": "https://www.workbuddy.ai/",
  "User-Agent": "CLI/2.63.2 CodeBuddy/2.63.2",   // ← 桌面客户端的 UA
  "Authorization": `Bearer ${cred.accessToken}`,
  "X-User-Id": cred.uid,                          // 没有就退化成 X-No-User-Id: 1
  "X-Enterprise-Id": cred.enterpriseId ?? "…",    // 没有就退化成 X-No-Enterprise-Id: 1
  "X-Domain": cred.domain ?? "…",                 // 没有就退化成 X-No-Department-Info: 1
  "X-Product": "SaaS",
}
```

`X-No-User-Id` / `X-No-Enterprise-Id` / `X-No-Department-Info` 这组「否定头」很有意思：桌面客户端在没有对应信息时会显式发 `1` 来告诉服务端「这些字段确实没有」，**不发是不行的**。这是从真实客户端抓出来的约定，纯猜是猜不到的。

### 3.4 第四步：请求体规整

`before_provider_request` 钩子拿到的是即将发往 `/chat/completions` 的 JSON。WorkBuddy 的端点比标准 OpenAI 挑食，作者写了 `prepareChatPayload()` 做四件事：

**① `stream` 强制为 true** — 端点只支持流式。

**② developer 角色降级 + 补 system** — 声明 `compat.supportsDeveloperRole: false`，Pi 就不会发 `role: "developer"`；万一有，也会在这里改写成 `system`。并且如果首条消息不是 system，会补一条 `You are a helpful assistant.`。

**③ 剥掉回放的 reasoning 字段** — 这是最容易踩的一个坑：

```ts
function stripAssistantReasoning(messages) {
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    delete msg.reasoning;
    delete msg.thinking;
    delete msg.reasoning_content;
    msg.content = msg.content.filter(part => part.type !== "reasoning" && part.type !== "thinking");
  }
}
```

多轮对话时，Pi 会把历史 assistant 消息连同推理内容一起回传。**WorkBuddy 上游会直接拒绝带这些字段的请求**（不是警告，是 400）。所以每次请求前都要清一遍。

**④ tool_choice 归一化** — Pi 发的是 OpenAI 的嵌套对象形式 `{type:"function", function:{name:"x"}}`，而 WorkBuddy 只认扁平的 `"auto" / "required" / "<函数名>"`；`none` 则要把 `tool_choice`、`tools`、`functions` 三个字段一起删掉。

> 还有一个刻意的「不做」：`reasoning_effort` **永远不注入**。选 Default（auto）时不发该字段，选具体档位时原样透传。上游在没选档位时就是裸请求，如果 Pi 擅自补一个 `high` 上去反而会改变行为。

### 3.5 推理档是怎么映射的

WorkBuddy 每个模型支持的档位不一样，这个信息来自产品配置的 `reasoning.supportedEfforts`。Pi 侧要用 `thinkingLevelMap` 把它翻译成自己的档位词汇：

```ts
export function thinkingLevelMap(efforts, canDisable = false) {
  return {
    off:     canDisable ? "off" : null,
    minimal: null,
    low:     efforts.includes("low")     ? "low"     : null,
    medium:  efforts.includes("medium")  ? "medium"  : null,
    high:    efforts.includes("high")    ? "high"    : null,
    xhigh:   efforts.includes("xhigh")   ? "xhigh"   : null,
    max:     efforts.includes("max")     ? "max"     : null,
  };
}
```

`null` 表示「该档位不存在」，选择器里就不会出现。`Hy4 preview` 只声明了 `high`，所以它只有 high 一档；声明了 `supportsReasoning` 但没声明 `supportedEfforts` 的模型，默认给全套 low/medium/high/xhigh/max。

### 3.6 一个刻意的「缺陷」：16k 封顶

```ts
// ponytail: flash reasoning loops (OK/Let me write/Go) eat 128k max_tokens;
// 16k stops the stall. Raise if long answers get cut.
const FLASH_MAX_TOKENS = 16_384;
```

`Deepseek-V4.1-Flash` 声明的最大输出是 128k，但上游这个模型有个病态行为：会陷入 `OK.` / `Let me write.` / `Go.` 式的推理循环，把 128k 预算全部烧完才肯停。所以扩展在**模型注册时**和**每次请求时**双重把它压到 16k：

```ts
maxTokens: row.id === "deepseek-v4.1-flash" ? Math.min(row.maxTokens, FLASH_MAX_TOKENS) : row.maxTokens
```

这是个有意识的取舍：**牺牲长回答能力，换取不会卡死**。如果你发现长答案被截断，就把这两个常量调大。

### 3.7 第五步：界面

侧栏 widget 显示账号、token 过期时间、各积分包余量进度条和当前模型列表；`/workbuddy` 命令可以刷新积分、切换免费/全部模型、断开登录。

这里有个值得学的细节——**`session_start` 绝不做网络 IO**：

```ts
pi.on("session_start", (_event, ctx) => {
  // Never block session startup on the optional account/credits card.
  void paint(ctx, false).then(...).catch(() => undefined);
});
```

积分查询要打 `POST /v2/billing/meter/get-user-resource`，如果同步 await，会让每次开会话都卡一下。所以改成「先返回，异步补画」。同理，`model_select` 钩子会 await 处理器，所以它只从缓存里重绘卡片，网络刷新丢到后台：

```ts
pi.on("model_select", (_event, ctx) => {
  if (card) ctx.ui.setWidget("workbuddy", card);   // 同步：用缓存
  void paint(ctx, false)...                          // 异步：刷新的丢后台
});
```

仓库里还带了这两个回归测试，正是守着上面这些边界：

```text
scope.test.mts       断言 hook 不污染其它 provider 的请求
session-start.test.mts  断言 session_start 不等网络
```

## 四、实际接入过程

### 4.1 安装

不装 npm 包，直接把单文件放进 Pi 的用户扩展目录（和 OpenCode 那次的处理思路一致：本地扩展不受 `pi update` 覆盖，也没有版本混用的风险）：

```bash
mkdir -p /root/.pi/agent/extensions/workbuddy
cp extensions/workbuddy.ts /root/.pi/agent/extensions/workbuddy/index.ts
```

Pi 的扩展发现规则是：`extensions/*/index.ts`、`extensions/*/index.js`、或 `extensions/*.ts` 直文件，三种都认。

### 4.2 类型检查

这一步是**必要的**，因为 pi-web 和全局 CLI 的 SDK 版本不同（1.1.0 vs 1.0.0），扩展用到的 API 得确认两边都在。仓库没带 `node_modules`，所以手工搭一个：

```bash
mkdir -p /tmp/tscheck && cd /tmp/tscheck
mkdir -p node_modules/@earendil-works node_modules/@types
ln -sfn /usr/lib/node_modules/@agegr/pi-web/node_modules/@earendil-works/pi-ai \
       node_modules/@earendil-works/pi-ai
ln -sfn /usr/lib/node_modules/@agegr/pi-web/node_modules/@earendil-works/pi-coding-agent \
       node_modules/@earendil-works/pi-coding-agent
npm i --no-save @types/node typescript@5
./node_modules/.bin/tsc --strict --noEmit --target ES2023 --module ESNext \
  --moduleResolution bundler --skipLibCheck index.ts
```

结果：**0 error**。

:::tip[为什么这次不用改 import]
OpenCode 那次踩的坑是扩展 import 了 `@earendil-works/pi-ai/api/openai-completions.lazy`，而 Pi 的别名白名单不含 `/api/*`，被拼成 `dist/compat.js/api/...` 导致 pi-web 加载失败。这个扩展**只 import 类型**：

```ts
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
```

`import type` 运行时会被完全擦除，扩展零运行时依赖 `@earendil-works/pi-ai`，所以两个宿主都能原样加载。这是写 Pi 扩展时值得抄的写法。

另外也顺手确认了 `registerProvider` 的双参形式（`registerProvider(name, config)`）在 1.0.0 和 1.1.0 里都存在，两边通吃。
:::

### 4.3 自检与测试

```bash
cd /root/.pi/agent/extensions/workbuddy
node --experimental-strip-types index.ts --self-check     # → ok
# 覆盖认证解析、payload 规整、推理档映射、积分解析、widget 渲染

node --experimental-strip-types /tmp/pwc/test/scope.test.mts
# foreign payload changed? false
# OK: foreign provider payload untouched.

node --experimental-strip-types /tmp/pwc/test/session-start.test.mts
# OK: session_start returns without waiting for WorkBuddy network
```

### 4.4 pi-web 免重启热加载

装完之后**不需要重启 pi-web**（这和上一篇文章里的 60 秒模型缓存结论一致）。直接查正在运行的实例：

```bash
curl -sS -u "pi:$PI_WEB_PASSWORD" http://127.0.0.1:30141/api/auth/providers \
  | python3 -c "import json,sys;[print(p) for p in json.load(sys.stdin)['providers'] if p['id']=='workbuddy']"
# {'id': 'workbuddy', 'name': 'WorkBuddy AI', 'usesCallbackServer': False,
#  'loggedIn': False, 'supportsApiKey': False}
```

provider 已经注册上了，但此时 `loggedIn: False`，模型列表里也还没有它——**WorkBuddy 的模型需要有效凭据才会被标记为 available**，这和 `opencode-zen-free` 无凭据也能匿名访问不同。

### 4.5 登录

pi-web 的 provider 登录端点是个 SSE 流：`GET /api/auth/login/{provider}`。它内部调用 `modelRuntime.login(provider, "oauth", { prompt, notify })`，把扩展的 `callbacks.onAuth({url})` 转成一条 `{"type":"auth","url":...}` 事件推给前端。所以直接用 curl 就能拿到授权地址：

```bash
curl -sN -u "pi:$PI_WEB_PASSWORD" \
  http://127.0.0.1:30141/api/auth/login/workbuddy
```

```text
data: {"type":"progress","message":"正在打开 WorkBuddy 登录页…"}
data: {"type":"auth","url":"https://www.workbuddy.ai/login?platform=CLI&state=e55eb063-…","token":"workbuddy-05714cdb-…"}
data: {"type":"progress","message":"请在弹出的页面完成登录，完成后会自动继续"}
```

在浏览器里打开这个 `url` 完成登录后，扩展里的轮询会自动拿到 token：

```text
data: {"type":"success"}
```

凭据落到两个地方：`~/.pi/agent/.workbuddy-auth.json`（插件自存）和 `~/.pi/agent/auth.json`（Pi 的 OAuth 存储，pi-web 的 Connect 按钮走这条）。

> 顺带说明扩展内部的登录轮询：`POST /v2/plugin/auth/state?platform=CLI&nonce=…` 拿到 `state` + `authUrl`，然后每 2 秒轮询 `GET /v2/plugin/auth/token?state=…`，最长 15 分钟。返回 `code: 11217` 表示「用户还没登」，继续等；`code: 0` 且带 `accessToken` 就是成功。

### 4.6 验证

**① provider 状态已变为已登录：**

```bash
curl -sS -u "pi:$PI_WEB_PASSWORD" http://127.0.0.1:30141/api/auth/providers
# {'id': 'workbuddy', ..., 'loggedIn': True, 'supportsApiKey': False}
```

**② 模型列表已出现（15 → 18）：**

```bash
curl -sS -u "pi:$PI_WEB_PASSWORD" http://127.0.0.1:30141/api/models/enabled \
  | python3 -c "
import json,sys
d=json.load(sys.stdin); print('availableTotal', d['availableTotal'])
for p in d['providers']: print(p['id'], p['enabledCount'], [m['id'] for m in p['models']])"
```

```text
availableTotal 18
opencode-zen-free        7  ['big-pickle', 'ling-3.1-flash-free', 'longcat-2.5-preview-free', …]
volcengine-coding-plan  8  ['deepseek-v4.1-flash', 'deepseek-v4-flash', …]
workbuddy               3  ['deepseek-v4.1-flash', 'hy3', 'hy4-preview-f']
```

**③ 三个模型各跑一次真实请求：**

```bash
for m in hy3 deepseek-v4.1-flash hy4-preview-f; do
  timeout 180 pi --model workbuddy/$m -p "只回复：ok" --no-session -nt
done
```

```text
ok
ok
ok
```

**④ 账户额度**（`POST /v2/billing/meter/get-user-resource`）：

```json
{"PackageName": "Free Plan Subscription", "CycleCapacitySize": 100,
 "CycleCapacityRemain": 100, "CapacityUsed": 0,
 "CycleStartTime": "2026-10-01 00:00:00", "CycleEndTime": "2026-10-31 23:59:59"}
```

100 / 100 credits 未使用，token 有效期到 2027 年中，refresh token 已写入，过期前 5 分钟自动续期。

## 五、可用模型矩阵

| 模型 | 上下文 | 输出 | 推理档 | 实测 |
| --- | --- | --- | --- | --- |
| `hy3` | 192k | 64k | low · high | ✅ |
| `deepseek-v4.1-flash` | 1M | 128k（扩展压到 **16k**） | low · medium · high · xhigh · max | ✅ |
| `hy4-preview-f` | 1M | 64k | high | ✅ |

三个模型都支持图像输入，`cost` 全部标 0。

## 六、日常使用

```text
pi-web 模型选择器 → WorkBuddy AI → hy3 / deepseek-v4.1-flash / hy4-preview-f
会话内 /workbuddy            刷新积分、切换免费/全部模型、断开登录
会话内 /workbuddy all        列出全部模型（含付费）
pi --model workbuddy/hy3     命令行直接调用
```

凭据相关环境变量：

| 变量 | 作用 |
| --- | --- |
| `WORKBUDDY_AUTH_FILE` | 指定凭据文件路径，优先级最高 |
| `WORKBUDDYAI_PRODUCT_CONFIG` | 指定产品配置 JSON 路径 |
| `PI_CODING_AGENT_DIR` | Pi agent 目录，影响自存凭据与设置文件位置 |

## 七、经验与注意事项

- **能用现成扩展就别自己逆向**。OpenCode 那次花了大篇幅抓包；这次直接读代码 + 三次 `curl` 验证就完事了。但读代码的价值在于知道它为什么能work——尤其是 `X-No-User-Id` 这组否定头和 reasoning 字段剥离，猜是猜不到的。
- **`import type` 是写 Pi 扩展的好习惯**，运行时零依赖，两个宿主版本都能加载，直接绕开别名白名单的坑。
- **占位 marker 头**是解决「钩子拿不到 provider 上下文」的通用套路，比在 hook 里猜模型名可靠得多（`before_provider_request` 就只能用模型 id 兜底，见 `isWorkBuddyModel()`，并配了 `scope.test.mts` 守住）。
- **钩子里永远不要做阻塞网络 IO**。`session_start` / `model_select` 都会 await 处理器，作者的处理方式是「同步用缓存 + 异步刷网络」，还专门写了回归测试。
- **pi-web 改扩展后不用重启**，模型列表有 60 秒内存缓存，刷新页面即可；贸然重启会打断进行中的会话。
- **免费额度按账号计算**（WorkBuddy 是账号制，OpenCode 是出口 IP 共享），100 credits/月，注意别在长上下文任务里无脑烧。
- **`deepseek-v4.1-flash` 的 16k 封顶是有意为之**，不是 bug。遇到长回答被截断，先调 `FLASH_MAX_TOKENS`，或改用 `hy3` / `hy4-preview-f`。

## 八、一句话总结

`pi-workbuddy-connect` 的本质是**「把桌面客户端的私有约定翻译成 Pi 扩展」**：OAuth 登录换成 Pi 的 `oauth` 回调、桌面客户端的 UA 和否定头用 `before_provider_headers` 注入、上游对 payload 的额外要求用 `before_provider_request` 归一化、产品配置里的推理档翻译成 `thinkingLevelMap`。协议层之所以能这么薄，是因为 WorkBuddy 端点本身就是 OpenAI 兼容的——**真正的工作量全在「兼容之外的那些私有约定」上**。

而 pi-web 之所以能开箱即用，是因为它和 Pi CLI 共用同一份配置目录、同一套模型注册机制：扩展放进 `~/.pi/agent/extensions/` 就够了。