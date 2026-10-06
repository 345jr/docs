---
title: "Pi 1.0 翻译&总结"
sidebar_position: 41
description: Earendil 官方博文《Pi 1.0》的中文翻译与要点总结——Pi 1.0 的七项新特性，以及实验性新包 Pi Durable 的定位。
tags: [pi, 翻译, 发布]
---

# Pi 1.0 翻译&amp;总结

> 原文：[Pi 1.0 | Earendil](https://earendil.com/posts/pi-1-0/)（Date: Thu, 01 Oct 2026）
> 本文第一部分为全文中译，第二部分为要点总结。

## 一、全文翻译

原文以信件形式呈现：


| 字段      | 内容                                                           |
| ------- | ------------------------------------------------------------ |
| Date    | Thu, 01 Oct 2026                                             |
| From    | Earendil &lt;[rfc@earendil.com](mailto:rfc@earendil.com)&gt; |
| To      | You                                                          |
| Subject | Pi 1.0                                                       |


今天，我们自豪地发布 **Pi 1.0**：一个经过加固、极简、可扩展的智能体框架（agent harness），你可以把它变成你自己的工具。每周有数十万人在世界各地使用 Pi，许多人给我们提交 issue 和 pull request。经过数月时间，我们利用这些反馈，把 Pi 打磨、加固、演进成一款个人与企业都可以依赖的稳定软件。

Pi 以极简著称，我们很在意守住这条线。智能体工具每周都在变，但其中很多变化并不能长久。Pi 不是这样运作的。我们会等到某项能力被证明有价值之后，才考虑采纳它——权衡它真正的功能，与它必然带来的额外复杂度。本周早些时候，我们在[这篇文章](https://earendil.com/posts/you-said-no-mcp/)里谈过这个过程，以及它与 Codemode 和 MCP 的关系。

今天发布的 Pi 1.0 就是这一过程的产物。Pi 已经能够运行各家主流厂商的最新模型，成为全球许多人日常使用的编码智能体，并为构建智能体应用提供了一块超级可塑（supermalleable）的基座。随着 Pi 1.0，我们把以下能力纳入 Pi：

- **Codemode**（对 MCP 的原生支持，以及对 Jev、图像模型等非 LLM 模型的支持）
- **扩展支持虚拟模型**（virtual models）
- **延迟工具加载**（deferred tool loading）
- **Anthropic 模型的缓存预热**（cache warming）
- **会话中的系统消息**（transcript-aware 的提示词与工具变更）
- **全新的 TUI 主题**
- **默认全屏模式**

其中许多特性我们已经思考了好几个月。它们被扔到墙上，粘住了（意为经受住考验、最终保留下来）；而掉下墙的清单要长得多。当我们使用带着这些新功能的 Pi 时，感觉这是一次重大的前进，但它依然保持着简单——还是那个 Pi。

在持续打磨、演进 Pi 的同时，我们也逐渐意识到：Pi 的某些方面并不契合许多人想要使用它的形态。在 Earendil，我们希望把 Pi 的极简主义，以及那种让你在编码智能体之外、在终端之外挥洒 AI 的方式带出去。它需要能从不同的入口触达，并支持更长时运行的会话与任务。简言之，**Pi 必须变得更“耐久”（durable）**。我们没有背离极简的根基、试图把 Pi 变成它本不是的东西，而是把这项工作合并进了一个新的实验性包——今天一同发布的 **Pi Durable**。

Pi Durable 是一个用于构建长时运行智能体应用的新基座，让这类应用的构建者和使用者能够以极高的灵巧度驾驭、引导底层智能。它与 Pi 共享两条关键原则——极简与超级可塑——但把这些原则延伸到了新的维度。Mario 在[这里](https://earendil.com/posts/pi-durable/)更详细地讲述了我们是如何打造 Pi Durable 的。

Earendil 成立的使命，是打造强化人类自主性（human agency）的软件与开放协议。今天，我们把这些工具交付给所有人，正是为了帮助做到这一点。我们很期待听到你的反馈，愿意在开放之中一起“驾驭未来”（harness the future out in the open）。

### 安装方式

Pi 1.0 今天即可使用：

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

Windows：

```powershell
powershell -c "irm https://pi.dev/install.ps1 | iex"
```

Pi Durable 今天以实验包形式提供：

```bash
npm install @earendil-works/pi-durable @earendil-works/pi-ai @earendil-works/chord
```

两者均采用 **MIT 许可证**。文档见 [pi.dev](https://pi.dev)，代码见 [github.com/earendil-works/pi](https://github.com/earendil-works/pi)。

### 原文附带的演示片段

- **Codemode**：Pi 自己写一段脚本，把一周的提交记录浓缩成一份简短摘要。
- **Pi 给自己写扩展**：一个虚拟模型——用 Claude Opus 规划、用 GPT 实现，由 Jev 决定何时切换。
- 重载、开启新会话，启用新的 router/auto 模型。
- 规划阶段运行在 Claude Opus 上。
- Jev 察觉到切换到实现阶段的时机，交接给 GPT 6 Luna。
- `!` 运行写好的脚本。
- `/session` 按模型与缓存使用情况拆解成本。

## 二、总结

**一句话版本**：Earendil 发布了稳定版 Pi 1.0（七项新特性，仍是那个极简的 Pi），以及实验性新包 Pi Durable（把 Pi 的极简与可塑性延伸到长时运行、终端之外的场景）。

### 1. 发布了什么


| 产品             | 定位              | 状态    | 许可证 |
| -------------- | --------------- | ----- | --- |
| **Pi 1.0**     | 加固、极简、可扩展的智能体框架 | 正式稳定版 | MIT |
| **Pi Durable** | 构建长时运行智能体应用的新基座 | 实验性包  | MIT |


### 2. Pi 1.0 的七项新特性

1. Codemode：MCP 原生支持 + 非 LLM 模型（Jev、图像模型）
2. 扩展支持虚拟模型（virtual models）
3. 延迟工具加载（deferred tool loading）
4. Anthropic 模型缓存预热（cache warming）
5. 会话中系统消息（transcript-aware 的提示词与工具变更）
6. 新 TUI 主题
7. 默认全屏模式

### 3. 产品哲学（这篇文章最核心的态度）

- **守住极简**：不追每周都在变的新潮，等功能被证明有效再采纳，权衡“真实功能 vs 额外复杂度”。
- **经得起考验才进来**：候选特性“扔到墙上”粘住的才保留，掉下去的清单更长。
- **不扭曲自己**：长时运行、多入口的需求不硬塞进 Pi，而是拆成独立的 Pi Durable，保住 Pi 的极简根基。
- **背书**：每周数十万用户、数月反馈打磨，定位为“个人与企业可依赖的稳定软件”。

### 4. Pi Durable 要解决的问题

- 触达面：离开编码智能体、离开终端，从不同入口使用。
- 时长：支持更长时运行的会话与任务。
- 原则延续：仍是极简 + 超级可塑，只是延伸到新维度。