---
sidebar_position: 1
description: Hermes（Nous Research 的代理框架）在这台服务器上的使用回顾：时间线、接入渠道、模型、实际干了什么，以及它留下的遗产。
tags: [回顾, 服务器, 运维]
---

# Hermes 使用回顾

> 本文写于 **2026-09-30**，是在决定移除 Hermes 之前做的一次「考古」——通过翻遍它的会话记录、规划文件、记忆、技能与各项目的 git 历史，还原这两年它在这台服务器上到底陪我们干了什么。数据层面的存档清单见[《数据与拆除清单》](./hermes-data-inventory)。

## Hermes 是什么

Hermes 是 [Nous Research](https://hermes-agent.nousresearch.com) 出品的**自托管 AI 代理框架**（Python）。和后来换上的 pi / Claude 这类「跑在终端里的编码代理」不同，Hermes 的定位是**常驻在服务器上的聊天 AI**：

- 通过 **Telegram / Discord / Signal** 等消息平台接入，用手机随时对话；
- 有完整工具链：终端执行、浏览器、文件读写、Web 搜索、图片/语音，还能挂 MCP 服务器；
- 支持 **cron 定时任务**、**kanban 任务板**、长期记忆（MEMORY.md / USER.md）、技能（skills）沉淀；
- 默认模型走 **opencode.ai 的 zen 网关**（OpenCode Go），多模型可切换。

## 时间线

| 阶段 | 时间 | 状态 |
| --- | --- | --- |
| 安装 | 2026-04-25 | CLI 试用，逐步接入 Telegram |
| 高频期 | 2026-04 ～ 05 | 每天几乎都在用：开发、运维、闲聊 |
| 迁移 Discord | 2026-05 中 | 主力渠道从 Telegram 转到 Discord |
| 收尾期 | 2026-06 | 频率下降，最后一条会话 06-26（Google 搜索测试） |
| 停用 | 2026-09-17 | 网关最后正常关闭，此后闲置 |

数据跨度：**152 个会话、20041 条消息**，活跃 61 天，时间从 04-25 到 06-26（9 月中只是关掉网关，不再有新会话）。

## 接入渠道

| 渠道 | 会话数 | 说明 |
| --- | --- | --- |
| **Discord** | 83 | 5 月中旬起的主力。服务器频道「常规」（lopop-home）+ 私信「lopop_cat」 |
| **Telegram** | 56 | 前期主力，4-05 月初高频，6 月起弃用 |
| **cron** | 7 | 定时任务，主要是「每日计划提醒」 |
| **CLI** | 6 | 本机命令行试用 |

折腾过的方向（但最终没成主力）：

- **Signal**：05-12 研究过接入方案，想让手机端从 Telegram 换到 Signal —— 但从 `channel_directory.json` 看 signal 始终是空的，**没有实际启用**。
- **每日计划提醒**（cron）：05-09 用 cron + Markdown + SkyDrop 投递做了「规划明天」功能，05-12 就被判定「过于鸡肋」删掉了。

## 用过的模型

走的是 opencode.ai 网关，模型在会话里反复切换（切模型时 Hermes 还会自动发一条 note 提示）：

| 模型 | 会话数 |
| --- | --- |
| deepseek-v4-flash | 59 |
| deepseek-v4-pro | 55 |
| kimi-k2.6 | 28 |
| qwen3.5-plus | 3 |
| kimi-k2.5 / minimax-m3 / glm-5.2 | 各 1 |

**deepseek 系是绝对主力**，kimi 作为备选切换。

## 主要干了什么

按项目/主题分类（每条都尽量和对应项目的 git 记录对得上）：

### 1. SkyDrop（文件分享）开发

早期大量工作是 SkyDrop 前后端：

- 修删除文本文件失败的 bug、去掉「复制链接」按钮；
- 上传页加「压缩包」分类、上传 favicon 压缩包解压当网站图标；
- 去掉文本文件左侧装饰边框（与其它类型保持一致）；
- 中文文案翻译提交、前端 UI 反复打磨（画廊模式、瀑布流、移动端布局）；
- 给所有 handler 补中文 swagger 注解、修部署流水线（web-latest tag 丢失导致静默失败）、修视频转换后手机/电脑打不开的问题。

### 2. Steward（服务器总管）的早期建设

Steward 有一半的功能是 Hermes 时代搭出来的骨架，`~/.hermes/plans/` 里还留着三份实施规划：

| 规划文件 | 落地的功能 |
| --- | --- |
| `steward-git-status-dashboard.md` | Git 状态看板（`GET /git/status` + `#/git` 路由） |
| `steward-server-status-dashboard.md` | 服务器状态看板（`#/status`，聚合 CPU/内存/服务/部署/备份） |
| `precept-strategy-arch.md` | Precept 策略层重构（内部规划，后来在 precept 侧实施） |

日常还让 Hermes 做：查 CI 失败原因（GitHub REST API 查 workflow 日志）、检查部署状态、看服务运行状态、清理缓存、排查 steward 流水线问题。

**Steward 还反过来给 Hermes 提供了 MCP 服务**（`http://localhost:9092/mcp`），Hermes 记忆里明确记着 steward 的三种鉴权方式、`.env` 密钥位置、部署流程。

### 3. Precept（交易系统）

- ETH 模拟策略亏损复盘、ETH 1 分钟 K 线最低价查询；
- 回测记录数量上限优化（存储换精度，宁可多占磁盘不丢数据）；
- 检查戒律数据库有多少条、协调 precept_flutter 开发；
- 明确分工：**移动端用户自己在本地 Gradle 构建，Hermes 只做 Web 前端 + Go 后端**。

### 4. 服务器日常运维

- 磁盘/存储治理：docker 镜像和容器占太多空间的问题；
- 代理服务排查：SS 代理状态与日志检查（后来 SS 彻底清除，换成 xray 443）；
- SSH 公钥私钥检查、内存存储每日巡检（「日常检查，看一下内存和存储」）；
- 装过完整 Flutter 环境 —— 后来发现所有构建都走 GitHub Actions，**本地不需要 Flutter，node_modules 也删掉了**。

### 5. 生活与闲聊

- 睡前焦虑失眠的倾诉、每天早晚安；
- 角色扮演：宇宙飞船 AI（前往比邻星、算到港时间）、猫娘（角色设定参考萌娘百科）；
- Rimworld wiki 查询（Dresser 和 End table 的差别）、明日户外/生活规划（探索江心洲、洗衣服、论文外文翻译）。

### 6. 与 Claude Code 联动

Hermes 记忆里记录了 Claude Code 的 remote server 模式（claude-ssh）和「一键退出全部 Claude 进程」的机制 —— 后来这套收进 steward 的清理功能（核弹模式全杀）。

## 它沉淀下来的东西（会被一起删掉）

- **记忆**：`MEMORY.md`（11 条，几乎全是本服务器运维要点）+ `USER.md`（用户偏好）；
- **技能**：28 个技能目录（另有 `.archive/` 归档一批），其中几个是这次使用期间自研沉淀的 —— `go-http-refactor-to-servemux`（Go ServeMux 重构）、`go-slog-structured-logging`（slog 结构化日志）、`go-yaml-config-audit`（YAML 配置审计）、`flutter-cross-platform-build-fixes`、`github-actions-webhook-deploy`；
- **规划**：3 份实施计划（见上表）；
- **会话数据**：152 会话 + 20041 条消息（`state.db`），101 个 JSONL 会话文件。

## 遗产：被 steward / docs 接管的记忆

Hermes 记忆里记录的服务器知识，大部分已经固化到了更「长寿」的地方：

- steward 的 **`AGENTS.md` / `CLAUDE.md`**：鉴权方式、部署流程、公开 IP、xray 配置、各项目结构 —— 全部写进去了；
- **docs.lopop.top**：本文就是开始把这段历史沉淀下来的第一步；
- steward 的 **ops 运维面板**里还挂着两个 Hermes 的项（`dashboard` Hermes Dashboard :9119、`gateway` Hermes Agent :8645），删除 Hermes 时一并移除即可；
- steward 的 MCP 列表里不再需要 `steward` 自身条目（`/mcp` 服务保留，但为 Hermes 配的 context7 MCP 随 Hermes 删除）。

## 小结

Hermes 是「手机上的服务器 AI 管家」这个思路的第一次落地：日常开发、运维巡检、生活闲聊都在聊天软件里完成，还自研沉淀了技能。后来换成 pi（编码代理 + TUI/Web）是**另一种形态** —— 更专注代码本身。两者不冲突，但 Hermes 作为「常驻聊天 AI」的角色，随着这套服务器知识全部迁移进文档与 steward，使命已经完成。
