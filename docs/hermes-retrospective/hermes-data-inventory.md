---
title: Hermes 数据与拆除清单
sidebar_position: 2
description: 删除 Hermes 前的数据存档清单：目录、数据库、会话、密钥、服务，以及删除后需要清理的残留（含 steward 运维面板里的两项）。
tags: [清理, 服务器, 运维]
---

# Hermes 数据与拆除清单

> 与[《Hermes 使用回顾》](./hermes-usage-retrospective)配套。本文是 **2026-09-30** 归档的删除前快照：Hermes 在这台服务器上留下了什么、哪些需要存档、哪些直接删、删除后还有什么残留要清。

## 一、根目录 `~/.hermes/`（约 186 MB）

| 路径 | 内容 | 处置 |
| --- | --- | --- |
| `hermes-agent/` | 主程序（Python + venv + node_modules） | 删 |
| `state.db` | 核心状态库：**152 会话 / 20041 条消息**（含 FTS 全文索引） | **存档后删** |
| `sessions/*.jsonl` | 101 个会话 JSONL（04-25 ~ 05-30，之后只进 state.db） | 存档后删 |
| `kanban.db` | 任务板（**0 任务**，从未真正启用） | 删 |
| `skills/` | 28 个技能目录 + `.archive/`（含 5 个自研：servemux 重构 / slog 日志 / yaml 审计 / flutter 构建 / gh-actions 部署） | 删（要点已摘进回顾文） |
| `plans/` | 3 份实施规划（git 看板 / 状态看板 / precept 架构） | 存档后删 |
| `memories/` | `MEMORY.md` + `USER.md`（服务器知识 + 用户偏好） | **已迁移到 steward/docs，可删** |
| `logs/` | agent / gateway / errors / update 等日志 | 删 |
| `config.yaml` | 主配置（模型、渠道、MCP、安全） | 可留一份脱敏版备查 |
| `.env` | 密钥：Telegram/Discord bot token、各 provider API key | **删除时彻底清掉，勿入库** |
| 其它 | `cron/`、`gateway/`、`lsp/`、`sandboxes/`、`models_dev_cache.json`（4 MB）等 | 删 |

## 二、会话数据统计（存档前最后核对）

- 总会话 **152**：Discord 83 / Telegram 56 / cron 7 / CLI 6
- 总消息 **20041**，时间跨 **2026-04-25 → 2026-06-26**
- 网关最后运行至 **2026-09-17**（`.clean_shutdown` 时间戳），9 月起无新会话
- 主要模型：deepseek-v4-flash(59) / deepseek-v4-pro(55) / kimi-k2.6(28)

## 三、系统级残留（独立于 `~/.hermes/`，删除时一并处理）

| 残留 | 位置 | 说明 |
| --- | --- | --- |
| **Hermes Agent 网关** | systemd **user** unit `hermes-gateway.service`（`/root/.config/systemd/user/`） | 已 failed，`systemctl --user disable --now hermes-gateway` 后删文件 |
| **Hermes Dashboard** | command 托管：`/root/.hermes/hermes-agent/... dashboard --port 9119`，pid 文件 `/tmp/hermes-dashboard.pid` | 随目录删除即失效 |
| **steward 运维面板两项** | `configs/config.yaml` 的 `ops.services`：`dashboard`（Hermes Dashboard :9119）、`gateway`（Hermes Agent :8645） | **从配置里移除**，重启 steward 生效 |
| **steward MCP 列表** | `~/.hermes/config.yaml` 的 `mcp_servers`（steward + context7） | 随 Hermes 删除，无需单独处理 |
| **steam/cron 任务** | `~/.hermes/cron/jobs.json` | 早已清空（0 任务） |

删除顺序建议：先停网关（避免进程占用）→ 删 `~/.hermes/` → 删 systemd user unit → 从 steward 配置移除两项 → 重启 steward → 确认 `/ops` 无 Hermes 项。

## 四、需要留档的东西（已固化，不随删除丢失）

- **服务器知识** → steward 的 `AGENTS.md` / `CLAUDE.md`（鉴权、部署、IP、xray 等）
- **使用回顾** → 本文 + 《Hermes 使用回顾》
- **运维能力** → 已由 steward 的 ops / git / dbexplorer / 备份 承接
