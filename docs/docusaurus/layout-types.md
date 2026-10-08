---
title: Layout 的两份类型声明
sidebar_position: 4
description: IDE 报 "Property 'title' does not exist on type 'IntrinsicAttributes & Props'"，代码运行却一切正常。根因是 Docusaurus 把 @theme/Layout 的类型写了两遍，而 IDE 只加载到其中一半。
tags: [站点建设, 前端, Docusaurus, TypeScript]
---

# Layout 的两份类型声明

`src/pages/editor.tsx` 里的 `<Layout title="在线编辑">` 在 IDE 上有一条红线：

```
Type '{ children: (Element | null)[]; title: string; }' is not assignable to type 'IntrinsicAttributes & Props'.
  Property 'title' does not exist on type 'IntrinsicAttributes & Props'.
```

站点构建、部署、页面标题全都正常。所以这不是用法错误，是**类型声明没跟上实现**。

## 一、根因：`@theme/Layout` 被写了两遍

`@theme/*` 是 webpack alias + 主题 shadowing（用户的 `src/theme/*` 会覆盖主题包里的同名文件），TypeScript 没法靠文件路径解析它，Docusaurus 只能手写 ambient 声明。`theme-classic.d.ts` 的头部注释把这件事写得很直白：

> The export signatures are duplicated from the implementation… TODO we'll eventually migrate to TS `paths` option. This is not easy due to our theme shadowing

于是出现了两份：

| 文件 | 职责 | `@theme/*` 数量 |
| --- | --- | --- |
| `@docusaurus/module-type-aliases` | 主题无关的最小骨架，换任何主题都得能解析 | 7 个 |
| `@docusaurus/theme-classic` | classic 主题的真实签名，从实现复制 | 191 个 |

两者唯一的重叠点就是 `@theme/Layout`——**两份 `interface Props` 靠 TS 接口合并拼起来才是完整集合**。

骨架那份只写 `children` 也不是偷懒。实现源码里 `title` / `description` 被官方自己标了性质：

```ts
const {
  children, noFooter, wrapperClassName,
  // Not really layout-related, but kept for convenience/retro-compatibility
  title, description,
} = props;
```

`Layout` 的本职是包一层外壳，`title` 是历史遗留的便捷参数（正规写法是自己用 `@docusaurus/Head`）。基线契约只表达核心职责，便利参数留给具体主题的声明去补。

## 二、为什么 IDE 只拿到一半

两边的加载条件不对称：

- 只要 import 任意 `@docusaurus/*`（本站 `private.tsx` 引了 `@docusaurus/theme-common`），它的 d.ts 里那句 `/// <reference types="@docusaurus/module-type-aliases" />` 就把**骨架**拉进来了——所以 `@theme/Layout` 解析得到，不报 `TS2307`；
- 而 `theme-classic.d.ts` 只有在 **import `@docusaurus/theme-classic` 这个包本身**时才会被自动加载。我们用的是 `@theme/Layout` 别名，TS 映射不到那个包。

结果就是半残状态：模块找得到（不红），`Props` 只有一半（`title` 报 `TS2322`）。同一个机制还顺带制造了 5 条 `Cannot find module '@theme/Heading'`、`@theme/TOC`、`@theme/DocRoot/Layout` 等假错误。

## 三、修法：一行引用

新增 `src/docusaurus.d.ts`：

```ts
/// <reference types="@docusaurus/theme-classic" />
```

把缺的另一半显式拉进工程，两个 `Props` 合并，运行时零改动。

副作用是 `@theme/Heading` 的类型从 `any` 变成了真类型，`MarkdownView.tsx` 里 `` as={`h${t.depth}`} `` 暴露出与 `HeadingType` 不匹配，于是补了个小函数：

```ts
// marked 的 heading depth（1-6）→ @theme/Heading 的 HeadingType（'h1'~'h6'）
function headingTag(depth: number | string) {
  return `h${depth}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}
```

## 四、验证

用 `typescript@6.0.3` 对 `src/**` 做 A/B 全量 typecheck：

```
修复前  373 条错误
修复后  364 条错误   消除 9 条，新增 0 条
```

消除的 9 条 = 2 条 `title` 不存在 + 5 条 `Cannot find module '@theme/...'` + 2 条相关连锁。`npm run build` 通过。

## 五、以后升级会不会炸

三种情形都实测过：

| 情形 | 结果 |
| --- | --- |
| 上游把 `title` 也补进 `module-type-aliases`（类型相同） | 接口合并，无冲突，无缝 |
| 上游改了 `title` 的类型 | IDE 报新错，删掉那行引用即可 |
| `theme-classic` 的 types 改名 / 消失 | 回到修复前的旧报错，不会更糟 |

关键保险是最后一层：`package.json` 里没有任何 typecheck 脚本，`docusaurus build` 走 SWC/rspack 纯转译**不跑 tsc**——仓库里挂着 364 条类型错误，构建照样 `SUCCESS`。所以最坏情况也只是 IDE 多一条红线，CI/CD 和线上站点零影响。

:::tip[一句话]
官方把完整类型藏在了一个"你不去 import 就不会加载"的包里。遇到 `@theme/*` 相关的类型报错，先分清是**模块找不到**（TS2307，引用缺失）还是**属性不存在**（TS2322，只加载了半套声明），后者补一行 `/// <reference types="@docusaurus/theme-classic" />` 就好。
:::
